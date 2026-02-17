/**
 * Memory Health Agent
 * Self-healing agent for the career memory pipeline.
 * Detects anomalies (e.g. "22 files parsed → 0 results"), diagnoses root causes,
 * fixes code, and validates — following the same agentic loop as code-agent.ts.
 */

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { memoryHealthTools, formatHealthContext, type HealthCheckInput } from './memory-health-tools';

export interface HealthCheckResult {
  fixed: boolean;
  filesModified: string[];
  summary: string;
  retryRecommended: boolean;
}

const HEALTH_AGENT_SYSTEM_PROMPT = `You are a self-healing memory health agent for a Next.js resume optimization platform.
The career memory system has detected an anomaly — parsed resume files but extracted 0 or very few components.
Your job is to diagnose and fix the root cause.

Typical root causes:
- Parser regex doesn't match the actual LaTeX format (multi-line commands, nested braces, different separators)
- Embedding pipeline fails silently
- LanceDB schema mismatch

Workflow:
1. READ the anomaly details from the user message
2. Use read_tex_sample to see the actual .tex file format
3. READ the parser source code (lib/ai/agent/resume-loader.ts)
4. Use run_parser on the sample file to confirm the bug (0 results)
5. DIAGNOSE the regex/logic mismatch
6. WRITE the corrected code via write_file
7. Use run_parser again to verify the fix (should now return results)
8. Use run_full_load to verify end-to-end
9. Return JSON: { "fixed": boolean, "filesModified": string[], "summary": string, "retryRecommended": boolean }

Rules:
- Only modify files under lib/ai/agent/, lib/ai/, or lib/vector-db/
- Keep changes minimal — fix the specific failure
- Always verify your fix with run_parser before declaring success
- If you cannot fix the issue, return { "fixed": false, "filesModified": [], "summary": "explanation", "retryRecommended": false }`;

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

export async function runMemoryHealthAgent(input: HealthCheckInput): Promise<HealthCheckResult> {
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK && !process.env.ANTHROPIC_API_KEY) {
    console.warn('[memory-health-agent] No Claude credentials configured, skipping self-healing');
    return {
      fixed: false,
      filesModified: [],
      summary: 'Memory health agent not configured (no Claude credentials)',
      retryRecommended: false,
    };
  }

  const { client, model } = createClient();

  // Build Anthropic-native tool definitions
  const anthropicTools = memoryHealthTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as { type: 'object'; properties?: Record<string, unknown>; required?: string[] },
  }));

  // Build tool handler map
  const toolHandlers = new Map(memoryHealthTools.map((t) => [t.name, t.handler]));

  type ContentBlock = { type: string; [key: string]: unknown };
  type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
  type TextBlock = { type: 'text'; text: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'user', content: formatHealthContext(input) },
  ];

  let maxIterations = 10;

  while (maxIterations-- > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.messages as any).create({
      model,
      max_tokens: 8192,
      system: HEALTH_AGENT_SYSTEM_PROMPT,
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
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            fixed: parsed.fixed ?? false,
            filesModified: parsed.filesModified ?? [],
            summary: parsed.summary ?? text,
            retryRecommended: parsed.retryRecommended ?? false,
          };
        }
      } catch {
        // JSON parsing failed
      }

      return {
        fixed: false,
        filesModified: [],
        summary: text || 'Memory health agent completed without a clear result',
        retryRecommended: false,
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
    summary: 'Memory health agent exceeded maximum iterations',
    retryRecommended: false,
  };
}
