import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { createAgentTools, type AgentTool } from './tools';
import { runCodeAgent } from './code-agent';
import { loadResumeForAgent } from './resume-loader';
import { createRunLogger } from '@/lib/logger';
import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import { storeJobSearch, storeLearning as storeCareerLearning } from '@/lib/vector-db/career-memory';
import type { JobSearchDoc, LearningDoc } from '@/lib/vector-db/career-schemas';
import type {
  CodeAgentInput,
  AgentStepEvent,
  AgentSearchResponse,
  AgentJobResult,
  JobSearchAgentOptions,
  PipelineStage,
  InterventionResponse,
  CodeAgentOptions,
} from './types';

// Sub-agent imports
import { runDiscoveryPhase } from './sub-agents/discovery-agent';
import { processCompany } from './sub-agents/company-worker';
import { WriteQueue, Semaphore } from './sub-agents/write-queue';
import type { CompanyWorkerResult } from './sub-agents/types';

// ============================================================
// 3-Phase Parallel Orchestrator (default)
// ============================================================

/**
 * Runs the job search agent using a 3-phase parallel architecture:
 * 1. Discovery (sequential): memory + H1B + cross-reference
 * 2. Processing (parallel): per-company workers with per-job processors
 * 3. Summarize (sequential): aggregate + store learnings
 *
 * Auto-loads resume data from disk — no need to pass it in.
 */
export async function runJobSearchAgent(
  jobTitle: string,
  location: string | undefined,
  options?: JobSearchAgentOptions
): Promise<AgentSearchResponse> {
  const maxJobs = options?.maxJobs ?? 5;
  const matchThreshold = options?.matchThreshold ?? 60;
  const targetCompany = options?.targetCompany;
  const onEvent = options?.onEvent;
  const maxCompanies = 10;
  const maxJobsPerCompany = Math.max(3, Math.ceil(maxJobs / 2));

  const runLog = createRunLogger(uuidv4().slice(0, 8));
  runLog.info('Agent run started', { jobTitle, location: location ?? '', maxJobs, maxCompanies });

  // Auto-load resume data from disk
  const { latex: masterResumeLatex, resumeData: masterResumeData, deepContext } = await loadResumeForAgent();

  onEvent?.({
    type: 'resume_loaded',
    message: `Loaded resume: ${masterResumeData.experiences.length} experience bullets, ${masterResumeData.skills.length} skills, ${masterResumeData.projects.length} project bullets`,
    experiences: masterResumeData.experiences.length,
    skills: masterResumeData.skills.length,
    projects: masterResumeData.projects.length,
  });

  // Concurrency primitives
  const writeQueue = new WriteQueue();
  const companySemaphore = new Semaphore(5);
  const jobSemaphore = new Semaphore(3);
  const optimizeSemaphore = new Semaphore(2);

  // ── PHASE 1: Discovery ──
  onEvent?.({ type: 'phase_transition', phase: 'discovery', status: 'started' });

  const discovery = await runDiscoveryPhase(jobTitle, location, targetCompany, onEvent);

  onEvent?.({ type: 'phase_transition', phase: 'discovery', status: 'completed' });

  if (discovery.companies.length === 0) {
    onEvent?.({ type: 'error', message: 'No searchable companies found after discovery phase' });
    return {
      jobTitle,
      totalH1bSponsors: discovery.h1bData.totalPositions,
      companiesSearched: 0,
      jobsAnalyzed: 0,
      results: [],
    };
  }

  // ── PHASE 2: Parallel Company Processing (binary split) ──
  onEvent?.({ type: 'phase_transition', phase: 'processing', status: 'started' });

  const companies = discovery.companies.slice(0, maxCompanies);
  const mid = Math.ceil(companies.length / 2);
  const leftBatch = companies.slice(0, mid);
  const rightBatch = companies.slice(mid);

  const processHalf = (batch: typeof companies, batchIndex: number) => {
    onEvent?.({
      type: 'parallel_batch',
      batchIndex,
      companies: batch.map((c) => c.name),
      status: 'started',
    });

    return Promise.allSettled(
      batch.map((c) =>
        companySemaphore.run(() =>
          processCompany(
            c,
            jobTitle,
            location,
            matchThreshold,
            maxJobsPerCompany,
            masterResumeLatex,
            masterResumeData,
            deepContext,
            writeQueue,
            optimizeSemaphore,
            jobSemaphore,
            onEvent,
          )
        )
      )
    ).then((results) => {
      onEvent?.({
        type: 'parallel_batch',
        batchIndex,
        companies: batch.map((c) => c.name),
        status: 'completed',
      });
      return results;
    });
  };

  const [leftResults, rightResults] = await Promise.all([
    processHalf(leftBatch, 0),
    processHalf(rightBatch, 1),
  ]);

  onEvent?.({ type: 'phase_transition', phase: 'processing', status: 'completed' });

  // Collect all results
  const allCompanyResults: CompanyWorkerResult[] = [];
  for (const r of [...leftResults, ...rightResults]) {
    if (r.status === 'fulfilled') {
      allCompanyResults.push(r.value);
    } else {
      runLog.warn('Company worker failed', { error: (r.reason as Error).message });
      onEvent?.({ type: 'error', message: `Worker failed: ${(r.reason as Error).message}` });
    }
  }

  // ── PHASE 3: Summarize ──
  onEvent?.({ type: 'phase_transition', phase: 'summarize', status: 'started' });

  // Flatten job results, sort by match score
  const allJobResults: AgentJobResult[] = allCompanyResults
    .flatMap((cr) =>
      cr.jobs.map((j) => ({
        title: j.title,
        company: j.company,
        url: j.url,
        location: j.location,
        h1bAvgWage: discovery.companies.find(
          (c) => c.name.toLowerCase() === j.company.toLowerCase()
        )?.h1bAvgWage ?? 0,
        matchScore: j.matchScore,
        gaps: j.gaps,
        strengths: j.strengths,
        optimizedResume: j.optimizedResume,
      }))
    )
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxJobs);

  // Generate and store learnings
  await generateLearnings(allCompanyResults, jobTitle, writeQueue, onEvent);

  // Store search summary in career memory
  try {
    const topMatches = allJobResults.map((r) => ({
      company: r.company,
      score: r.matchScore,
    }));
    const avgScore = topMatches.length > 0
      ? topMatches.reduce((sum, m) => sum + m.score, 0) / topMatches.length
      : 0;
    const bestCompany = topMatches.length > 0
      ? topMatches.sort((a, b) => b.score - a.score)[0].company
      : '';

    const vector = await generateQueryEmbedding(`${jobTitle} ${location || ''}`);
    const searchDoc: JobSearchDoc = {
      id: `search-${uuidv4()}`,
      jobTitle,
      location: location || '',
      vector,
      totalSponsors: discovery.h1bData.totalPositions,
      companiesSearched: allCompanyResults.length,
      topMatches: JSON.stringify(topMatches),
      avgMatchScore: avgScore,
      bestCompany,
      timestamp: new Date().toISOString(),
    };
    await writeQueue.enqueue(() => storeJobSearch(searchDoc));
  } catch (memErr) {
    runLog.warn('Failed to store search in career memory', { error: (memErr as Error).message });
  }

  onEvent?.({ type: 'phase_transition', phase: 'summarize', status: 'completed' });

  const jobsAnalyzed = allCompanyResults.reduce((sum, cr) => sum + cr.jobs.length, 0);

  runLog.info('Agent run completed', {
    companiesSearched: allCompanyResults.length,
    jobsAnalyzed,
    resultsReturned: allJobResults.length,
    topScore: allJobResults[0]?.matchScore ?? 0,
  });

  return {
    jobTitle,
    totalH1bSponsors: discovery.h1bData.totalPositions,
    companiesSearched: allCompanyResults.length,
    jobsAnalyzed,
    results: allJobResults,
  };
}

/**
 * Generate and store learnings from all company results.
 */
async function generateLearnings(
  companyResults: CompanyWorkerResult[],
  jobTitle: string,
  writeQueue: WriteQueue,
  onEvent?: (e: AgentStepEvent) => void,
): Promise<void> {
  const allJobs = companyResults.flatMap((cr) => cr.jobs);
  if (allJobs.length === 0) return;

  // Aggregate gaps and strengths across all matches
  const gapCounts = new Map<string, number>();
  const strengthCounts = new Map<string, number>();
  const scores = allJobs.map((j) => j.matchScore);

  for (const job of allJobs) {
    for (const gap of job.gaps) {
      gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1);
    }
    for (const strength of job.strengths) {
      strengthCounts.set(strength, (strengthCounts.get(strength) || 0) + 1);
    }
  }

  const topGaps = Array.from(gapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([gap, count]) => `${gap} (${count}x)`);

  const topStrengths = Array.from(strengthCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([strength, count]) => `${strength} (${count}x)`);

  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

  // Store gap learning
  if (topGaps.length > 0) {
    try {
      const insight = `Most common gaps for "${jobTitle}": ${topGaps.join(', ')}. Average match: ${avgScore.toFixed(0)}%.`;
      const vector = await generateQueryEmbedding(insight);
      const doc: LearningDoc = {
        id: `learning-${uuidv4()}`,
        category: 'gap',
        insight,
        vector,
        evidence: JSON.stringify(topGaps),
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      };
      await writeQueue.enqueue(() => storeCareerLearning(doc));
      onEvent?.({ type: 'memory_store', message: insight, category: 'gap' });
    } catch (err) {
      console.warn('[agent] Failed to store gap learning:', err);
    }
  }

  // Store strength learning
  if (topStrengths.length > 0) {
    try {
      const insight = `Top strengths for "${jobTitle}": ${topStrengths.join(', ')}.`;
      const vector = await generateQueryEmbedding(insight);
      const doc: LearningDoc = {
        id: `learning-${uuidv4()}`,
        category: 'strength',
        insight,
        vector,
        evidence: JSON.stringify(topStrengths),
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      };
      await writeQueue.enqueue(() => storeCareerLearning(doc));
      onEvent?.({ type: 'memory_store', message: insight, category: 'strength' });
    } catch (err) {
      console.warn('[agent] Failed to store strength learning:', err);
    }
  }

  // Store pattern learning
  const companiesWithMatches = companyResults
    .filter((cr) => cr.jobs.some((j) => j.matchScore >= 60))
    .map((cr) => cr.company);

  if (companiesWithMatches.length > 0) {
    try {
      const insight = `Best-matching companies for "${jobTitle}": ${companiesWithMatches.join(', ')}. Searched ${companyResults.length} companies, ${allJobs.length} jobs analyzed.`;
      const vector = await generateQueryEmbedding(insight);
      const doc: LearningDoc = {
        id: `learning-${uuidv4()}`,
        category: 'pattern',
        insight,
        vector,
        evidence: JSON.stringify(companiesWithMatches),
        confidence: 0.7,
        createdAt: new Date().toISOString(),
      };
      await writeQueue.enqueue(() => storeCareerLearning(doc));
      onEvent?.({ type: 'memory_store', message: insight, category: 'pattern' });
    } catch (err) {
      console.warn('[agent] Failed to store pattern learning:', err);
    }
  }
}

// ============================================================
// Legacy Single-Conversation Agent (fallback for CLI / debug)
// ============================================================

const SYSTEM_PROMPT = `You are an autonomous H1B job search agent powered by Claude. Your mission is to find the best job matches for a candidate by leveraging H1B visa sponsorship data and company job boards.

You have access to career memory — a persistent knowledge base of past searches, resume bullets, and learnings that evolves over time.

Follow this exact workflow:

0. CHECK MEMORY: Call recall_past_searches with the job title to see past results for this role type. Use insights to prioritize companies, skip ones that didn't match well before, and inform your strategy.

1. DISCOVER: Call scan_h1b_sponsors with the user's job title to find companies that sponsor H1B visas for this role. Note the top companies by position count and average wage.

2. CROSS-REFERENCE: scan_h1b_sponsors auto-registers new companies. For any undetectable ones, use web_search + register_company. Then call list_available_companies to confirm the full searchable set.

3. EXPLORE ENGINEERING: For each target company (or if a specific company is requested), call explore_engineering_roles to get ALL engineering and software engineering roles at that company. This gives you a complete picture of the engineering hiring landscape — departments, team sizes, and role levels. Use this to identify the best-fit roles rather than relying on keyword search alone.

4. SEARCH: For each matched company (up to the limit specified), call search_company_jobs with the job title. Collect all job listings. If you already explored engineering roles, use those results to select the most relevant positions.

5. SELECT: From all collected listings plus the engineering exploration, pick the most relevant jobs based on title match, team relevance, and seniority level.

6. FETCH: For each selected job, call fetch_job_details to get the full description and requirements.

7. MATCH: For each fetched job, call match_resume with the requirements array. Include jobTitle, company, and url for career memory storage. Note the score, gaps, and strengths.

8. OPTIMIZE: For jobs scoring above the threshold, optionally call recall_best_bullets with the requirements to find the best-performing bullets from past resumes. Then call optimize_resume with the job details and gaps.

9. SUMMARIZE: Return your final results as a JSON object (no markdown fencing) with this structure:
{
  "results": [
    {
      "title": "...",
      "company": "...",
      "url": "...",
      "location": "...",
      "h1bAvgWage": 0,
      "matchScore": 0,
      "gaps": [],
      "strengths": [],
      "optimizedResume": {
        "latex": "...",
        "changes": [{"section": "...", "reasoning": "..."}],
        "summary": "..."
      }
    }
  ]
}

10. STORE LEARNINGS: Call store_learning 1-3 times with insights about strengths, gaps, and patterns discovered during this search. Categories: "strength", "gap", "pattern", "recommendation".

Rules:
- Always start with memory check, then H1B scan — never skip these steps
- When a target company is specified, focus primarily on that company — explore ALL its engineering roles first
- The scan_h1b_sponsors tool auto-discovers and registers new companies. Check the discoveredCompanies field:
  - newlyRegistered: these are now searchable, proceed to explore their roles
  - undetectable: use web_search to find their careers URL, then call register_company to add them. If no supported ATS URL found, skip and note why
- If job fetching fails, skip that job and continue with others
- Include H1B salary data in your final summary for context
- You can use web_search to research companies or roles for better context
- Be efficient — don't fetch details for jobs with obviously irrelevant titles
- Always store learnings at the end to improve future searches`;

// Supports both Bedrock (bearer token) and direct Anthropic API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClient(): { client: any; model: string } {
  const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (bedrockToken) {
    const region = process.env.BEDROCK_AWS_REGION ?? 'us-east-1';
    return {
      client: new AnthropicBedrock({
        awsRegion: region,
        skipAuth: true,
        defaultHeaders: { Authorization: `Bearer ${bedrockToken}` },
      }),
      model: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    };
  }

  if (anthropicKey) {
    return {
      client: new Anthropic({ apiKey: anthropicKey }),
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  throw new Error('No Claude API credentials configured. Set AWS_BEARER_TOKEN_BEDROCK or ANTHROPIC_API_KEY.');
}

type ContentBlock = { type: string; [key: string]: unknown };
type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type TextBlock = { type: 'text'; text: string };

// Pipeline stage tracking — maps tool names to pipeline stages
const TOOL_STAGE_MAP: Record<string, PipelineStage> = {
  recall_past_searches: 'memory_check',
  recall_best_bullets: 'memory_check',
  scan_h1b_sponsors: 'h1b_scan',
  list_available_companies: 'cross_reference',
  register_company: 'cross_reference',
  explore_engineering_roles: 'explore_roles',
  search_company_jobs: 'search',
  fetch_job_details: 'fetch',
  match_resume: 'match',
  optimize_resume: 'optimize',
  apply_to_job: 'apply',
  store_learning: 'summarize',
};

class PipelineStageTracker {
  private currentStage: PipelineStage | null = null;
  private completedStages = new Set<PipelineStage>();
  private onEvent: ((event: AgentStepEvent) => void) | undefined;

  constructor(onEvent?: (event: AgentStepEvent) => void) {
    this.onEvent = onEvent;
  }

  transition(toolName: string) {
    const stage = TOOL_STAGE_MAP[toolName];
    if (!stage) return;

    if (stage !== this.currentStage) {
      // Complete previous stage
      if (this.currentStage && !this.completedStages.has(this.currentStage)) {
        this.completedStages.add(this.currentStage);
        this.onEvent?.({ type: 'pipeline_stage', stage: this.currentStage, status: 'completed' });
      }
      // Activate new stage
      this.currentStage = stage;
      this.onEvent?.({ type: 'pipeline_stage', stage, status: 'active' });
    }
  }

  complete() {
    if (this.currentStage && !this.completedStages.has(this.currentStage)) {
      this.completedStages.add(this.currentStage);
      this.onEvent?.({ type: 'pipeline_stage', stage: this.currentStage, status: 'completed' });
    }
  }
}

/**
 * Legacy single-conversation agent using Claude via Bedrock or direct API.
 * Kept for fallback/CLI mode. The new parallel version is `runJobSearchAgent`.
 */
export async function runJobSearchAgentLegacy(
  jobTitle: string,
  location: string | undefined,
  options?: JobSearchAgentOptions
): Promise<AgentSearchResponse> {
  const maxJobs = options?.maxJobs ?? 5;
  const matchThreshold = options?.matchThreshold ?? 60;
  const targetCompany = options?.targetCompany;
  const onEvent = options?.onEvent;

  // Validate credentials exist
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('No Claude API credentials configured. Set AWS_BEARER_TOKEN_BEDROCK or ANTHROPIC_API_KEY.');
  }

  // Auto-load resume data from disk
  const { latex: masterResumeLatex, resumeData: masterResumeData, deepContext } = await loadResumeForAgent();

  onEvent?.({
    type: 'resume_loaded',
    message: `Loaded resume: ${masterResumeData.experiences.length} experience bullets, ${masterResumeData.skills.length} skills, ${masterResumeData.projects.length} project bullets`,
    experiences: masterResumeData.experiences.length,
    skills: masterResumeData.skills.length,
    projects: masterResumeData.projects.length,
  });

  // Self-healing callback with optional user intervention
  const onSelfHeal = async (input: CodeAgentInput): Promise<'skip' | 'retry' | void> => {
    onEvent?.({
      type: 'self_healing',
      tool: input.toolName,
      error: input.error,
      message: `Attempting to self-heal ${input.toolName} failure...`,
    });

    // If intervention callback exists, pause and wait for user decision
    let interventionResult: InterventionResponse | null = null;
    if (options?.onIntervention) {
      onEvent?.({
        type: 'intervention_required',
        streamId: options.streamId || '',
        tool: input.toolName,
        error: input.error,
        options: ['auto_fix', 'skip', 'retry', 'edit_prompt'],
      });

      interventionResult = await options.onIntervention(input.toolName, input.error);

      onEvent?.({
        type: 'intervention_resolved',
        action: interventionResult.action,
      });

      if (interventionResult.action === 'skip') {
        return 'skip';
      }
      if (interventionResult.action === 'retry') {
        return 'retry';
      }
    }

    // Proceed with code agent (auto_fix or edit_prompt)
    const codeAgentOptions: CodeAgentOptions = {
      onEvent,
      additionalPrompt: interventionResult?.action === 'edit_prompt' ? interventionResult.prompt : undefined,
    };

    try {
      const result = await runCodeAgent(input, codeAgentOptions);
      if (result.fixed) {
        onEvent?.({
          type: 'code_fix',
          filesModified: result.filesModified,
          summary: result.summary,
        });
        if (result.newProviderCreated) {
          onEvent?.({
            type: 'new_provider',
            company: result.newProviderCreated,
            platform: 'unknown',
          });
        }
      }
    } catch (error) {
      console.error('[code-agent] Self-healing failed:', error);
    }
  };

  const tools = createAgentTools(masterResumeLatex, masterResumeData, deepContext, onSelfHeal, onEvent);
  const toolHandlers = new Map<string, AgentTool['handler']>(tools.map((t) => [t.name, t.handler]));

  // Build Anthropic tool definitions
  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const stageTracker = new PipelineStageTracker(onEvent);
  const { client, model } = createClient();

  const companyClause = targetCompany
    ? ` Focus specifically on ${targetCompany} — explore ALL their engineering roles first, then select the best matches.`
    : '';
  const userMessage = `Find the top ${maxJobs} H1B-sponsoring job matches for "${jobTitle}"${
    location ? ` in ${location}` : ''
  }.${companyClause} Match threshold: ${matchThreshold}%. Generate optimized resumes for qualifying matches.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: 'user', content: userMessage }];

  let maxIterations = 50; // High limit for multi-company pipelines
  let finalText = '';

  while (maxIterations-- > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const API_TIMEOUT = 120_000; // 2 minutes per Claude API call
    const response = await Promise.race([
      (client.messages as any).create({
        model,
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        tools: anthropicTools,
        messages,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude API call timed out after 2m')), API_TIMEOUT)
      ),
    ]);

    const toolUseBlocks = (response.content as ContentBlock[]).filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    // Extract any text from this response
    const textBlocks = (response.content as ContentBlock[]).filter(
      (block): block is TextBlock => block.type === 'text'
    );
    if (textBlocks.length > 0) {
      finalText = textBlocks.map((b) => b.text).join('\n');
    }

    // No more tool calls — agent is done
    if (toolUseBlocks.length === 0) {
      break;
    }

    // Emit SSE events for each tool call
    for (const toolUse of toolUseBlocks) {
      stageTracker.transition(toolUse.name);
      emitToolStartEvent(toolUse, onEvent);
    }

    // Add assistant response to messages
    messages.push({ role: 'assistant', content: response.content });

    // Execute all tool calls
    const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = [];
    for (const toolUse of toolUseBlocks) {
      const handler = toolHandlers.get(toolUse.name);
      let result: string;
      if (handler) {
        try {
          result = await handler(toolUse.input);
        } catch (error) {
          result = `Tool execution error: ${(error as Error).message}`;
        }
      } else {
        result = `Unknown tool: ${toolUse.name}`;
      }

      // Emit SSE events for tool results
      emitToolEndEvent(toolUse.name, result, onEvent);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Complete final pipeline stage
  stageTracker.complete();

  // Parse final results from the agent's last text response
  const agentResponse = parseAgentResponse(finalText, jobTitle, onEvent);

  // Store search summary in career memory
  try {
    const topMatches = agentResponse.results.map((r) => ({
      company: r.company,
      score: r.matchScore,
    }));
    const avgScore = topMatches.length > 0
      ? topMatches.reduce((sum, m) => sum + m.score, 0) / topMatches.length
      : 0;
    const bestCompany = topMatches.length > 0
      ? topMatches.sort((a, b) => b.score - a.score)[0].company
      : '';

    const vector = await generateQueryEmbedding(`${jobTitle} ${location || ''}`);
    const searchDoc: JobSearchDoc = {
      id: `search-${uuidv4()}`,
      jobTitle,
      location: location || '',
      vector,
      totalSponsors: agentResponse.totalH1bSponsors,
      companiesSearched: agentResponse.companiesSearched,
      topMatches: JSON.stringify(topMatches),
      avgMatchScore: avgScore,
      bestCompany,
      timestamp: new Date().toISOString(),
    };
    await storeJobSearch(searchDoc);
  } catch (memErr) {
    console.warn('[agent] Failed to store search in career memory:', memErr);
  }

  return agentResponse;
}

function emitToolStartEvent(toolUse: ToolUseBlock, onEvent?: (e: AgentStepEvent) => void) {
  if (!onEvent) return;
  const input = toolUse.input;

  switch (toolUse.name) {
    case 'scan_h1b_sponsors':
      onEvent({ type: 'h1b_scan', message: `Scanning H1B sponsors for "${input.jobTitle}"...`, companies: [] });
      break;
    case 'search_company_jobs':
      onEvent({ type: 'searching', company: (input.company as string) || '', query: (input.query as string) || '' });
      break;
    case 'fetch_job_details':
      onEvent({ type: 'fetching', jobTitle: '', jobUrl: (input.url as string) || '' });
      break;
    case 'optimize_resume':
      onEvent({
        type: 'optimizing',
        jobTitle: (input.jobTitle as string) || '',
        company: (input.company as string) || '',
      });
      break;
    case 'explore_engineering_roles':
      onEvent({
        type: 'engineering_roles',
        company: (input.company as string) || '',
        totalJobs: 0,
        engineeringCount: 0,
        departments: [],
      });
      break;
    case 'recall_past_searches':
      onEvent({
        type: 'memory_recall',
        message: `Checking career memory for past "${input.jobTitle}" searches...`,
      });
      break;
    case 'recall_best_bullets':
      onEvent({
        type: 'memory_recall',
        message: 'Recalling best-performing resume bullets from career memory...',
      });
      break;
    case 'store_learning':
      onEvent({
        type: 'memory_store',
        message: `Storing learning: [${input.category}]`,
        category: (input.category as string) || '',
      });
      break;
    case 'register_company':
      onEvent({
        type: 'company_registered',
        message: `Registering ${input.company} from URL...`,
        company: (input.company as string) || '',
        platform: '',
      });
      break;
    case 'apply_to_job':
      onEvent({
        type: 'applying',
        company: (input.company as string) || '',
        jobTitle: (input.jobTitle as string) || '',
        method: (input.platform as string) && ['greenhouse', 'lever', 'ashby'].includes(input.platform as string) ? 'provider' : 'ai_browser',
      });
      break;
  }
}

function emitToolEndEvent(toolName: string, result: string, onEvent?: (e: AgentStepEvent) => void) {
  if (!onEvent) return;

  try {
    const output = JSON.parse(result);

    if (toolName === 'scan_h1b_sponsors' && output.topCompanies) {
      onEvent({
        type: 'h1b_scan',
        message: `Found ${output.topCompanies.length} H1B sponsors (${output.totalPositions} total positions)`,
        companies: output.topCompanies,
      });
      // Emit discovery results if present
      if (output.discoveredCompanies?.newlyRegistered?.length > 0) {
        onEvent({
          type: 'companies_discovered',
          message: `Auto-discovered ${output.discoveredCompanies.newlyRegistered.length} new companies`,
          companies: output.discoveredCompanies.newlyRegistered.map((c: { company: string; platform: string }) => ({
            name: c.company,
            platform: c.platform,
          })),
        });
      }
    } else if (toolName === 'register_company' && output.status === 'registered') {
      onEvent({
        type: 'company_registered',
        message: `Registered ${output.company} (${output.platform})`,
        company: output.company,
        platform: output.platform || 'unknown',
      });
    } else if (toolName === 'list_available_companies') {
      onEvent({
        type: 'registry_match',
        message: `${output.length} companies in search registry`,
        matchedCompanies: output.map((c: { name: string }) => c.name),
      });
    } else if (toolName === 'search_company_jobs' && output.totalCount !== undefined) {
      onEvent({ type: 'jobs_found', company: output.company || '', count: output.totalCount });
    } else if (toolName === 'match_resume' && output.overallScore !== undefined) {
      onEvent({
        type: 'matched',
        jobTitle: '',
        company: '',
        score: output.overallScore,
        gaps: output.gaps || [],
      });
    } else if (toolName === 'optimize_resume' && output.changeCount !== undefined) {
      onEvent({
        type: 'optimized',
        jobTitle: '',
        company: '',
        changeCount: output.changeCount,
      });
    } else if (toolName === 'apply_to_job') {
      onEvent({
        type: 'application_submitted',
        success: output.success || false,
        method: output.method || 'ai_browser',
        confirmationId: output.confirmationId,
        error: output.error,
      });
    } else if (toolName === 'recall_past_searches') {
      onEvent({
        type: 'memory_recall',
        message: `Found ${output.totalPastSearches || 0} past searches, ${output.totalPastMatches || 0} past matches`,
        pastSearches: output.totalPastSearches || 0,
        insights: output.totalPastMatches || 0,
      });
    }
  } catch {
    // Result parsing failed, skip event
  }
}

function parseAgentResponse(
  text: string,
  jobTitle: string,
  onEvent?: (e: AgentStepEvent) => void
): AgentSearchResponse {
  const defaultResponse: AgentSearchResponse = {
    jobTitle,
    totalH1bSponsors: 0,
    companiesSearched: 0,
    jobsAnalyzed: 0,
    results: [],
  };

  if (!text) return defaultResponse;

  try {
    // Try ```json fenced blocks first
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.results) {
        return { ...defaultResponse, results: parsed.results };
      }
    }

    // Try raw JSON object
    const directMatch = text.match(/\{[\s\S]*"results"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (directMatch) {
      const parsed = JSON.parse(directMatch[0]);
      if (parsed.results) {
        return { ...defaultResponse, results: parsed.results };
      }
    }
  } catch (error) {
    console.error('[agent] Failed to parse final results:', error);
    onEvent?.({ type: 'error', message: 'Failed to parse agent results' });
  }

  return defaultResponse;
}
