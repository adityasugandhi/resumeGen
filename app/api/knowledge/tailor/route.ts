/**
 * POST /api/knowledge/tailor
 * RAG-based resume tailoring using project knowledge
 * Supports Ollama (local) and Groq (cloud) LLM providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchDocuments } from '@/lib/vector-db';
import { generateQueryEmbedding } from '@/lib/indexer';
import { callLLM, checkLLMStatus, getLLMProvider } from '@/lib/llm';

export const maxDuration = 120; // 2 minutes max

interface TailorRequest {
  jobDescription: string;
  resumeLatex: string;
  focusAreas?: string[];
  topK?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TailorRequest = await request.json();
    const {
      jobDescription,
      resumeLatex,
      focusAreas = [],
      topK = 5,
    } = body;

    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'jobDescription is required' },
        { status: 400 }
      );
    }

    if (!resumeLatex || typeof resumeLatex !== 'string') {
      return NextResponse.json(
        { error: 'resumeLatex is required' },
        { status: 400 }
      );
    }

    // Check LLM status
    const llmStatus = await checkLLMStatus();
    console.log(`Using LLM provider: ${llmStatus.provider} (${llmStatus.model})`);

    if (!llmStatus.available) {
      return NextResponse.json(
        {
          error: 'LLM not available',
          details: llmStatus.error,
          provider: llmStatus.provider,
        },
        { status: 503 }
      );
    }

    console.log('Starting RAG-based resume tailoring...');

    // Step 1: Generate query from job description
    const queryText = `${jobDescription} ${focusAreas.join(' ')}`;
    const queryVector = await generateQueryEmbedding(queryText);

    // Step 2: Search for relevant projects
    const searchResults = await searchDocuments(queryVector, topK);

    console.log(`Found ${searchResults.length} relevant project chunks`);

    // Step 3: Build context from search results
    const projectContext = buildProjectContext(searchResults);

    // Step 4: Generate tailored resume using Groq
    const tailoredResult = await generateTailoredResume(
      jobDescription,
      resumeLatex,
      projectContext,
      focusAreas
    );

    return NextResponse.json({
      success: true,
      tailoredResume: tailoredResult.tailoredLatex,
      changes: tailoredResult.changes,
      reasoning: tailoredResult.reasoning,
      relevantProjects: searchResults.map((r) => ({
        projectName: r.document.projectName,
        chunk: r.document.chunk.slice(0, 200) + '...',
        score: r.score,
        techStack: r.document.metadata.techStack,
      })),
      llmProvider: llmStatus.provider,
      llmModel: llmStatus.model,
    });
  } catch (error) {
    console.error('Tailor error:', error);
    return NextResponse.json(
      {
        error: 'Failed to tailor resume',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Build context string from search results
 */
function buildProjectContext(
  searchResults: Awaited<ReturnType<typeof searchDocuments>>
): string {
  if (searchResults.length === 0) {
    return 'No relevant project information found.';
  }

  const contextParts: string[] = [];

  // Group by project
  const projectGroups = new Map<string, typeof searchResults>();

  for (const result of searchResults) {
    const projectName = result.document.projectName;
    if (!projectGroups.has(projectName)) {
      projectGroups.set(projectName, []);
    }
    projectGroups.get(projectName)!.push(result);
  }

  // Build context for each project
  for (const [projectName, results] of Array.from(projectGroups.entries())) {
    const firstResult = results[0];
    const metadata = firstResult.document.metadata;

    contextParts.push(`## Project: ${projectName}`);
    contextParts.push(`Tech Stack: ${metadata.techStack.join(', ') || 'N/A'}`);
    contextParts.push(`Language: ${metadata.language || 'N/A'}`);

    if (metadata.framework) {
      contextParts.push(`Framework: ${metadata.framework}`);
    }

    if (metadata.description) {
      contextParts.push(`Description: ${metadata.description}`);
    }

    contextParts.push('\nRelevant Content:');

    for (const result of results) {
      contextParts.push(`\n### From ${result.document.fileType}:`);
      contextParts.push(result.document.chunk.slice(0, 800));
    }

    contextParts.push('\n---\n');
  }

  return contextParts.join('\n');
}

/**
 * Generate tailored resume using Groq LLM
 */
async function generateTailoredResume(
  jobDescription: string,
  resumeLatex: string,
  projectContext: string,
  focusAreas: string[]
): Promise<{
  tailoredLatex: string;
  changes: Array<{
    type: 'added' | 'modified' | 'deleted';
    section: string;
    description: string;
    reasoning: string;
  }>;
  reasoning: string;
}> {
  const systemPrompt = `You are an expert resume optimizer with deep knowledge of technical hiring.
Your task is to tailor a LaTeX resume based on a job description and the candidate's project portfolio.

CRITICAL RULES:
1. NEVER fabricate experience, skills, or accomplishments
2. ONLY use information from the provided project context to enhance the resume
3. Reframe existing experience to highlight relevance to the job
4. Add relevant projects from the context if they strengthen the application
5. Maintain professional LaTeX formatting
6. Focus on quantifiable achievements when possible
7. Ensure the resume remains truthful and verifiable

Output Format:
1. First, output the complete tailored LaTeX resume
2. Then output a JSON block with changes made, wrapped in \`\`\`json ... \`\`\`

The JSON should have this structure:
{
  "changes": [
    {
      "type": "added" | "modified" | "deleted",
      "section": "section name",
      "description": "what was changed",
      "reasoning": "why this change helps"
    }
  ],
  "reasoning": "Overall strategy and reasoning for the tailoring"
}`;

  const userPrompt = `## Job Description:
${jobDescription}

${focusAreas.length > 0 ? `## Focus Areas:\n${focusAreas.join(', ')}\n` : ''}

## Candidate's Project Portfolio (from their actual work):
${projectContext}

## Current Resume (LaTeX):
${resumeLatex}

Please tailor this resume for the job description above, using relevant information from the project portfolio to strengthen the application. Remember: only use real information from the projects, never fabricate.`;

  // Call LLM (Ollama or Groq based on LLM_PROVIDER env var)
  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.3,
      maxTokens: 8000,
    }
  );

  const content = response.content;

  // Parse the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  let changes: Array<{
    type: 'added' | 'modified' | 'deleted';
    section: string;
    description: string;
    reasoning: string;
  }> = [];
  let reasoning = '';

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      changes = parsed.changes || [];
      reasoning = parsed.reasoning || '';
    } catch {
      console.error('Failed to parse changes JSON');
    }
  }

  // Extract LaTeX (everything before the JSON block)
  let tailoredLatex = content;
  if (jsonMatch) {
    tailoredLatex = content.slice(0, jsonMatch.index).trim();
  }

  // Clean up LaTeX if wrapped in code blocks
  const latexMatch = tailoredLatex.match(/```(?:latex|tex)?\s*([\s\S]*?)\s*```/);
  if (latexMatch) {
    tailoredLatex = latexMatch[1];
  }

  return {
    tailoredLatex,
    changes,
    reasoning,
  };
}
