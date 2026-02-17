/**
 * Memory Health Agent Tools
 * 7 tools for diagnosing and repairing the career memory pipeline.
 * Follows the CodeTool interface from code-tools.ts.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { extractResumeComponents } from './resume-loader';
import type { CodeTool } from './code-tools';

const PROJECT_ROOT = process.cwd();

// Allowed directories for health agent modifications
const ALLOWED_WRITE_DIRS = [
  'lib/ai/agent/',
  'lib/ai/',
  'lib/vector-db/',
];

function isPathAllowed(filePath: string): boolean {
  const rel = relative(PROJECT_ROOT, filePath);
  return ALLOWED_WRITE_DIRS.some((dir) => rel.startsWith(dir));
}

export interface HealthCheckInput {
  component: 'parser' | 'indexer' | 'embedder' | 'lancedb';
  anomaly: string;
  expected: string;
  sampleFile?: string;
  parserOutput?: string;
}

export const memoryHealthTools: CodeTool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a source code file or .tex file by path (relative to project root)',
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
    description: 'Write or overwrite a source code file. Only allowed in lib/ai/agent/, lib/ai/, and lib/vector-db/.',
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
        return `Error: Writing to ${input.path} is not allowed. Only lib/ai/agent/, lib/ai/, and lib/vector-db/ are writable.`;
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
    name: 'run_parser',
    description: 'Execute extractResumeComponents() on a specific .tex file and return the JSON result. This lets you see exactly what the parser produces for a given file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '.tex file path relative to project root' },
      },
      required: ['path'],
    },
    handler: async (input) => {
      try {
        const fullPath = join(PROJECT_ROOT, input.path as string);
        const latex = readFileSync(fullPath, 'utf-8');
        const sourceCompany = (input.path as string).split('/').slice(-2, -1)[0] || 'unknown';
        const result = extractResumeComponents(latex, sourceCompany);
        return JSON.stringify({
          experiences: result.experiences.length,
          skills: result.skills.length,
          projects: result.projects.length,
          experienceDetails: result.experiences.map((e) => ({
            title: e.title,
            company: e.company,
            bulletCount: e.bullets.length,
            firstBullet: e.bullets[0]?.substring(0, 100),
          })),
          skillSample: result.skills.slice(0, 10),
          projectDetails: result.projects.map((p) => ({
            name: p.name,
            bulletCount: p.bullets.length,
            firstBullet: p.bullets[0]?.substring(0, 100),
          })),
        }, null, 2);
      } catch (error) {
        return `Error running parser: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'run_full_load',
    description: 'Execute loadMasterResume() end-to-end and return component counts. Lets you verify the full pipeline works after a fix.',
    input_schema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      try {
        // Dynamic import to get fresh module after code changes
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        delete require.cache[require.resolve('./resume-loader')];
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { loadMasterResume } = require('./resume-loader');
        const data = await loadMasterResume();
        return JSON.stringify({
          totalExperiences: data.components.experiences.length,
          totalBullets: data.components.experiences.reduce(
            (sum: number, e: { bullets: string[] }) => sum + e.bullets.length, 0
          ),
          totalSkills: data.components.skills.length,
          totalProjects: data.components.projects.length,
          totalProjectBullets: data.components.projects.reduce(
            (sum: number, p: { bullets: string[] }) => sum + p.bullets.length, 0
          ),
          hasDeepContext: !!data.deepContext,
          latexLength: data.latex.length,
        }, null, 2);
      } catch (error) {
        return `Error running full load: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'read_tex_sample',
    description: 'Read a random .tex file from the Companies directory for format diagnosis. Returns the file path and content.',
    input_schema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      try {
        const companiesDir = join(PROJECT_ROOT, 'Job_Applications', 'Companies');
        const companyDirs = readdirSync(companiesDir);

        for (const dir of companyDirs) {
          const companyPath = join(companiesDir, dir);
          try {
            const stat = statSync(companyPath);
            if (!stat.isDirectory()) continue;
          } catch { continue; }

          const files = readdirSync(companyPath);
          for (const file of files) {
            if (file.endsWith('.tex') && !file.includes('Cover_Letter')) {
              const filePath = join(companyPath, file);
              const content = readFileSync(filePath, 'utf-8');
              const relPath = relative(PROJECT_ROOT, filePath);
              return JSON.stringify({
                path: relPath,
                content: content.substring(0, 3000),
                fullLength: content.length,
              }, null, 2);
            }
          }
        }
        return 'No .tex files found in Companies directory';
      } catch (error) {
        return `Error reading sample: ${(error as Error).message}`;
      }
    },
  },
  {
    name: 'get_health_context',
    description: 'Return the full anomaly context that triggered this health check',
    input_schema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      return 'Health context is provided in the initial message. Re-read the anomaly details above.';
    },
  },
];

export function formatHealthContext(input: HealthCheckInput): string {
  return `The career memory system has detected an anomaly in the ${input.component} component.

Anomaly: ${input.anomaly}
Expected behavior: ${input.expected}
${input.sampleFile ? `Sample file for diagnosis: ${input.sampleFile}` : ''}
${input.parserOutput ? `Parser output: ${input.parserOutput}` : ''}

Please:
1. Read a sample .tex file to understand the actual LaTeX format
2. Read the parser source code to find the regex/logic mismatch
3. Test with run_parser tool to confirm the bug
4. Write corrected code via write_file
5. Re-test with run_parser to verify the fix works
6. If the fix works, run run_full_load to verify end-to-end
7. Return a JSON summary: { "fixed": boolean, "filesModified": string[], "summary": string, "retryRecommended": boolean }`;
}
