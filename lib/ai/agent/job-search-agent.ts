import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { createAgentTools, type AgentTool } from './tools';
import { runCodeAgent } from './code-agent';
import { loadResumeForAgent } from './resume-loader';
import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import { storeJobSearch } from '@/lib/vector-db/career-memory';
import type { JobSearchDoc } from '@/lib/vector-db/career-schemas';
import type { CodeAgentInput, AgentStepEvent, AgentSearchResponse } from './types';

const SYSTEM_PROMPT = `You are an autonomous H1B job search agent powered by Claude. Your mission is to find the best job matches for a candidate by leveraging H1B visa sponsorship data and company job boards.

You have access to career memory — a persistent knowledge base of past searches, resume bullets, and learnings that evolves over time.

Follow this exact workflow:

0. CHECK MEMORY: Call recall_past_searches with the job title to see past results for this role type. Use insights to prioritize companies, skip ones that didn't match well before, and inform your strategy.

1. DISCOVER: Call scan_h1b_sponsors with the user's job title to find companies that sponsor H1B visas for this role. Note the top companies by position count and average wage.

2. CROSS-REFERENCE: Call list_available_companies to see which companies we can search. Find the intersection — H1B sponsors that are also in our searchable registry.

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
- If a company isn't in the registry, skip it and note why
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

export interface JobSearchAgentOptions {
  maxJobs?: number;
  matchThreshold?: number;
  targetCompany?: string;
  onEvent?: (event: AgentStepEvent) => void;
}

/**
 * Runs the job search agent using Claude via Bedrock or direct API.
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

  // Self-healing callback
  const onSelfHeal = async (input: CodeAgentInput) => {
    onEvent?.({
      type: 'self_healing',
      tool: input.toolName,
      error: input.error,
      message: `Attempting to self-heal ${input.toolName} failure...`,
    });

    try {
      const result = await runCodeAgent(input);
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
    const response = await (client.messages as any).create({
      model,
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    });

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
