import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { getMarketIntelligence } from '@/lib/goinglobal/h1b-intelligence';
import { getAllCompanies } from '@/lib/careers/company-registry';
import { searchJobs } from '@/lib/careers/career-search';
import { scrapeJobPage } from '@/lib/browser-scraper';
import { JobParser } from '@/lib/ai/job-parser';
import { calculateJobResumeMatchFromText } from '@/lib/ai/semantic-matcher';
import { ResumeOptimizer } from '@/lib/ai/resume-optimizer';
import { selectBestBaseResume } from './resume-loader';
import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import {
  searchPastSearches,
  searchJobMatches,
  searchResumeComponents,
  storeLearning as storeCareerLearning,
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
import type { LearningDoc, JobMatchDoc, OptimizedResumeDoc } from '@/lib/vector-db/career-schemas';
import { discoverAndRegisterCompanies, registerCompanyFromUrl } from '@/lib/careers/company-discovery';
import type { AgentStepEvent, CodeAgentInput } from './types';

const execAsync = promisify(exec);

export interface AgentTool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  handler: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Creates the 10 agent tools in Anthropic-native format.
 * Master resume data is closed over so it doesn't need to be passed each call.
 */
export function createAgentTools(
  masterResumeLatex: string,
  masterResumeData: { experiences: string[]; skills: string[]; projects: string[] },
  deepContext: string,
  onSelfHeal?: (input: CodeAgentInput) => Promise<'skip' | 'retry' | void>,
  onEvent?: (event: AgentStepEvent) => void
): AgentTool[] {
  const scanH1bSponsors: AgentTool = {
    name: 'scan_h1b_sponsors',
    description: 'Scan H1B visa sponsorship data for a job title. Returns top companies sponsoring H1B visas with position counts and average wages. Always call this first to discover which companies are hiring.',
    input_schema: {
      type: 'object',
      properties: {
        jobTitle: { type: 'string', description: 'Job title to search for, e.g. "Software Engineer"' },
        location: { type: 'string', description: 'Metro area filter, e.g. "Austin"' },
      },
      required: ['jobTitle'],
    },
    handler: async (input) => {
      try {
        const result = await getMarketIntelligence(input.jobTitle as string, input.location as string | undefined);

        // Auto-discover and register new companies from H1B results
        let discoveredCompanies: { newlyRegistered: { company: string; platform: string }[]; undetectable: string[] } = {
          newlyRegistered: [],
          undetectable: [],
        };
        try {
          const companyNames = result.topCompanies.map((c: { company: string }) => c.company);
          const discoveryResults = await discoverAndRegisterCompanies(companyNames);

          discoveredCompanies = {
            newlyRegistered: discoveryResults
              .filter((r) => r.status === 'registered')
              .map((r) => ({ company: r.company, platform: r.platform || 'unknown' })),
            undetectable: discoveryResults
              .filter((r) => r.status === 'undetectable')
              .map((r) => r.company),
          };

          if (discoveredCompanies.newlyRegistered.length > 0) {
            onEvent?.({
              type: 'companies_discovered',
              message: `Auto-discovered ${discoveredCompanies.newlyRegistered.length} new companies`,
              companies: discoveredCompanies.newlyRegistered.map((c) => ({ name: c.company, platform: c.platform })),
            });
          }
        } catch (discoveryErr) {
          console.warn('[tools] Company discovery failed (non-fatal):', discoveryErr);
        }

        return JSON.stringify({
          totalPositions: result.totalPositions,
          avgWage: result.avgWage,
          medianWage: result.medianWage,
          topCompanies: result.topCompanies,
          wageRange: result.wageRange,
          discoveredCompanies,
        });
      } catch (error) {
        const err = error as Error;
        if (onSelfHeal) {
          await onSelfHeal({ toolName: 'scan_h1b_sponsors', error: err.message, args: input });
        }
        return JSON.stringify({ error: err.message, topCompanies: [] });
      }
    },
  };

  const listAvailableCompanies: AgentTool = {
    name: 'list_available_companies',
    description: 'List all companies in our career search registry with their ATS platform info. Use this to cross-reference with H1B sponsors to find which ones we can search.',
    input_schema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const companies = await getAllCompanies();
      return JSON.stringify(
        companies.map((c) => ({
          name: c.name,
          platform: c.platform,
          careersUrl: c.careersUrl,
        }))
      );
    },
  };

  const searchCompanyJobs: AgentTool = {
    name: 'search_company_jobs',
    description: "Search a specific company's job board for open positions. Returns job listings with titles, locations, teams, and URLs.",
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name to search, e.g. "Stripe"' },
        query: { type: 'string', description: 'Job title or keyword to filter by' },
        location: { type: 'string', description: 'Location filter' },
        department: { type: 'string', description: 'Department filter' },
      },
      required: ['company'],
    },
    handler: async (input) => {
      try {
        const result = await searchJobs({
          company: input.company as string,
          query: input.query as string | undefined,
          location: input.location as string | undefined,
          department: input.department as string | undefined,
        });
        return JSON.stringify({
          company: result.company,
          platform: result.platform,
          totalCount: result.totalCount,
          jobs: result.jobs.slice(0, 20).map((j) => ({
            id: j.id,
            title: j.title,
            location: j.location,
            team: j.team,
            url: j.url,
          })),
        });
      } catch (error) {
        const err = error as Error;
        if (onSelfHeal) {
          await onSelfHeal({ toolName: 'search_company_jobs', error: err.message, args: input });
        }
        return JSON.stringify({ error: err.message, jobs: [] });
      }
    },
  };

  const fetchJobDetails: AgentTool = {
    name: 'fetch_job_details',
    description: 'Fetch and parse full job details from a job posting URL. Returns structured data including title, company, requirements, responsibilities, and qualifications.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL of the job posting to fetch' },
      },
      required: ['url'],
    },
    handler: async (input) => {
      try {
        const { html } = await scrapeJobPage(input.url as string);
        const parser = new JobParser();
        const jobData = await parser.parseJobPosting(html, input.url as string);
        return JSON.stringify(jobData);
      } catch (error) {
        const err = error as Error;
        if (onSelfHeal) {
          await onSelfHeal({ toolName: 'fetch_job_details', error: err.message, args: input });
        }
        return JSON.stringify({ error: err.message });
      }
    },
  };

  const matchResume: AgentTool = {
    name: 'match_resume',
    description: 'Score job requirements against the master resume using semantic matching. Returns overall match score (0-100), gaps (weak areas), and strengths. Also stores the match in career memory.',
    input_schema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of job requirements to match against the resume',
        },
        jobTitle: { type: 'string', description: 'Job title for memory storage' },
        company: { type: 'string', description: 'Company name for memory storage' },
        url: { type: 'string', description: 'Job URL for memory storage' },
      },
      required: ['requirements'],
    },
    handler: async (input) => {
      try {
        const result = await calculateJobResumeMatchFromText(
          input.requirements as string[],
          masterResumeData
        );

        // Auto-store match in career memory
        if (input.jobTitle && input.company) {
          try {
            const matchText = `${input.jobTitle} at ${input.company}: ${(input.requirements as string[]).join(', ')}`;
            const vector = await generateQueryEmbedding(matchText);
            const matchDoc: JobMatchDoc = {
              id: `match-${uuidv4()}`,
              jobTitle: input.jobTitle as string,
              company: input.company as string,
              url: (input.url as string) || '',
              vector,
              overallScore: result.overallScore,
              gaps: JSON.stringify(result.gaps || []),
              strengths: JSON.stringify(result.strengths || []),
              requirements: JSON.stringify(input.requirements),
              applied: false,
              outcome: 'pending',
              createdAt: new Date().toISOString(),
            };
            await storeJobMatch(matchDoc);
          } catch (memErr) {
            console.warn('[tools] Failed to store match in career memory:', memErr);
          }
        }

        return JSON.stringify(result);
      } catch (error) {
        const err = error as Error;
        if (onSelfHeal) {
          await onSelfHeal({ toolName: 'match_resume', error: err.message, args: input });
        }
        return JSON.stringify({ error: err.message, overallScore: 0, gaps: [], strengths: [] });
      }
    },
  };

  const optimizeResume: AgentTool = {
    name: 'optimize_resume',
    description: 'Generate a tailored resume optimized for a specific job. Returns optimized LaTeX, list of changes made, and a summary. Also stores metadata in career memory.',
    input_schema: {
      type: 'object',
      properties: {
        jobTitle: { type: 'string', description: 'Target job title' },
        company: { type: 'string', description: 'Target company name' },
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job requirements to optimize for',
        },
        gaps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Identified gaps between resume and job requirements',
        },
      },
      required: ['jobTitle', 'company', 'requirements', 'gaps'],
    },
    handler: async (input) => {
      try {
        // Select the best existing tailored resume as the base (not the empty skeleton)
        const { latex: baseResumeLatex, sourceCompany: baseSource } = await selectBestBaseResume(
          input.requirements as string[],
          input.jobTitle as string,
          input.company as string
        );
        console.log(`[tools] Using ${baseSource} resume as base for ${input.company} optimization`);
        onEvent?.({
          type: 'optimizing',
          jobTitle: input.jobTitle as string,
          company: input.company as string,
        });

        // Fetch top bullets from career memory for this job's requirements
        let topBullets: string[] = [];
        try {
          const topReqs = (input.requirements as string[]).slice(0, 5).join(' ');
          const bulletQueryVec = await generateQueryEmbedding(`${input.jobTitle} ${topReqs}`);
          const bulletMatches = await searchResumeComponents(bulletQueryVec, 10, { type: 'bullet' });
          topBullets = bulletMatches.map(m => m.doc.content);
          console.log(`[tools] Fetched ${topBullets.length} top bullets for optimizer`);
        } catch (bulletErr) {
          console.warn('[tools] Failed to fetch top bullets (non-fatal):', bulletErr);
        }

        const optimizer = new ResumeOptimizer();
        const result = await optimizer.optimizeResume(
          baseResumeLatex,
          input.jobTitle as string,
          input.company as string,
          input.requirements as string[],
          input.gaps as string[],
          undefined, // h1bContext
          deepContext,
          topBullets
        );

        // Post-optimization quality validation
        const validation = validateOptimizedResume(baseResumeLatex, result.tailoredLatex);
        if (!validation.valid) {
          console.warn(`[tools] Optimization validation issues for ${input.company}:`, validation.issues);
        }

        // --- Save .tex to disk ---
        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');
        const companyDir = join(
          process.cwd(),
          'Job_Applications',
          'Companies',
          sanitize(input.company as string)
        );
        const baseName = `${sanitize(input.company as string)}_${sanitize(input.jobTitle as string)}`;
        const texPath = join(companyDir, `${baseName}.tex`);
        let pdfPath: string | undefined;
        let compilationMethod: string | undefined;

        try {
          await mkdir(companyDir, { recursive: true });
          await writeFile(texPath, result.tailoredLatex, 'utf-8');
          onEvent?.({ type: 'file_saved', filePath: texPath, company: input.company as string });
        } catch (saveErr) {
          console.warn('[tools] Failed to save .tex file:', saveErr);
        }

        // --- Compile PDF ---
        try {
          const pdfBuffer = await compileToPdf(result.tailoredLatex);
          compilationMethod = pdfBuffer.method;
          pdfPath = join(companyDir, `${baseName}.pdf`);
          await writeFile(pdfPath, pdfBuffer.buffer);
          onEvent?.({ type: 'pdf_compiled', pdfPath, compilationMethod });
        } catch (compileErr) {
          console.warn('[tools] PDF compilation failed (non-fatal):', compileErr);
        }

        // Auto-store optimized resume metadata in career memory
        try {
          const optimizeText = `Optimized resume for ${input.jobTitle} at ${input.company}`;
          const vector = await generateQueryEmbedding(optimizeText);
          const resumeDoc: OptimizedResumeDoc = {
            id: `opt-${uuidv4()}`,
            jobMatchId: '',
            jobTitle: input.jobTitle as string,
            company: input.company as string,
            vector,
            changeCount: result.changes.length,
            confidenceScore: result.confidenceScore,
            filePath: texPath,
            createdAt: new Date().toISOString(),
          };
          await storeOptimizedResume(resumeDoc);
        } catch (memErr) {
          console.warn('[tools] Failed to store optimized resume in career memory:', memErr);
        }

        return JSON.stringify({
          summary: result.summary,
          confidenceScore: result.confidenceScore,
          changeCount: result.changes.length,
          changes: result.changes.map((c) => ({
            section: c.section,
            type: c.type,
            reasoning: c.reasoning,
          })),
          tailoredLatex: result.tailoredLatex,
          filePath: texPath,
          pdfPath: pdfPath || null,
          compilationMethod: compilationMethod || null,
          validation: { issues: validation.issues, isClean: validation.valid },
          topBulletsUsed: topBullets.length,
        });
      } catch (error) {
        const err = error as Error;
        if (onSelfHeal) {
          await onSelfHeal({ toolName: 'optimize_resume', error: err.message, args: input });
        }
        return JSON.stringify({ error: err.message });
      }
    },
  };

  const webSearch: AgentTool = {
    name: 'web_search',
    description: 'Search the web using Perplexity AI for company info, tech stacks, role context, API docs, or any research needed. Returns AI-synthesized answer with citations.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query, e.g. "Stripe engineering tech stack 2025"' },
      },
      required: ['query'],
    },
    handler: async (input) => {
      try {
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
          return JSON.stringify({ error: 'PERPLEXITY_API_KEY not configured', results: [] });
        }

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content:
                  'You are a research assistant. Provide concise, factual answers with relevant details about companies, job roles, and tech stacks. Focus on actionable information.',
              },
              { role: 'user', content: input.query as string },
            ],
            max_tokens: 1024,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return JSON.stringify({ error: `Perplexity API error: ${response.status} ${errorText}`, results: [] });
        }

        const data = (await response.json()) as {
          choices: { message: { content: string } }[];
          citations?: string[];
        };
        return JSON.stringify({
          answer: data.choices?.[0]?.message?.content || '',
          citations: data.citations || [],
        });
      } catch (error) {
        const err = error as Error;
        return JSON.stringify({ error: err.message, results: [] });
      }
    },
  };

  // ---- Memory Tools ----

  const recallPastSearches: AgentTool = {
    name: 'recall_past_searches',
    description: 'Search career memory for past job searches similar to the current one. Returns previous search results, top companies, and insights from similar past searches. Call this at the start to avoid redundant work.',
    input_schema: {
      type: 'object',
      properties: {
        jobTitle: { type: 'string', description: 'Job title to recall past searches for' },
      },
      required: ['jobTitle'],
    },
    handler: async (input) => {
      try {
        const queryVector = await generateQueryEmbedding(input.jobTitle as string);
        const [pastSearches, pastMatches] = await Promise.all([
          searchPastSearches(queryVector, 5),
          searchJobMatches(queryVector, 10),
        ]);

        return JSON.stringify({
          pastSearches: pastSearches.map((s) => ({
            jobTitle: s.doc.jobTitle,
            location: s.doc.location,
            totalSponsors: s.doc.totalSponsors,
            companiesSearched: s.doc.companiesSearched,
            bestCompany: s.doc.bestCompany,
            avgMatchScore: s.doc.avgMatchScore,
            topMatches: safeJsonParse(s.doc.topMatches, []),
            similarity: s.score,
            timestamp: s.doc.timestamp,
          })),
          pastMatches: pastMatches.map((m) => ({
            jobTitle: m.doc.jobTitle,
            company: m.doc.company,
            overallScore: m.doc.overallScore,
            gaps: safeJsonParse(m.doc.gaps, []),
            strengths: safeJsonParse(m.doc.strengths, []),
            similarity: m.score,
          })),
          totalPastSearches: pastSearches.length,
          totalPastMatches: pastMatches.length,
        });
      } catch (error) {
        const err = error as Error;
        return JSON.stringify({ error: err.message, pastSearches: [], pastMatches: [] });
      }
    },
  };

  const recallBestBullets: AgentTool = {
    name: 'recall_best_bullets',
    description: 'Search career memory for resume bullets that best match specific job requirements. Returns the highest-scoring bullets from all 22 tailored resumes for each requirement.',
    input_schema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of job requirements to find best matching bullets for',
        },
      },
      required: ['requirements'],
    },
    handler: async (input) => {
      try {
        const requirements = input.requirements as string[];
        const results: Record<string, { content: string; sourceCompany: string; score: number }[]> = {};

        for (const req of requirements.slice(0, 10)) {
          const queryVector = await generateQueryEmbedding(req);
          const matches = await searchResumeComponents(queryVector, 5, { type: 'bullet' });
          results[req] = matches.map((m) => ({
            content: m.doc.content,
            sourceCompany: m.doc.sourceCompany,
            score: m.score,
          }));
        }

        return JSON.stringify({ bulletMatches: results });
      } catch (error) {
        const err = error as Error;
        return JSON.stringify({ error: err.message, bulletMatches: {} });
      }
    },
  };

  const storeLearningTool: AgentTool = {
    name: 'store_learning',
    description: 'Store an insight or learning in career memory. Use this at the end of a search to record patterns, strengths, gaps, or recommendations that will improve future searches.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'One of: strength, gap, pattern, recommendation',
        },
        insight: {
          type: 'string',
          description: 'The insight or learning to store',
        },
        evidence: {
          type: 'array',
          items: { type: 'string' },
          description: 'Supporting evidence (company names, scores, etc.)',
        },
      },
      required: ['category', 'insight'],
    },
    handler: async (input) => {
      try {
        const vector = await generateQueryEmbedding(input.insight as string);
        const doc: LearningDoc = {
          id: `learning-${uuidv4()}`,
          category: input.category as LearningDoc['category'],
          insight: input.insight as string,
          vector,
          evidence: JSON.stringify(input.evidence || []),
          confidence: 0.7,
          createdAt: new Date().toISOString(),
        };
        await storeCareerLearning(doc);
        return JSON.stringify({ stored: true, id: doc.id });
      } catch (error) {
        const err = error as Error;
        return JSON.stringify({ error: err.message, stored: false });
      }
    },
  };

  const exploreEngineeringRoles: AgentTool = {
    name: 'explore_engineering_roles',
    description:
      'Fetch ALL open jobs from a company and return only engineering / software engineering roles grouped by department. Use this to get a complete picture of a company\'s engineering hiring before selecting specific roles to match against.',
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name to explore, e.g. "GlossGenius"' },
      },
      required: ['company'],
    },
    handler: async (input) => {
      try {
        // Fetch ALL jobs (no query filter) so we get the full board
        const result = await searchJobs({ company: input.company as string });

        if (result.jobs.length === 0) {
          // Fallback: try browser-based exploration
          try {
            const { CareerExplorerAgent } = await import('@/lib/careers/explorer/career-explorer-agent');
            const explorer = new CareerExplorerAgent();
            const browserResult = await explorer.explore(input.company as string, { maxPages: 3, onEvent });

            if (browserResult.jobs.length > 0) {
              const departments: Record<string, { count: number; roles: { title: string; location: string; url: string }[] }> = {};
              for (const job of browserResult.jobs) {
                const dept = job.team || 'Unspecified';
                if (!departments[dept]) departments[dept] = { count: 0, roles: [] };
                departments[dept].count++;
                departments[dept].roles.push({ title: job.title, location: job.location, url: job.url });
              }

              onEvent?.({
                type: 'engineering_roles',
                company: input.company as string,
                totalJobs: browserResult.totalFound,
                engineeringCount: browserResult.jobs.length,
                departments: Object.keys(departments),
              });

              return JSON.stringify({
                company: input.company,
                platform: browserResult.platform,
                totalJobs: browserResult.totalFound,
                engineeringRoleCount: browserResult.jobs.length,
                departments,
                engineeringRoles: browserResult.jobs.map(j => ({
                  id: j.id, title: j.title, location: j.location, team: j.team, url: j.url,
                })),
                source: 'browser_exploration',
              });
            }
          } catch (browserErr) {
            console.warn(`[tools] Browser exploration fallback failed for ${input.company}:`, (browserErr as Error).message);
          }

          return JSON.stringify({
            company: input.company,
            totalJobs: 0,
            engineeringRoles: [],
            departments: {},
            message: 'No jobs found for this company via API or browser exploration',
          });
        }

        // Engineering-related keywords for filtering
        const engineeringKeywords = [
          'software', 'engineer', 'engineering', 'developer', 'frontend',
          'backend', 'full stack', 'fullstack', 'full-stack', 'devops',
          'sre', 'infrastructure', 'platform', 'data engineer', 'ml engineer',
          'machine learning', 'ai engineer', 'systems engineer', 'cloud',
          'security engineer', 'mobile engineer', 'ios engineer', 'android',
          'qa engineer', 'test engineer', 'reliability',
        ];

        const engineeringJobs = result.jobs.filter((job) => {
          const title = job.title.toLowerCase();
          const team = job.team.toLowerCase();
          return engineeringKeywords.some(
            (kw) => title.includes(kw) || team.includes(kw)
          );
        });

        // Group by department/team
        const departments: Record<string, { count: number; roles: { title: string; location: string; url: string }[] }> = {};
        for (const job of engineeringJobs) {
          const dept = job.team || 'Unspecified';
          if (!departments[dept]) {
            departments[dept] = { count: 0, roles: [] };
          }
          departments[dept].count++;
          departments[dept].roles.push({
            title: job.title,
            location: job.location,
            url: job.url,
          });
        }

        onEvent?.({
          type: 'engineering_roles',
          company: input.company as string,
          totalJobs: result.totalCount,
          engineeringCount: engineeringJobs.length,
          departments: Object.keys(departments),
        });

        return JSON.stringify({
          company: input.company,
          platform: result.platform,
          totalJobs: result.totalCount,
          engineeringRoleCount: engineeringJobs.length,
          departments,
          engineeringRoles: engineeringJobs.map((j) => ({
            id: j.id,
            title: j.title,
            location: j.location,
            team: j.team,
            url: j.url,
          })),
        });
      } catch (error) {
        const err = error as Error;
        if (onSelfHeal) {
          await onSelfHeal({ toolName: 'explore_engineering_roles', error: err.message, args: input });
        }
        return JSON.stringify({ error: err.message, engineeringRoles: [] });
      }
    },
  };

  const registerCompany: AgentTool = {
    name: 'register_company',
    description:
      'Register a new company in the career search registry from a known careers URL. Use this as a fallback for companies that scan_h1b_sponsors could not auto-detect. After registration, the company becomes searchable via search_company_jobs.',
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name, e.g. "Acme Corp"' },
        careersUrl: {
          type: 'string',
          description:
            'Careers page URL from a supported ATS (Greenhouse, Lever, or Ashby), e.g. "https://boards.greenhouse.io/acme"',
        },
      },
      required: ['company', 'careersUrl'],
    },
    handler: async (input) => {
      try {
        const result = await registerCompanyFromUrl(input.company as string, input.careersUrl as string);

        if (result.status === 'registered') {
          onEvent?.({
            type: 'company_registered',
            message: `Registered ${result.company} (${result.platform})`,
            company: result.company,
            platform: result.platform || 'unknown',
          });
        }

        return JSON.stringify(result);
      } catch (error) {
        const err = error as Error;
        return JSON.stringify({ error: err.message, status: 'undetectable' });
      }
    },
  };

  const applyToJob: AgentTool = {
    name: 'apply_to_job',
    description: 'Apply to a job posting. Uses a tiered approach: first tries a hardcoded ATS provider (fast, free), then falls back to AI browser automation (adaptive, costs LLM tokens). Only invoke this when the user explicitly requested auto-apply. Always dry-run first.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job posting ID' },
        company: { type: 'string', description: 'Company name' },
        jobUrl: { type: 'string', description: 'Full URL of the job posting' },
        jobTitle: { type: 'string', description: 'Job title' },
        platform: { type: 'string', description: 'ATS platform (greenhouse, lever, ashby, or unknown)' },
        coverLetter: { type: 'string', description: 'Optional cover letter text' },
        customAnswers: {
          type: 'object',
          description: 'Optional custom answers for application questions (key: question label, value: answer)',
        },
        dryRun: { type: 'boolean', description: 'If true, fill out the form but do not submit. Always dry-run first.' },
      },
      required: ['jobId', 'company', 'jobUrl', 'jobTitle'],
    },
    handler: async (input) => {
      const jobUrl = input.jobUrl as string;
      const company = input.company as string;
      const jobTitle = input.jobTitle as string;
      const jobId = input.jobId as string;
      const platform = (input.platform as string) || 'unknown';
      const dryRun = (input.dryRun as boolean) ?? true;
      const coverLetter = input.coverLetter as string | undefined;
      const customAnswers = input.customAnswers as Record<string, string> | undefined;

      // Check for duplicate applications
      try {
        const { PersistentTracker } = await import('@/lib/careers/auto-apply/tracker');
        const tracker = new PersistentTracker();
        const alreadyApplied = await tracker.hasApplied(jobUrl);
        if (alreadyApplied) {
          return JSON.stringify({ error: 'Already applied to this job', skipped: true });
        }
      } catch {
        // Tracker not available, continue
      }

      // Tier 1: Try hardcoded provider
      const knownPlatforms = ['greenhouse', 'lever', 'ashby'];
      if (knownPlatforms.includes(platform)) {
        try {
          onEvent?.({ type: 'applying', company, jobTitle, method: 'provider' });

          const { JobApplicationEngine } = await import('@/lib/careers/auto-apply/engine');
          const { getProfileFromEnv } = await import('@/lib/careers/auto-apply/applicant-profile');
          const profile = getProfileFromEnv();
          const engine = new JobApplicationEngine(profile);

          const result = await engine.apply(jobId, company, {
            dryRun,
            coverLetter,
            answers: customAnswers,
          });

          if (result.success) {
            onEvent?.({
              type: 'application_submitted',
              success: true,
              method: 'provider',
              confirmationId: result.confirmationId,
            });
            return JSON.stringify({
              success: true,
              method: 'provider',
              platform,
              confirmationId: result.confirmationId,
              dryRun,
            });
          }

          // Provider failed — fall through to Tier 2
          console.warn(`[apply_to_job] Provider failed for ${company}: ${result.error}`);
        } catch (providerErr) {
          console.warn(`[apply_to_job] Provider error for ${company}:`, providerErr);
        }
      }

      // Tier 2: AI Browser Agent
      try {
        onEvent?.({ type: 'applying', company, jobTitle, method: 'ai_browser' });

        const { AIBrowserAgent } = await import('@/lib/careers/auto-apply/browser/ai-browser-agent');
        const agent = new AIBrowserAgent();
        const result = await agent.fill({
          company,
          jobTitle,
          jobUrl,
          coverLetter,
          customAnswers,
          dryRun,
          onEvent,
        });

        onEvent?.({
          type: 'application_submitted',
          success: result.success,
          method: 'ai_browser',
          confirmationId: result.confirmationId,
          error: result.error,
        });

        // Track in database
        if (result.success && !dryRun) {
          try {
            const { trackApplication } = await import('@/lib/careers/auto-apply/tracker');
            await trackApplication(result, jobTitle, jobUrl);
          } catch {
            // Tracking failure is non-fatal
          }
        }

        return JSON.stringify({
          success: result.success,
          method: 'ai_browser',
          platform: result.platform,
          confirmationId: result.confirmationId,
          error: result.error,
          dryRun,
        });
      } catch (browserErr) {
        const err = browserErr as Error;
        onEvent?.({
          type: 'application_submitted',
          success: false,
          method: 'ai_browser',
          error: err.message,
        });
        return JSON.stringify({ error: `Application failed: ${err.message}`, success: false });
      }
    },
  };

  const exploreCompanyBrowser: AgentTool = {
    name: 'explore_company_browser',
    description: "Use an autonomous browser agent to explore a company's careers page when API-based search fails. Navigates the actual website, handles any ATS (Workday, iCIMS, custom portals), and extracts job listings.",
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name to explore' },
        careersUrl: { type: 'string', description: 'Optional known careers URL to start from' },
        maxPages: { type: 'number', description: 'Max pages to explore (default 5)' },
      },
      required: ['company'],
    },
    handler: async (input) => {
      try {
        const { CareerExplorerAgent } = await import('@/lib/careers/explorer/career-explorer-agent');
        const explorer = new CareerExplorerAgent();
        const result = await explorer.explore(input.company as string, {
          maxPages: (input.maxPages as number) || 5,
          careersUrl: input.careersUrl as string | undefined,
          onEvent,
        });

        onEvent?.({
          type: 'engineering_roles',
          company: input.company as string,
          totalJobs: result.totalFound,
          engineeringCount: result.jobs.length,
          departments: [],
        });

        return JSON.stringify({
          company: result.company,
          careersUrl: result.careersUrl,
          platform: result.platform,
          totalFound: result.totalFound,
          pagesExplored: result.pagesExplored,
          registeredInDb: result.registeredInDb,
          jobs: result.jobs.map(j => ({
            id: j.id,
            title: j.title,
            location: j.location,
            team: j.team,
            url: j.url,
          })),
        });
      } catch (error) {
        const err = error as Error;
        return JSON.stringify({ error: err.message, jobs: [] });
      }
    },
  };

  return [
    scanH1bSponsors,
    listAvailableCompanies,
    searchCompanyJobs,
    exploreEngineeringRoles,
    exploreCompanyBrowser,
    fetchJobDetails,
    matchResume,
    optimizeResume,
    webSearch,
    recallPastSearches,
    recallBestBullets,
    storeLearningTool,
    registerCompany,
    applyToJob,
  ];
}

/**
 * Compile LaTeX to PDF via Docker (preferred) or online fallback.
 */
async function compileToPdf(latex: string): Promise<{ buffer: Buffer; method: string }> {
  const TEXLIVE_TAG = 'latest';

  // Try Docker first
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

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Validate an optimized resume for fabricated content and structural integrity.
 */
function validateOptimizedResume(
  original: string,
  optimized: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for placeholder/fabricated patterns — flag if NEW (not in original) or present at all
  const placeholderPatterns = ['ABC Company', 'XYZ Corp', 'Lorem ipsum', 'PLACEHOLDER', 'Company Name Here', 'Your Name', 'Jane Doe', 'John Doe'];
  for (const pattern of placeholderPatterns) {
    if (optimized.includes(pattern)) {
      if (original.includes(pattern)) {
        issues.push(`Pre-existing placeholder carried through: "${pattern}"`);
      } else {
        issues.push(`Fabricated content introduced: "${pattern}"`);
      }
    }
  }

  // Verify known companies preserved
  const knownEntities = ['FSU', 'Aspire Systems', 'Florida State University', 'SRM Institute'];
  for (const entity of knownEntities) {
    if (original.includes(entity) && !optimized.includes(entity)) {
      issues.push(`Known entity removed: "${entity}"`);
    }
  }

  // Verify LaTeX structure
  if (!optimized.includes('\\documentclass')) {
    issues.push('Missing \\documentclass — LaTeX structure broken');
  }
  if (!optimized.includes('\\end{document}')) {
    issues.push('Missing \\end{document} — LaTeX structure incomplete');
  }

  // Check optimized isn't drastically shorter (sign of truncation)
  if (optimized.length < original.length * 0.5) {
    issues.push(`Output suspiciously short (${optimized.length} chars vs original ${original.length})`);
  }

  return { valid: issues.length === 0, issues };
}
