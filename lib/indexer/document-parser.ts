/**
 * Document parser for extracting metadata from project files
 */

import { DocumentType, ProjectMetadata } from '../vector-db/schemas';

/**
 * Detect document type from file path
 */
export function detectDocumentType(filePath: string): DocumentType {
  const fileName = filePath.toLowerCase().split('/').pop() || '';

  if (fileName === 'claude.md') return 'claude_md';
  if (fileName === 'readme.md') return 'readme';
  if (fileName === 'package.json') return 'package_json';
  if (fileName === 'pyproject.toml') return 'pyproject';
  if (fileName === 'makefile') return 'makefile';

  return 'other';
}

/**
 * Parse package.json content
 */
export function parsePackageJson(content: string): Partial<ProjectMetadata> {
  try {
    const pkg = JSON.parse(content);

    const techStack: string[] = [];
    const dependencies: string[] = [];
    const scripts: string[] = [];
    const commands: string[] = [];

    // Extract dependencies
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const dep of Object.keys(allDeps)) {
      dependencies.push(dep);

      // Detect tech stack from dependencies
      if (dep.includes('react')) techStack.push('React');
      if (dep.includes('next')) techStack.push('Next.js');
      if (dep.includes('vue')) techStack.push('Vue');
      if (dep.includes('angular')) techStack.push('Angular');
      if (dep.includes('express')) techStack.push('Express');
      if (dep.includes('fastify')) techStack.push('Fastify');
      if (dep.includes('tailwind')) techStack.push('Tailwind CSS');
      if (dep.includes('typescript')) techStack.push('TypeScript');
      if (dep.includes('zustand')) techStack.push('Zustand');
      if (dep.includes('redux')) techStack.push('Redux');
      if (dep.includes('prisma')) techStack.push('Prisma');
      if (dep.includes('drizzle')) techStack.push('Drizzle');
      if (dep.includes('mongoose')) techStack.push('MongoDB');
      if (dep.includes('pg') || dep.includes('postgres')) techStack.push('PostgreSQL');
      if (dep.includes('langchain')) techStack.push('LangChain');
      if (dep.includes('openai')) techStack.push('OpenAI');
      if (dep.includes('anthropic')) techStack.push('Anthropic');
      if (dep.includes('groq')) techStack.push('Groq');
    }

    // Extract scripts
    if (pkg.scripts) {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        scripts.push(name);
        commands.push(`npm run ${name}`);
      }
    }

    // Detect framework from main fields
    let framework: string | undefined;
    if (pkg.dependencies?.next) framework = 'Next.js';
    else if (pkg.dependencies?.react) framework = 'React';
    else if (pkg.dependencies?.vue) framework = 'Vue';
    else if (pkg.dependencies?.express) framework = 'Express';

    return {
      techStack: Array.from(new Set(techStack)),
      dependencies: dependencies.slice(0, 50), // Limit to 50
      scripts,
      commands,
      description: pkg.description || '',
      features: [],
      language: 'typescript',
      framework,
    };
  } catch {
    return {
      techStack: [],
      dependencies: [],
      scripts: [],
      commands: [],
      description: '',
      features: [],
      language: 'unknown',
    };
  }
}

/**
 * Parse pyproject.toml content
 */
export function parsePyprojectToml(content: string): Partial<ProjectMetadata> {
  const techStack: string[] = ['Python'];
  const dependencies: string[] = [];
  const commands: string[] = [];

  // Simple regex parsing for TOML (not a full parser)
  // Extract dependencies
  const depMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (depMatch) {
    const deps = depMatch[1].match(/"([^"]+)"/g);
    if (deps) {
      for (const dep of deps) {
        const depName = dep.replace(/"/g, '').split(/[<>=]/)[0].trim();
        dependencies.push(depName);

        // Detect tech stack
        if (depName.includes('fastapi')) techStack.push('FastAPI');
        if (depName.includes('flask')) techStack.push('Flask');
        if (depName.includes('django')) techStack.push('Django');
        if (depName.includes('langchain')) techStack.push('LangChain');
        if (depName.includes('openai')) techStack.push('OpenAI');
        if (depName.includes('anthropic')) techStack.push('Anthropic');
        if (depName.includes('sqlalchemy')) techStack.push('SQLAlchemy');
        if (depName.includes('pytest')) techStack.push('Pytest');
        if (depName.includes('asyncpg')) techStack.push('PostgreSQL');
        if (depName.includes('oracledb')) techStack.push('Oracle');
      }
    }
  }

  // Extract scripts
  const scriptsMatch = content.match(/\[tool\.poetry\.scripts\]([\s\S]*?)(?=\[|$)/);
  if (scriptsMatch) {
    const scriptLines = scriptsMatch[1].match(/(\w+)\s*=/g);
    if (scriptLines) {
      for (const line of scriptLines) {
        const scriptName = line.replace('=', '').trim();
        commands.push(`poetry run ${scriptName}`);
      }
    }
  }

  // Common commands
  commands.push('poetry install', 'poetry run python main.py', 'pytest');

  // Extract description
  const descMatch = content.match(/description\s*=\s*"([^"]+)"/);
  const description = descMatch ? descMatch[1] : '';

  return {
    techStack: Array.from(new Set(techStack)),
    dependencies: dependencies.slice(0, 50),
    scripts: [],
    commands,
    description,
    features: [],
    language: 'python',
  };
}

/**
 * Parse Makefile content
 */
export function parseMakefile(content: string): Partial<ProjectMetadata> {
  const commands: string[] = [];

  // Extract make targets
  const targetPattern = /^([a-zA-Z_-]+):/gm;
  const matches = Array.from(content.matchAll(targetPattern));

  for (const match of matches) {
    const target = match[1];
    if (!target.startsWith('.')) {
      commands.push(`make ${target}`);
    }
  }

  return {
    techStack: [],
    dependencies: [],
    scripts: [],
    commands,
    description: '',
    features: [],
    language: 'mixed',
  };
}

/**
 * Parse CLAUDE.md content
 */
export function parseClaudeMd(content: string): Partial<ProjectMetadata> {
  const techStack: string[] = [];
  const commands: string[] = [];
  const features: string[] = [];

  // Extract tech stack mentions
  const techPatterns = [
    /next\.?js/gi,
    /react/gi,
    /typescript/gi,
    /python/gi,
    /fastapi/gi,
    /flask/gi,
    /node\.?js/gi,
    /tailwind/gi,
    /postgresql/gi,
    /mongodb/gi,
    /docker/gi,
    /kubernetes/gi,
    /aws/gi,
    /langchain/gi,
    /openai/gi,
    /anthropic/gi,
    /groq/gi,
    /zustand/gi,
    /redux/gi,
    /prisma/gi,
    /drizzle/gi,
    /supabase/gi,
    /firebase/gi,
  ];

  for (const pattern of techPatterns) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      if (match) {
        techStack.push(match[0]);
      }
    }
  }

  // Extract commands from code blocks
  const codeBlockPattern = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  const codeBlocks = Array.from(content.matchAll(codeBlockPattern));

  for (const block of codeBlocks) {
    const lines = block[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith('#') &&
        (trimmed.startsWith('npm ') ||
          trimmed.startsWith('yarn ') ||
          trimmed.startsWith('pnpm ') ||
          trimmed.startsWith('python ') ||
          trimmed.startsWith('poetry ') ||
          trimmed.startsWith('make ') ||
          trimmed.startsWith('docker ') ||
          trimmed.startsWith('curl ') ||
          trimmed.startsWith('./'))
      ) {
        commands.push(trimmed);
      }
    }
  }

  // Extract features from bullet points
  const bulletPattern = /^[-*]\s+\*\*([^*]+)\*\*/gm;
  const bullets = Array.from(content.matchAll(bulletPattern));
  for (const bullet of bullets) {
    features.push(bullet[1].trim());
  }

  // Extract description from first paragraph
  const paragraphs = content.split(/\n\n/);
  let description = '';
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('```') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('*')
    ) {
      description = trimmed.slice(0, 500);
      break;
    }
  }

  // Detect language
  let language: 'typescript' | 'python' | 'swift' | 'mixed' | 'unknown' = 'unknown';
  if (/typescript|next\.?js|react/i.test(content)) language = 'typescript';
  else if (/python|fastapi|flask|django/i.test(content)) language = 'python';
  else if (/swift|swiftui|xcode/i.test(content)) language = 'swift';

  return {
    techStack: Array.from(new Set(techStack.map((t) => t.toLowerCase()))),
    dependencies: [],
    scripts: [],
    commands: Array.from(new Set(commands)).slice(0, 20),
    description,
    features: features.slice(0, 10),
    language,
  };
}

/**
 * Parse README.md content
 */
export function parseReadmeMd(content: string): Partial<ProjectMetadata> {
  // Use similar logic to CLAUDE.md parsing
  return parseClaudeMd(content);
}

/**
 * Merge metadata from multiple sources
 */
export function mergeMetadata(
  ...sources: Partial<ProjectMetadata>[]
): ProjectMetadata {
  const merged: ProjectMetadata = {
    techStack: [],
    dependencies: [],
    scripts: [],
    commands: [],
    description: '',
    features: [],
    language: 'unknown',
  };

  for (const source of sources) {
    if (source.techStack) {
      merged.techStack.push(...source.techStack);
    }
    if (source.dependencies) {
      merged.dependencies.push(...source.dependencies);
    }
    if (source.scripts) {
      merged.scripts.push(...source.scripts);
    }
    if (source.commands) {
      merged.commands.push(...source.commands);
    }
    if (source.features) {
      merged.features.push(...source.features);
    }
    if (source.description && !merged.description) {
      merged.description = source.description;
    }
    if (source.language && source.language !== 'unknown') {
      merged.language = source.language;
    }
    if (source.framework && !merged.framework) {
      merged.framework = source.framework;
    }
  }

  // Deduplicate
  merged.techStack = Array.from(new Set(merged.techStack));
  merged.dependencies = Array.from(new Set(merged.dependencies));
  merged.scripts = Array.from(new Set(merged.scripts));
  merged.commands = Array.from(new Set(merged.commands));
  merged.features = Array.from(new Set(merged.features));

  return merged;
}
