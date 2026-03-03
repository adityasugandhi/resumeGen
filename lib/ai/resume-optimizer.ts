import Anthropic from '@anthropic-ai/sdk';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { v4 as uuidv4 } from 'uuid';
import { ResumeChange } from '@/lib/indexeddb';

export interface OptimizationResult {
  tailoredLatex: string;
  changes: ResumeChange[];
  summary: string;
  confidenceScore: number;
}

export type OptimizerProvider = 'anthropic' | 'bedrock' | 'local';

/** Response from the local AirLLM server at /generate */
interface LocalModelResponse {
  latex: string;
  tokens_generated: number;
  generation_time_seconds: number;
  model: string;
}

function getOptimizerProvider(): OptimizerProvider {
  if (process.env.RESUME_LLM_PROVIDER === 'local') return 'local';
  if (process.env.AWS_BEARER_TOKEN_BEDROCK) return 'bedrock';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  // Fallback: check if local server is configured
  if (process.env.RESUME_LLM_URL) return 'local';
  throw new Error('No AI API key configured. Set ANTHROPIC_API_KEY, AWS_BEARER_TOKEN_BEDROCK, or RESUME_LLM_URL for local model.');
}

function createOptimizerClient(): { client: Anthropic | AnthropicBedrock; model: string } {
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
      model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    };
  }

  if (anthropicKey) {
    return {
      client: new Anthropic({ apiKey: anthropicKey }),
      model: 'claude-sonnet-4-5-20250929',
    };
  }

  throw new Error('No AI API key configured. Set ANTHROPIC_API_KEY or AWS_BEARER_TOKEN_BEDROCK.');
}

// ---- Role-type classifier (no LLM call) ----

type RoleType = 'ai-ml' | 'fullstack' | 'backend' | 'data-platform' | 'devops-infra' | 'general';

function classifyRoleType(jobTitle: string, requirements: string[]): RoleType {
  const text = ` ${jobTitle} ${requirements.join(' ')} `.toLowerCase();

  // Multi-word phrases use substring match; single short words use word-boundary regex
  const patterns: Record<Exclude<RoleType, 'general'>, string[]> = {
    'ai-ml': ['llm', 'machine learning', 'ai engineer', 'inference', 'nlp', 'deep learning', 'rag', 'generative ai', 'neural', 'pytorch', 'tensorflow'],
    'fullstack': ['full-stack', 'fullstack', 'full stack', 'frontend', 'front-end', 'react', 'ui/ux', 'user interface'],
    'backend': ['distributed system', 'microservice', 'backend', 'back-end', 'scalability', 'api design', 'grpc', 'kafka', 'message queue'],
    'data-platform': ['data pipeline', 'etl', 'analytics', 'spark', 'warehouse', 'data engineer', 'airflow', 'dbt', 'snowflake', 'bigquery'],
    'devops-infra': ['kubernetes', 'ci/cd', 'infrastructure', 'terraform', 'cloud engineer', 'sre', 'site reliability', 'devops', 'platform engineer'],
  };

  let bestType: RoleType = 'general';
  let bestCount = 0;

  for (const [roleType, keywords] of Object.entries(patterns)) {
    const count = keywords.filter(kw => {
      // For short keywords (<=3 chars like 'sre', 'etl', 'dbt', 'rag'), use word boundary
      if (kw.length <= 3) {
        return new RegExp(`\\b${kw}\\b`).test(text);
      }
      return text.includes(kw);
    }).length;
    if (count > bestCount) {
      bestCount = count;
      bestType = roleType as RoleType;
    }
  }

  return bestCount >= 1 ? bestType : 'general';
}

// ---- Section order recommender ----

function recommendSectionOrder(roleType: RoleType, requirements: string[]): string[] {
  const text = requirements.join(' ').toLowerCase();

  // If requirements mention advanced degree / PhD, promote Education
  const educationFirst = /advanced degree|ph\.?d|doctorate|master.*required/.test(text);

  if (educationFirst) {
    return ['Summary', 'Education', 'Experience', 'Technical Skills', 'Projects', 'Publications & Awards'];
  }

  switch (roleType) {
    case 'ai-ml':
      return ['Summary', 'Experience', 'Projects', 'Technical Skills', 'Education', 'Publications & Awards'];
    case 'data-platform':
      return ['Summary', 'Experience', 'Technical Skills', 'Projects', 'Education', 'Publications & Awards'];
    case 'devops-infra':
      return ['Summary', 'Technical Skills', 'Experience', 'Projects', 'Education', 'Publications & Awards'];
    default:
      return ['Summary', 'Experience', 'Technical Skills', 'Projects', 'Education', 'Publications & Awards'];
  }
}

// ---- Role-specific prompt blocks ----

function getRoleSpecificGuidance(roleType: RoleType): string {
  switch (roleType) {
    case 'ai-ml':
      return `ROLE-SPECIFIC (AI/ML): Emphasize multi-agent systems, RAG pipelines, model evaluation, inference optimization, and LLM integration. Highlight projects involving AI-powered features and data processing at scale.`;
    case 'fullstack':
      return `ROLE-SPECIFIC (Full-Stack): Emphasize product impact, user-facing features, deployment velocity, and end-to-end ownership. Lead with features shipped, user metrics, and cross-stack contributions.`;
    case 'backend':
      return `ROLE-SPECIFIC (Backend): Emphasize distributed systems design decisions, throughput, reliability, and API architecture. Lead with system design choices and their measurable impact.`;
    case 'data-platform':
      return `ROLE-SPECIFIC (Data Platform): Emphasize pipeline throughput, data quality, ETL performance, and analytical impact. Highlight data volume metrics and downstream business outcomes.`;
    case 'devops-infra':
      return `ROLE-SPECIFIC (DevOps/Infra): Emphasize infrastructure reliability, deployment frequency, incident reduction, and cost optimization. Lead with SLO improvements and operational metrics.`;
    default:
      return `ROLE-SPECIFIC (General): Balance technical depth with business impact. Emphasize measurable outcomes and system-level thinking.`;
  }
}

export class ResumeOptimizer {
  private client: Anthropic | AnthropicBedrock | null;
  private model: string;
  private provider: OptimizerProvider;
  private localUrl: string;

  constructor() {
    this.provider = getOptimizerProvider();
    this.localUrl = process.env.RESUME_LLM_URL || 'http://127.0.0.1:8100';

    if (this.provider === 'local') {
      this.client = null;
      this.model = 'local-resume-lm';
    } else {
      const { client, model } = createOptimizerClient();
      this.client = client;
      this.model = model;
    }
  }

  /**
   * Call the local AirLLM server for resume generation.
   * Falls back to cloud provider if local server is unavailable.
   */
  private async callLocalModel(
    jobTitle: string,
    jobCompany: string,
    jobRequirements: string[],
    careerContext?: string,
    jobDescription?: string,
  ): Promise<{ latex: string; tokensGenerated: number; timeSeconds: number }> {
    const url = `${this.localUrl}/generate`;

    const body = {
      job_title: jobTitle,
      company: jobCompany,
      requirements: jobRequirements,
      career_context: careerContext || undefined,
      job_description: jobDescription || undefined,
      max_tokens: 3000,
      temperature: 0.3,
    };

    const controller = new AbortController();
    // 20 minute timeout for CPU inference
    const timeout = setTimeout(() => controller.abort(), 20 * 60 * 1000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`Local model server error (${res.status}): ${errText}`);
      }

      const data: LocalModelResponse = await res.json();
      return {
        latex: data.latex,
        tokensGenerated: data.tokens_generated,
        timeSeconds: data.generation_time_seconds,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if the local model server is healthy.
   */
  async isLocalModelAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.localUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.model_loaded === true;
    } catch {
      return false;
    }
  }

  private async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    baseDelay: number = 2000
  ): Promise<T> {
    let lastError: Error | unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[resume-optimizer] API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, err);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Optimize resume for a specific job posting
   */
  async optimizeResume(
    originalLatex: string,
    jobTitle: string,
    jobCompany: string,
    jobRequirements: string[],
    gapAnalysis: string[],
    h1bContext?: string,
    deepContext?: string,
    topBullets?: string[]
  ): Promise<OptimizationResult> {
    const marketContextBlock = h1bContext
      ? `\nMarket Context (H1B Data):\n${h1bContext}\nUse this salary data to emphasize skills and experience that command higher H1B wages in this market.\n`
      : '';

    const deepContextBlock = deepContext
      ? `\nAdditional Context (real project details for this candidate — use these for accurate bullet points):\n${deepContext}\n`
      : '';

    const topBulletsBlock = topBullets && topBullets.length > 0
      ? `\nHigh-performing bullets from past tailored resumes (use these as inspiration for rephrasing):\n${topBullets.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}\n`
      : '';

    // ── Local model path ───────────────────────────────────────────────────
    if (this.provider === 'local') {
      const localAvailable = await this.isLocalModelAvailable();
      if (localAvailable) {
        console.log('[resume-optimizer] Using local fine-tuned model');
        const result = await this.callLocalModel(
          jobTitle,
          jobCompany,
          jobRequirements,
          deepContext || undefined,
          gapAnalysis.length > 0 ? `Gaps to address: ${gapAnalysis.join(', ')}` : undefined,
        );

        return {
          tailoredLatex: result.latex,
          changes: [{
            id: uuidv4(),
            type: 'modified' as const,
            section: 'Full Resume',
            reasoning: `Generated by local fine-tuned model in ${result.timeSeconds}s (${result.tokensGenerated} tokens)`,
          }],
          summary: `Resume tailored for ${jobTitle} at ${jobCompany} using local model`,
          confidenceScore: 70, // Local model has lower confidence than Claude
        };
      } else {
        console.warn('[resume-optimizer] Local model unavailable, falling back to cloud provider');
        // Fall through to cloud provider
        try {
          const { client, model } = createOptimizerClient();
          this.client = client;
          this.model = model;
        } catch {
          throw new Error(
            'Local model server is not running and no cloud API key is configured. '
            + 'Start the server with: python scripts/airllm-server.py --model resume-model-merged'
          );
        }
      }
    }

    // Classify role and determine section order
    const roleType = classifyRoleType(jobTitle, jobRequirements);
    const sectionOrder = recommendSectionOrder(roleType, jobRequirements);
    const roleGuidance = getRoleSpecificGuidance(roleType);

    const prompt = `You are an expert resume optimization assistant. Your task is to tailor a resume for a specific job posting while maintaining honesty and accuracy.

CRITICAL RULES:
- The original resume below contains REAL experiences at REAL companies. DO NOT replace them with fabricated content.
- Keep the same companies: Florida State University (Prof. Olmo Zavala Romero — FSU), Aspire Systems, and any others present.
- Keep the same dates and locations — do not invent new employment dates.
- Keep the same education: M.S. Computer Science from Florida State University, B.Tech from SRM Institute.
- You may REORDER bullets, REPHRASE for emphasis, or ADD relevant keywords — but NEVER invent new roles, companies, or degrees.
- If the resume has placeholder markers like "%%% CONTENT HERE %%%" — this is a SKELETON. Use the Additional Context section below to fill it with REAL content.

BULLET FORMULA — Every experience bullet MUST follow:
Action verb + System/Tool + Scale/Constraint + Metric + Proof
GOOD: "Built real-time pipeline using Kafka processing 50M events/day, reducing latency from 850ms to 100ms (P99)"
BAD: "Worked on data pipeline improvements"
BAD: "Responsible for maintaining backend services"

KEYWORD STRATEGY:
- Each critical requirement keyword must appear 2-3x across sections (Skills, Experience, Summary)
- Every mention must be in genuine, defensible context — no keyword stuffing
- Mirror exact phrasing from job requirements where truthful (e.g., if they say "distributed systems", use that exact phrase)

SECTION ORDER: Emit LaTeX sections in this order: ${sectionOrder.join(' → ')}

${roleGuidance}

FRAMING (senior roles):
Lead with DECISION or IMPACT, not the tool.
BAD: "Used Kafka for event streaming"
GOOD: "Decoupled 73 service dependencies via event-driven architecture, enabling 12x faster release velocity"
BAD: "Built a React dashboard"
GOOD: "Shipped real-time monitoring dashboard serving 200+ operators, reducing incident response from 45min to 8min"

Job Information:
- Title: ${jobTitle}
- Company: ${jobCompany}
- Detected Role Type: ${roleType}
- Key Requirements:
${jobRequirements.map((req, idx) => `  ${idx + 1}. ${req}`).join('\n')}
${marketContextBlock}${deepContextBlock}${topBulletsBlock}
Identified Gaps:
${gapAnalysis.length > 0 ? gapAnalysis.map((gap, idx) => `  ${idx + 1}. ${gap}`).join('\n') : 'None'}

Original Resume (LaTeX):
\`\`\`latex
${originalLatex}
\`\`\`

Your task:
1. Optimize the resume to better highlight relevant experience and skills for this specific job
2. Reorder or rephrase bullet points to emphasize relevant accomplishments using the BULLET FORMULA above
3. Add keywords from job requirements where they genuinely apply (2-3x across sections)
4. DO NOT fabricate experience or skills
5. DO NOT change facts, dates, or company names
6. Focus on reframing existing experience to better match job requirements
7. Emit sections in the recommended order: ${sectionOrder.join(' → ')}

RESPONSE FORMAT:
1. Write the FULL optimized LaTeX resume in your text response (inside a \`\`\`latex code block)
2. Then call the submit_optimization tool with the structured metadata (changes array, summary, and confidence score)

Be strategic but honest. Focus on presenting existing qualifications in the most relevant way.`;

    const response = await this.callWithRetry(() =>
      this.client!.messages.create({
        model: this.model,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        tools: [
          {
            name: 'submit_optimization',
            description: 'Submit the optimization metadata (changes, summary, confidence score). The actual tailored LaTeX should be written in your text response.',
            input_schema: {
              type: 'object' as const,
              properties: {
                changes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      section: { type: 'string' },
                      type: { type: 'string', enum: ['added', 'modified', 'deleted'] },
                      originalContent: { type: 'string' },
                      newContent: { type: 'string' },
                      reasoning: { type: 'string' },
                      lineNumber: { type: 'number' },
                    },
                    required: ['section', 'type', 'reasoning'],
                  },
                },
                summary: { type: 'string' },
                confidenceScore: { type: 'number' },
              },
              required: ['changes', 'summary', 'confidenceScore'],
            },
          },
        ],
      })
    );

    // Track token usage
    if (response.usage) {
      const { TokenTracker } = await import('@/lib/ai/token-tracker');
      TokenTracker.getInstance().record(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens,
        'optimizer',
        'current'
      );
    }

    // Extract LaTeX from text blocks and metadata from tool_use blocks
    let tailoredLatex = '';
    let metadata: { changes: Array<{ type: 'added' | 'modified' | 'deleted'; section: string; originalContent?: string; newContent?: string; reasoning: string; lineNumber?: number }>; summary: string; confidenceScore: number } = {
      changes: [],
      summary: 'Resume optimized for target position',
      confidenceScore: 75,
    };

    for (const block of response.content) {
      if (block.type === 'text') {
        // Extract LaTeX from the text response
        const text = block.text.trim();
        // Remove markdown code fences if present
        const latexMatch = text.match(/```(?:latex)?\n?([\s\S]*?)```/);
        if (latexMatch) {
          tailoredLatex = latexMatch[1].trim();
        } else if (text.includes('\\documentclass')) {
          // Raw LaTeX without code fences
          const docStart = text.indexOf('\\documentclass');
          tailoredLatex = text.substring(docStart).trim();
        }
      } else if (block.type === 'tool_use' && block.name === 'submit_optimization') {
        metadata = block.input as typeof metadata;
      }
    }

    // Fallback: if no tool call, try to parse from text
    if (metadata.changes.length === 0 && !response.content.some(b => b.type === 'tool_use')) {
      // The model didn't call the tool — extract what we can from text
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        // Try to find LaTeX content if not already extracted
        if (!tailoredLatex && textBlock.text.includes('\\documentclass')) {
          tailoredLatex = textBlock.text.substring(textBlock.text.indexOf('\\documentclass')).trim();
          // Remove trailing non-LaTeX content
          const endDoc = tailoredLatex.indexOf('\\end{document}');
          if (endDoc !== -1) {
            tailoredLatex = tailoredLatex.substring(0, endDoc + '\\end{document}'.length);
          }
        }
      }
    }

    if (!tailoredLatex) {
      throw new Error('No LaTeX content in Claude response');
    }

    // Add IDs to changes
    const changes: ResumeChange[] = metadata.changes.map((change) => ({
      id: uuidv4(),
      type: change.type,
      section: change.section,
      originalContent: change.originalContent,
      newContent: change.newContent,
      reasoning: change.reasoning,
      lineNumber: change.lineNumber,
    }));

    return {
      tailoredLatex,
      changes,
      summary: metadata.summary,
      confidenceScore: metadata.confidenceScore,
    };
  }

  /**
   * Generate a cover letter for a job posting
   */
  async generateCoverLetter(
    resumeText: string,
    jobTitle: string,
    jobCompany: string,
    jobDescription: string,
    candidateName: string
  ): Promise<string> {
    const prompt = `Generate a professional cover letter for this job application.

Candidate Information (from resume):
${resumeText.substring(0, 2000)}

Job Information:
- Title: ${jobTitle}
- Company: ${jobCompany}
- Description: ${jobDescription.substring(0, 1000)}

Candidate Name: ${candidateName}

Write a compelling, personalized cover letter (3-4 paragraphs) that:
1. Opens with enthusiasm for the specific role and company
2. Highlights 2-3 most relevant experiences/achievements from the resume
3. Explains why the candidate is a great fit for this specific role
4. Closes with a strong call to action

Tone: Professional, confident, but not arrogant. Show genuine interest.

Return ONLY the cover letter text, no JSON or markdown.`;

    if (!this.client) {
      throw new Error('Cover letter generation requires a cloud API provider (Anthropic/Bedrock).');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    // Track token usage
    if (response.usage) {
      const { TokenTracker } = await import('@/lib/ai/token-tracker');
      TokenTracker.getInstance().record(
        this.model,
        response.usage.input_tokens,
        response.usage.output_tokens,
        'optimizer',
        'current'
      );
    }

    const firstBlock = response.content[0];
    const content = firstBlock && firstBlock.type === 'text' ? firstBlock.text : null;
    if (!content) {
      throw new Error('No text response from Claude');
    }

    return content.trim();
  }
}
