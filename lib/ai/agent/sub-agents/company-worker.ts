/**
 * Per-company worker — explore roles, search jobs, fan out to job processors.
 *
 * Called in parallel (bounded by companySemaphore) from the main orchestrator.
 * Each worker processes one company independently.
 */

import { v4 as uuidv4 } from 'uuid';
import { searchJobs } from '@/lib/careers/career-search';
import type { AgentStepEvent } from '../types';
import type { CompanyWorkerResult, JobWorkerResult, TargetCompany } from './types';
import type { WriteQueue, Semaphore } from './write-queue';
import { processJob } from './job-processor';

// Engineering keywords for filtering roles
const ENGINEERING_KEYWORDS = [
  'software', 'engineer', 'engineering', 'developer', 'frontend',
  'backend', 'full stack', 'fullstack', 'full-stack', 'devops',
  'sre', 'infrastructure', 'platform', 'data engineer', 'ml engineer',
  'machine learning', 'ai engineer', 'systems engineer', 'cloud',
  'security engineer', 'mobile engineer', 'ios engineer', 'android',
  'qa engineer', 'test engineer', 'reliability',
];

export async function processCompany(
  company: TargetCompany,
  jobTitle: string,
  location: string | undefined,
  matchThreshold: number,
  maxJobsPerCompany: number,
  masterResumeLatex: string,
  masterResumeData: { experiences: string[]; skills: string[]; projects: string[] },
  deepContext: string,
  writeQueue: WriteQueue,
  optimizeSemaphore: Semaphore,
  jobSemaphore: Semaphore,
  onEvent?: (e: AgentStepEvent) => void,
): Promise<CompanyWorkerResult> {
  const workerId = uuidv4().slice(0, 8);
  const errors: string[] = [];

  onEvent?.({ type: 'worker_started', company: company.name, workerId });

  // 1. Explore all engineering roles
  let engineeringCount = 0;
  let totalRoles = 0;
  let engineeringJobs: Array<{ title: string; url: string; location: string }> = [];

  try {
    onEvent?.({
      type: 'worker_progress',
      company: company.name,
      phase: 'explore',
      jobsTotal: 0,
      jobsProcessed: 0,
    });

    const allJobsResult = await searchJobs({ company: company.name });
    totalRoles = allJobsResult.totalCount;

    engineeringJobs = allJobsResult.jobs
      .filter((job) => {
        const title = job.title.toLowerCase();
        const team = job.team.toLowerCase();
        return ENGINEERING_KEYWORDS.some(
          (kw) => title.includes(kw) || team.includes(kw)
        );
      })
      .map((j) => ({ title: j.title, url: j.url, location: j.location }));

    engineeringCount = engineeringJobs.length;

    onEvent?.({
      type: 'engineering_roles',
      company: company.name,
      totalJobs: totalRoles,
      engineeringCount,
      departments: [],
    });
  } catch (err) {
    const msg = `Explore failed for ${company.name}: ${(err as Error).message}`;
    console.warn(`[company-worker] ${msg}`);
    errors.push(msg);
  }

  // 2. Search with specific job title query
  let searchedJobs: Array<{ title: string; url: string; location: string }> = [];
  try {
    onEvent?.({
      type: 'worker_progress',
      company: company.name,
      phase: 'search',
      jobsTotal: 0,
      jobsProcessed: 0,
    });

    onEvent?.({ type: 'searching', company: company.name, query: jobTitle });

    const searchResult = await searchJobs({
      company: company.name,
      query: jobTitle,
      location,
    });

    searchedJobs = searchResult.jobs.map((j) => ({
      title: j.title,
      url: j.url,
      location: j.location,
    }));

    onEvent?.({ type: 'jobs_found', company: company.name, count: searchResult.totalCount });
  } catch (err) {
    const msg = `Search failed for ${company.name}: ${(err as Error).message}`;
    console.warn(`[company-worker] ${msg}`);
    errors.push(msg);
  }

  // 3. Merge + deduplicate by URL, then select top N by title relevance
  const urlMap = new Map<string, { title: string; url: string; location: string }>();
  for (const j of [...engineeringJobs, ...searchedJobs]) {
    if (!urlMap.has(j.url)) {
      urlMap.set(j.url, j);
    }
  }

  const allCandidates = Array.from(urlMap.values());
  const selectedJobs = selectTopJobs(allCandidates, jobTitle, maxJobsPerCompany);

  // 4. Process each job in parallel (bounded by jobSemaphore)
  onEvent?.({
    type: 'worker_progress',
    company: company.name,
    phase: 'fetch',
    jobsTotal: selectedJobs.length,
    jobsProcessed: 0,
  });

  let processed = 0;
  const jobResults = await Promise.allSettled(
    selectedJobs.map((job) =>
      jobSemaphore.run(async () => {
        const result = await processJob(
          job,
          company,
          matchThreshold,
          masterResumeData,
          masterResumeLatex,
          deepContext,
          writeQueue,
          optimizeSemaphore,
          onEvent,
        );
        processed++;
        onEvent?.({
          type: 'worker_progress',
          company: company.name,
          phase: processed === selectedJobs.length ? 'done' : 'fetch',
          jobsTotal: selectedJobs.length,
          jobsProcessed: processed,
        });
        return result;
      })
    )
  );

  // Collect results
  const jobs: JobWorkerResult[] = [];
  for (const r of jobResults) {
    if (r.status === 'fulfilled' && r.value) {
      jobs.push(r.value);
    } else if (r.status === 'rejected') {
      errors.push((r.reason as Error).message || 'Job processing failed');
    }
  }

  const topScore = jobs.length > 0
    ? Math.max(...jobs.map((j) => j.matchScore))
    : 0;
  const matchedJobs = jobs.filter((j) => j.matchScore >= matchThreshold).length;

  onEvent?.({
    type: 'worker_completed',
    company: company.name,
    jobsMatched: matchedJobs,
    topScore,
    errors: errors.length,
  });

  return {
    company: company.name,
    jobs,
    engineeringRoles: engineeringCount,
    totalRoles,
    errors,
  };
}

/**
 * Select the top N jobs by title relevance using keyword scoring.
 * No LLM needed — simple string matching.
 */
function selectTopJobs(
  candidates: Array<{ title: string; url: string; location: string }>,
  jobTitle: string,
  maxJobs: number,
): Array<{ title: string; url: string; location: string }> {
  const queryWords = jobTitle.toLowerCase().split(/\s+/);

  const scored = candidates.map((job) => {
    const title = job.title.toLowerCase();
    let score = 0;

    // Exact title match
    if (title === jobTitle.toLowerCase()) {
      score += 100;
    }

    // Word overlap
    for (const word of queryWords) {
      if (title.includes(word)) score += 10;
    }

    // Penalize obviously irrelevant titles (manager, director, designer, recruiter)
    const penaltyKeywords = ['manager', 'director', 'designer', 'recruiter', 'coordinator', 'analyst'];
    for (const kw of penaltyKeywords) {
      if (title.includes(kw) && !jobTitle.toLowerCase().includes(kw)) {
        score -= 20;
      }
    }

    // Boost for seniority keywords matching
    const seniorityKeywords = ['senior', 'staff', 'principal', 'lead', 'junior', 'intern'];
    for (const kw of seniorityKeywords) {
      if (title.includes(kw) && jobTitle.toLowerCase().includes(kw)) {
        score += 15;
      }
    }

    return { ...job, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxJobs)
    .map(({ score: _score, ...job }) => job);
}
