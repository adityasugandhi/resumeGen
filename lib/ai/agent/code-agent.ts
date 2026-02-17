import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { codeTools, formatErrorContext } from './code-tools';
import type { CodeAgentInput, CodeAgentResult } from './types';

const CODE_AGENT_SYSTEM_PROMPT = `You are a self-healing code agent for a Next.js resume optimization platform.
A tool in the job search pipeline has failed. Your job:

1. READ the error details from the user message
2. READ the relevant source file(s) that caused the failure
3. DIAGNOSE what went wrong (API change? HTML structure change? Rate limit? Missing provider?)
4. RESEARCH if needed — use web_search to find updated API docs or solutions
5. GENERATE a fix — write corrected code via write_file
6. Return a JSON summary: { "fixed": boolean, "filesModified": string[], "summary": string }

Rules:
- Only modify files under lib/careers/providers/ or lib/ai/
- Never modify types.ts or core infrastructure
- Keep changes minimal — fix the specific failure
- If you create a new provider, follow the pattern in existing providers
- Always include error handling in generated code
- If you cannot fix the issue, return { "fixed": false, "filesModified": [], "summary": "explanation" }

Project structure:
- lib/careers/providers/ — Job board API integrations (greenhouse.ts, lever.ts, ashby.ts, stripe.ts, cloudflare.ts)
- lib/ai/ — AI agents (job-parser.ts, semantic-matcher.ts, resume-optimizer.ts)
- lib/goinglobal/ — H1B data from GoingGlobal
- lib/careers/company-registry.ts — Company → platform mapping
- lib/careers/career-search.ts — Search dispatcher (switch on platform)`;

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
      model: 'us.anthropic.claude-opus-4-6-v1',
    };
  }

  if (anthropicKey) {
    return {
      client: new Anthropic({ apiKey: anthropicKey }),
      model: 'claude-opus-4-6',
    };
  }

  throw new Error('No Claude API credentials');
}

export async function runCodeAgent(errorContext: CodeAgentInput): Promise<CodeAgentResult> {
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK && !process.env.ANTHROPIC_API_KEY) {
    console.warn('[code-agent] No Claude credentials configured, skipping self-healing');
    return {
      fixed: false,
      filesModified: [],
      summary: 'Code agent not configured (no Claude credentials)',
    };
  }

  const { client, model } = createClient();

  // Build Anthropic-native tool definitions
  const anthropicTools = codeTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as { type: 'object'; properties?: Record<string, unknown>; required?: string[] },
  }));

  // Build tool handler map
  const toolHandlers = new Map(codeTools.map((t) => [t.name, t.handler]));

  type ContentBlock = { type: string; [key: string]: unknown };
  type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
  type TextBlock = { type: 'text'; text: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'user', content: formatErrorContext(errorContext) },
  ];

  let maxIterations = 10;

  while (maxIterations-- > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.messages as any).create({
      model,
      max_tokens: 8192,
      system: CODE_AGENT_SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    });

    // Check if there are tool_use blocks
    const toolUseBlocks = (response.content as ContentBlock[]).filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // No more tool calls — extract final text response
      const textBlock = (response.content as ContentBlock[]).find(
        (block): block is TextBlock => block.type === 'text'
      );
      const text = textBlock?.text || '';

      // Try to parse JSON result
      try {
        const jsonMatch = text.match(/\{[\s\S]*"fixed"[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as CodeAgentResult;
        }
      } catch {
        // Parsing failed
      }

      return {
        fixed: false,
        filesModified: [],
        summary: text || 'Code agent completed without a clear result',
      };
    }

    // Execute tool calls and build tool_result messages
    messages.push({ role: 'assistant', content: response.content });

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
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    fixed: false,
    filesModified: [],
    summary: 'Code agent exceeded maximum iterations',
  };
}
