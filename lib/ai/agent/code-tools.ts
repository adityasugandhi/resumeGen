import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { CodeAgentInput } from './types';

const PROJECT_ROOT = process.cwd();

// Allowed directories for code agent modifications
const ALLOWED_WRITE_DIRS = ['lib/careers/providers/', 'lib/careers/auto-apply/providers/', 'lib/ai/', 'lib/careers/company-registry.ts', 'lib/vector-db/'];

function isPathAllowed(filePath: string): boolean {
  const rel = relative(PROJECT_ROOT, filePath);
  return ALLOWED_WRITE_DIRS.some((dir) => rel.startsWith(dir));
}

export interface CodeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<string>;
}

export const codeTools: CodeTool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a source code file by path (relative to project root)',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
      },
      required: ['path'],
    },
    handler: async (input) => {
      try {
        const fullPath = join(PROJECT_ROOT, input.path as string);
        return readFileSync(fullPath, 'utf-8');
      } catch (error) {
        return `Error reading file: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a source code file. Only allowed in lib/careers/providers/ and lib/ai/.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
        content: { type: 'string', description: 'File content to write' },
      },
      required: ['path', 'content'],
    },
    handler: async (input) => {
      const fullPath = join(PROJECT_ROOT, input.path as string);
      if (!isPathAllowed(fullPath)) {
        return `Error: Writing to ${input.path} is not allowed. Only lib/careers/providers/ and lib/ai/ are writable.`;
      }
      try {
        writeFileSync(fullPath, input.content as string, 'utf-8');
        return `Successfully wrote ${input.path}`;
      } catch (error) {
        return `Error writing file: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory (relative to project root)',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to project root' },
        recursive: { type: 'boolean', description: 'Whether to list recursively' },
      },
      required: ['path'],
    },
    handler: async (input) => {
      try {
        const fullPath = join(PROJECT_ROOT, input.path as string);
        const files: string[] = [];
        const listDir = (dir: string, depth: number) => {
          if (depth > 3) return;
          const entries = readdirSync(dir);
          for (const entry of entries) {
            if (entry === 'node_modules' || entry === '.git' || entry === '.next') continue;
            const entryPath = join(dir, entry);
            const stat = statSync(entryPath);
            const relPath = relative(PROJECT_ROOT, entryPath);
            if (stat.isDirectory()) {
              files.push(relPath + '/');
              if (input.recursive) listDir(entryPath, depth + 1);
            } else {
              files.push(relPath);
            }
          }
        };
        listDir(fullPath, 0);
        return files.join('\n');
      } catch (error) {
        return `Error listing files: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'web_search',
    description: 'Search the web using Perplexity AI for API documentation, solutions, or updated endpoints',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    handler: async (input) => {
      try {
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) return 'Error: PERPLEXITY_API_KEY not configured';

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: 'You are a technical research assistant. Provide concise, accurate information about APIs, SDKs, and technical documentation.' },
              { role: 'user', content: input.query as string },
            ],
            max_tokens: 1024,
          }),
        });

        if (!response.ok) return `Perplexity API error: ${response.status}`;
        const data = await response.json() as { choices: { message: { content: string } }[] };
        return data.choices?.[0]?.message?.content || 'No results';
      } catch (error) {
        return `Search error: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'run_fetch',
    description: 'Execute a fetch request to test an API endpoint',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'string', description: 'Request body (for POST)' },
      },
      required: ['url'],
    },
    handler: async (input) => {
      try {
        const response = await fetch(input.url as string, {
          method: (input.method as string) || 'GET',
          headers: (input.headers as Record<string, string>) || {},
          body: input.body as string | undefined,
          signal: AbortSignal.timeout(10000),
        });
        const text = await response.text();
        return JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: text.slice(0, 2000),
        });
      } catch (error) {
        return `Fetch error: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'get_error',
    description: 'Get the full error context for the current failure',
    input_schema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      return 'Error context is provided in the initial message. Re-read the error details above.';
    },
  },
];

export function formatErrorContext(input: CodeAgentInput): string {
  return `A tool in the job search pipeline has failed.

Tool name: ${input.toolName}
Error message: ${input.error}
Arguments passed: ${JSON.stringify(input.args, null, 2)}
${input.stackTrace ? `\nStack trace:\n${input.stackTrace}` : ''}

Please:
1. Read the relevant source file(s) that implement this tool
2. Diagnose what went wrong
3. If needed, search the web for updated API docs
4. Generate a fix and write it to disk
5. Return a JSON summary: { "fixed": boolean, "filesModified": string[], "summary": string }`;
}
