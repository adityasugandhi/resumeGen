/**
 * Per-job processor — fetch, match, optimize, store.
 *
 * Called in parallel (bounded by jobSemaphore) from company-worker.
 * Uses WriteQueue for LanceDB writes, optimizeSemaphore for Groq + Docker.
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { scrapeJobPage } from '@/lib/browser-scraper';
import { JobParser } from '@/lib/ai/job-parser';
import { calculateJobResumeMatchFromText } from '@/lib/ai/semantic-matcher';
import { ResumeOptimizer } from '@/lib/ai/resume-optimizer';
import { selectBestBaseResume } from '../resume-loader';
import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import {
  searchResumeComponents,
  storeJobMatch,
  storeOptimizedResume,
} from '@/lib/vector-db/career-memory';
import {
  checkDockerInstallation,
  ensureTexliveImage,
  createTempLatexDir,
  writeLatexFile,
  readPdfFile,
  cleanupTempDir,
} from '@/lib/docker-utils';
import type { JobMatchDoc, OptimizedResumeDoc } from '@/lib/vector-db/career-schemas';
import type { AgentStepEvent } from '../types';
import type { JobWorkerResult, TargetCompany } from './types';
import type { WriteQueue, Semaphore } from './write-queue';

const execAsync = promisify(exec);

interface JobInput {
  title: string;
  url: string;
  location: string;
}

export async function processJob(
  job: JobInput,
  company: TargetCompany,
  matchThreshold: number,
  masterResumeData: { experiences: string[]; skills: string[]; projects: string[] },
  masterResumeLatex: string,
  deepContext: string,
  writeQueue: WriteQueue,
  optimizeSemaphore: Semaphore,
  onEvent?: (e: AgentStepEvent) => void,
): Promise<JobWorkerResult | null> {
  // 1. Fetch job details
  onEvent?.({ type: 'fetching', jobTitle: job.title, jobUrl: job.url });

  let requirements: string[] = [];
  let jobTitle = job.title;
  let jobCompany = company.name;

  try {
    const { html } = await scrapeJobPage(job.url);
    const parser = new JobParser();
    const jobData = await parser.parseJobPosting(html, job.url);

    if (jobData.title) jobTitle = jobData.title;
    if (jobData.company) jobCompany = jobData.company;
    requirements = jobData.requirements || [];

    if (requirements.length === 0) {
      // Try to build requirements from responsibilities + qualifications
      const allReqs = [
        ...(jobData.responsibilities || []),
        ...(jobData.qualifications || []),
      ];
      requirements = allReqs.length > 0 ? allReqs : [`${jobTitle} at ${jobCompany}`];
    }
  } catch (err) {
    console.warn(`[job-processor] Failed to fetch ${job.url}:`, err);
    return null;
  }

  // 2. Match resume
  let matchScore = 0;
  let gaps: string[] = [];
  let strengths: string[] = [];

  try {
    const result = await calculateJobResumeMatchFromText(requirements, masterResumeData);
    matchScore = result.overallScore;
    gaps = result.gaps || [];
    strengths = result.strengths || [];

    onEvent?.({
      type: 'matched',
      jobTitle,
      company: jobCompany,
      score: matchScore,
      gaps,
    });
  } catch (err) {
    console.warn(`[job-processor] Match failed for ${jobTitle}:`, err);
    return null;
  }

  // 3. Store match in career memory (via write queue)
  try {
    const matchText = `${jobTitle} at ${jobCompany}: ${requirements.join(', ')}`;
    const vector = await generateQueryEmbedding(matchText);
    const matchDoc: JobMatchDoc = {
      id: `match-${uuidv4()}`,
      jobTitle,
      company: jobCompany,
      url: job.url,
      vector,
      overallScore: matchScore,
      gaps: JSON.stringify(gaps),
      strengths: JSON.stringify(strengths),
      requirements: JSON.stringify(requirements),
      applied: false,
      outcome: 'pending',
      createdAt: new Date().toISOString(),
    };
    await writeQueue.enqueue(() => storeJobMatch(matchDoc));
  } catch (err) {
    console.warn(`[job-processor] Failed to store match:`, err);
  }

  // Below threshold — skip optimization
  if (matchScore < matchThreshold) {
    return {
      title: jobTitle,
      company: jobCompany,
      url: job.url,
      location: job.location,
      matchScore,
      gaps,
      strengths,
    };
  }

  // 4. Recall best bullets (read-only, safe for concurrency)
  let topBullets: string[] = [];
  try {
    const queryVector = await generateQueryEmbedding(requirements.slice(0, 5).join(', '));
    const bulletMatches = await searchResumeComponents(queryVector, 10, { type: 'bullet' });
    topBullets = bulletMatches.map((m) => m.doc.content);
  } catch (err) {
    console.warn(`[job-processor] Best bullets recall failed:`, err);
  }

  // 5. Optimize resume (bounded by optimizeSemaphore)
  let optimizedResume: JobWorkerResult['optimizedResume'] | undefined;

  try {
    optimizedResume = await optimizeSemaphore.run(async () => {
      onEvent?.({ type: 'optimizing', jobTitle, company: jobCompany });

      // Select best base resume
      const { latex: baseResumeLatex } = await selectBestBaseResume(
        requirements,
        jobTitle,
        jobCompany,
      );

      const optimizer = new ResumeOptimizer();
      const result = await optimizer.optimizeResume(
        baseResumeLatex,
        jobTitle,
        jobCompany,
        requirements,
        gaps,
        undefined, // h1bContext
        deepContext,
        topBullets,
      );

      // Save .tex to disk
      const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');
      const companyDir = join(
        process.cwd(),
        'Job_Applications',
        'Companies',
        sanitize(jobCompany),
      );
      const baseName = `${sanitize(jobCompany)}_${sanitize(jobTitle)}`;
      const texPath = join(companyDir, `${baseName}.tex`);

      try {
        await mkdir(companyDir, { recursive: true });
        await writeFile(texPath, result.tailoredLatex, 'utf-8');
        onEvent?.({ type: 'file_saved', filePath: texPath, company: jobCompany });
      } catch (saveErr) {
        console.warn('[job-processor] Failed to save .tex:', saveErr);
      }

      // Compile PDF
      try {
        const pdfBuffer = await compileToPdf(result.tailoredLatex);
        const pdfPath = join(companyDir, `${baseName}.pdf`);
        await writeFile(pdfPath, pdfBuffer.buffer);
        onEvent?.({ type: 'pdf_compiled', pdfPath, compilationMethod: pdfBuffer.method });
      } catch (compileErr) {
        console.warn('[job-processor] PDF compilation failed (non-fatal):', compileErr);
      }

      onEvent?.({
        type: 'optimized',
        jobTitle,
        company: jobCompany,
        changeCount: result.changes.length,
      });

      // Store optimized resume in career memory
      try {
        const optimizeText = `Optimized resume for ${jobTitle} at ${jobCompany}`;
        const vector = await generateQueryEmbedding(optimizeText);
        const resumeDoc: OptimizedResumeDoc = {
          id: `opt-${uuidv4()}`,
          jobMatchId: '',
          jobTitle,
          company: jobCompany,
          vector,
          changeCount: result.changes.length,
          confidenceScore: result.confidenceScore,
          filePath: texPath,
          createdAt: new Date().toISOString(),
        };
        await writeQueue.enqueue(() => storeOptimizedResume(resumeDoc));
      } catch (memErr) {
        console.warn('[job-processor] Failed to store optimized resume:', memErr);
      }

      return {
        latex: result.tailoredLatex,
        changes: result.changes.map((c) => ({
          section: c.section,
          reasoning: c.reasoning,
        })),
        summary: result.summary,
      };
    });
  } catch (err) {
    console.warn(`[job-processor] Optimization failed for ${jobTitle}:`, err);
  }

  return {
    title: jobTitle,
    company: jobCompany,
    url: job.url,
    location: job.location,
    matchScore,
    gaps,
    strengths,
    optimizedResume,
  };
}

/**
 * Compile LaTeX to PDF via Docker (preferred) or online fallback.
 */
async function compileToPdf(latex: string): Promise<{ buffer: Buffer; method: string }> {
  const TEXLIVE_TAG = 'latest';

  const dockerCheck = await checkDockerInstallation();
  if (dockerCheck.running) {
    const imageCheck = await ensureTexliveImage(TEXLIVE_TAG, false);
    if (imageCheck.available) {
      let tempDir: string | null = null;
      try {
        tempDir = await createTempLatexDir();
        await writeLatexFile(tempDir, latex);
        const cmd = `docker run --rm -v "${tempDir}:/workspace" -w /workspace texlive/texlive:${TEXLIVE_TAG} pdflatex -interaction=nonstopmode -halt-on-error document.tex`;
        await execAsync(cmd, { timeout: 30000 });
        await execAsync(cmd, { timeout: 30000 }); // 2nd pass for refs
        const buffer = await readPdfFile(tempDir);
        if (buffer.length === 0) throw new Error('Docker produced empty PDF');
        return { buffer, method: `docker (texlive:${TEXLIVE_TAG})` };
      } finally {
        if (tempDir) await cleanupTempDir(tempDir);
      }
    }
  }

  // Fallback: online compilation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('https://latex.aslushnikov.com/compile?target=pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: latex,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Online compilation failed: ${(await response.text()).substring(0, 300)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error('Online compilation produced empty PDF');
    return { buffer, method: 'online' };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
