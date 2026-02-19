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

export class ResumeOptimizer {
  private client: Anthropic | AnthropicBedrock;
  private model: string;

  constructor() {
    const { client, model } = createOptimizerClient();
    this.client = client;
    this.model = model;
  }

  /**
   * Parse JSON that may contain LaTeX content with unescaped backslashes
   */
  private parseJsonWithLatex(jsonText: string): unknown {
    // First try standard JSON.parse
    try {
      return JSON.parse(jsonText);
    } catch {
      // If standard parsing fails, try to fix LaTeX escape issues
    }

    // Extract the tailoredLatex field value using regex
    // The LaTeX content is likely between "tailoredLatex": " and the next ",
    const latexMatch = jsonText.match(/"tailoredLatex"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"changes"|"\s*,\s*"summary"|"\s*})/);

    if (latexMatch) {
      // Extract the latex content
      let latexContent = latexMatch[1];

      // Properly escape backslashes for JSON (but not already escaped ones)
      // Replace single backslashes with double (but not \\ which are already escaped)
      const escapedLatex = latexContent
        .replace(/\\/g, '\\\\')  // Escape all backslashes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')   // Escape carriage returns
        .replace(/\t/g, '\\t');  // Escape tabs

      // Reconstruct the JSON with properly escaped LaTeX
      const fixedJson = jsonText.replace(
        /"tailoredLatex"\s*:\s*"[\s\S]*?(?="\s*,\s*"changes"|"\s*,\s*"summary"|"\s*})/,
        `"tailoredLatex": "${escapedLatex}`
      );

      try {
        return JSON.parse(fixedJson);
      } catch {
        // Still failed, continue with alternative approach
      }
    }

    // Alternative: Try to parse by extracting each field separately
    try {
      // Extract using more flexible patterns
      const tailoredLatexMatch = jsonText.match(/"tailoredLatex"\s*:\s*["`]([\s\S]*?)["`]\s*,\s*"changes"/);
      const changesMatch = jsonText.match(/"changes"\s*:\s*(\[[\s\S]*?\])\s*,\s*"summary"/);
      const summaryMatch = jsonText.match(/"summary"\s*:\s*"([^"]*?)"\s*,?\s*"?/);
      const confidenceMatch = jsonText.match(/"confidenceScore"\s*:\s*(\d+)/);

      if (tailoredLatexMatch) {
        // Reconstruct the object
        const tailoredLatex = tailoredLatexMatch[1];
        let changes: Array<unknown> = [];

        if (changesMatch) {
          try {
            // Try to parse changes array
            changes = JSON.parse(changesMatch[1]);
          } catch {
            // Use empty array if changes parsing fails
            changes = [];
          }
        }

        return {
          tailoredLatex,
          changes,
          summary: summaryMatch ? summaryMatch[1] : 'Resume optimized for target position',
          confidenceScore: confidenceMatch ? parseInt(confidenceMatch[1], 10) : 75,
        };
      }
    } catch {
      // Continue to fallback
    }

    // Final fallback: return a basic structure with the original latex
    console.warn('Could not parse AI response, returning minimal result');
    return {
      tailoredLatex: jsonText.includes('\\documentclass')
        ? jsonText.match(/\\documentclass[\s\S]*/)?.[0] || ''
        : '',
      changes: [],
      summary: 'Resume optimization completed',
      confidenceScore: 70,
    };
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

    const prompt = `You are an expert resume optimization assistant. Your task is to tailor a resume for a specific job posting while maintaining honesty and accuracy.

CRITICAL RULES:
- The original resume below contains REAL experiences at REAL companies. DO NOT replace them with fabricated content.
- Keep the same companies: Florida State University (Prof. Olmo Zavala Romero — FSU), Aspire Systems, and any others present.
- Keep the same dates and locations — do not invent new employment dates.
- Keep the same education: M.S. Computer Science from Florida State University, B.Tech from SRM Institute.
- You may REORDER bullets, REPHRASE for emphasis, or ADD relevant keywords — but NEVER invent new roles, companies, or degrees.
- If the resume has placeholder markers like "%%% CONTENT HERE %%%" — this is a SKELETON. Use the Additional Context section below to fill it with REAL content.

Job Information:
- Title: ${jobTitle}
- Company: ${jobCompany}
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
2. Reorder or rephrase bullet points to emphasize relevant accomplishments
3. Add keywords from job requirements where they genuinely apply
4. DO NOT fabricate experience or skills
5. DO NOT change facts, dates, or company names
6. Focus on reframing existing experience to better match job requirements

Return your response in this EXACT JSON format:
{
  "tailoredLatex": "FULL optimized LaTeX resume here",
  "changes": [
    {
      "section": "Experience" | "Skills" | "Summary" | "Projects",
      "type": "added" | "modified" | "deleted",
      "originalContent": "original text if modified/deleted",
      "newContent": "new text if added/modified",
      "reasoning": "why this change improves the resume for this job",
      "lineNumber": 42
    }
  ],
  "summary": "2-3 sentence summary of key optimizations made",
  "confidenceScore": 85 (0-100, how well the resume now matches the job)
}

Be strategic but honest. Focus on presenting existing qualifications in the most relevant way.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const firstBlock = response.content[0];
    const content = firstBlock && firstBlock.type === 'text' ? firstBlock.text : null;
    if (!content) {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from response
    let jsonText = content.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    interface ParsedResult {
      tailoredLatex: string;
      changes: Array<{
        type: 'added' | 'modified' | 'deleted';
        section: string;
        originalContent?: string;
        newContent?: string;
        reasoning: string;
        lineNumber?: number;
      }>;
      summary: string;
      confidenceScore: number;
    }

    // Parse JSON with special handling for LaTeX content
    const result = this.parseJsonWithLatex(jsonText) as ParsedResult;

    // Add IDs to changes
    const changes: ResumeChange[] = result.changes.map((change) => ({
      id: uuidv4(),
      type: change.type,
      section: change.section,
      originalContent: change.originalContent,
      newContent: change.newContent,
      reasoning: change.reasoning,
      lineNumber: change.lineNumber,
    }));

    return {
      tailoredLatex: result.tailoredLatex,
      changes,
      summary: result.summary,
      confidenceScore: result.confidenceScore,
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

    const firstBlock = response.content[0];
    const content = firstBlock && firstBlock.type === 'text' ? firstBlock.text : null;
    if (!content) {
      throw new Error('No text response from Claude');
    }

    return content.trim();
  }
}
