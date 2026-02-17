/**
 * Resume Data Loader
 * Auto-loads all resume data from disk (master template, 22 tailored resumes, context docs).
 * Cached in-memory with file mtime tracking and 5-min TTL.
 */

import fs from 'fs/promises';
import path from 'path';

// ---- Types ----

export interface ExperienceVariation {
  title: string;
  company: string;
  dates: string;
  location: string;
  bullets: string[];
  sourceCompany: string;
}

export interface ProjectVariation {
  name: string;
  description: string;
  bullets: string[];
  sourceCompany: string;
}

export interface ResumeComponents {
  experiences: ExperienceVariation[];
  skills: string[];
  projects: ProjectVariation[];
}

export interface MasterResumeData {
  latex: string;
  components: ResumeComponents;
  deepContext: string;
}

// ---- Cache ----

interface CacheEntry {
  data: MasterResumeData;
  mtimes: Map<string, number>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: CacheEntry | null = null;

// ---- Paths ----

const PROJECT_ROOT = process.cwd();
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'Job_Applications', 'Templates');
const COMPANIES_DIR = path.join(PROJECT_ROOT, 'Job_Applications', 'Companies');
const RESUME_CONTEXT_PATH = path.join(PROJECT_ROOT, 'docs', 'RESUME_CONTEXT.md');
const MASTER_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'master-template.tex');

// ---- Main loader ----

export async function loadMasterResume(): Promise<MasterResumeData> {
  // Check cache validity
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    const valid = await isCacheValid(cache.mtimes);
    if (valid) return cache.data;
  }

  const [latex, tailoredResumes, deepContext] = await Promise.all([
    parseMasterTemplate(),
    parseTailoredResumes(),
    parseResumeContext(),
  ]);

  // Extract components from master template + all tailored resumes
  const masterComponents = extractResumeComponents(latex, 'master');
  const allExperiences = [...masterComponents.experiences];
  const allSkills = new Set(masterComponents.skills);
  const allProjects = [...masterComponents.projects];

  for (const { sourceCompany, latex: resumeLatex } of tailoredResumes) {
    const components = extractResumeComponents(resumeLatex, sourceCompany);
    allExperiences.push(...components.experiences);
    components.skills.forEach((s) => allSkills.add(s));
    allProjects.push(...components.projects);
  }

  const data: MasterResumeData = {
    latex,
    components: {
      experiences: allExperiences,
      skills: Array.from(allSkills),
      projects: allProjects,
    },
    deepContext,
  };

  // Build mtime map for cache invalidation
  const mtimes = new Map<string, number>();
  try {
    const masterStat = await fs.stat(MASTER_TEMPLATE_PATH);
    mtimes.set(MASTER_TEMPLATE_PATH, masterStat.mtimeMs);
  } catch { /* file may not exist */ }

  cache = { data, mtimes, timestamp: Date.now() };
  return data;
}

/**
 * Get a simplified resume data object for the agent tools
 * (backward-compatible with the old masterResumeData shape)
 */
export async function loadResumeForAgent(): Promise<{
  latex: string;
  resumeData: { experiences: string[]; skills: string[]; projects: string[] };
  deepContext: string;
}> {
  const master = await loadMasterResume();
  return {
    latex: master.latex,
    resumeData: {
      experiences: master.components.experiences.flatMap((e) => e.bullets),
      skills: master.components.skills,
      projects: master.components.projects.flatMap((p) => p.bullets),
    },
    deepContext: master.deepContext,
  };
}

// ---- Parsers ----

async function parseMasterTemplate(): Promise<string> {
  try {
    return await fs.readFile(MASTER_TEMPLATE_PATH, 'utf-8');
  } catch {
    console.warn('[resume-loader] Master template not found at', MASTER_TEMPLATE_PATH);
    return '';
  }
}

interface TailoredResume {
  sourceCompany: string;
  filePath: string;
  latex: string;
}

async function parseTailoredResumes(): Promise<TailoredResume[]> {
  const resumes: TailoredResume[] = [];

  try {
    const companyDirs = await fs.readdir(COMPANIES_DIR, { withFileTypes: true });

    for (const dir of companyDirs) {
      if (!dir.isDirectory()) continue;

      const companyPath = path.join(COMPANIES_DIR, dir.name);
      const files = await fs.readdir(companyPath);

      for (const file of files) {
        if (!file.endsWith('.tex') || file.includes('Cover_Letter')) continue;

        const filePath = path.join(companyPath, file);
        try {
          const latex = await fs.readFile(filePath, 'utf-8');
          resumes.push({
            sourceCompany: dir.name,
            filePath,
            latex,
          });
        } catch {
          console.warn(`[resume-loader] Failed to read ${filePath}`);
        }
      }
    }
  } catch {
    console.warn('[resume-loader] Companies directory not found at', COMPANIES_DIR);
  }

  return resumes;
}

async function parseResumeContext(): Promise<string> {
  try {
    return await fs.readFile(RESUME_CONTEXT_PATH, 'utf-8');
  } catch {
    console.warn('[resume-loader] RESUME_CONTEXT.md not found');
    return '';
  }
}

// ---- LaTeX Parsing ----

export function extractResumeComponents(
  latex: string,
  sourceCompany: string
): { experiences: ExperienceVariation[]; skills: string[]; projects: ProjectVariation[] } {
  const experiences = parseExperiences(latex, sourceCompany);
  const skills = parseSkills(latex);
  const projects = parseProjects(latex, sourceCompany);

  return { experiences, skills, projects };
}

function parseExperiences(latex: string, sourceCompany: string): ExperienceVariation[] {
  const experiences: ExperienceVariation[] = [];

  // Match \resumeSubheading{title}{dates}{company}{location} — handles multi-line format
  const subheadingRegex = /\\resumeSubheading\s*\n?\s*\{([^}]*)\}\{([^}]*)\}\s*\n?\s*\{([^}]*)\}\{([^}]*)\}/g;
  let match;

  while ((match = subheadingRegex.exec(latex)) !== null) {
    const [, title, dates, company, location] = match;
    const startPos = match.index + match[0].length;

    // Find bullets between this subheading and the next one (or section end)
    const nextSubheading = latex.indexOf('\\resumeSubheading', startPos);
    const nextSection = latex.indexOf('\\section', startPos);
    const endPos = Math.min(
      nextSubheading === -1 ? latex.length : nextSubheading,
      nextSection === -1 ? latex.length : nextSection
    );

    const bulletSection = latex.substring(startPos, endPos);
    const bullets = parseBullets(bulletSection);

    if (bullets.length > 0) {
      experiences.push({
        title: stripLatex(title),
        company: stripLatex(company),
        dates: stripLatex(dates),
        location: stripLatex(location),
        bullets,
        sourceCompany,
      });
    }
  }

  return experiences;
}

/**
 * Find a \section{...KEYWORD...} and return the text between it and the next \section.
 * Handles nested braces like \section{\textcolor{metablue}{TECHNICAL SKILLS}}.
 * Skips comment lines that happen to contain the keyword.
 */
function extractSection(latex: string, keyword: string): string {
  // Find all \section{ positions
  const sectionPositions: number[] = [];
  let searchPos = 0;
  while (true) {
    const pos = latex.indexOf('\\section{', searchPos);
    if (pos === -1) break;
    sectionPositions.push(pos);
    searchPos = pos + 1;
  }

  // Find which \section contains our keyword (look at the text between this \section and next)
  for (let i = 0; i < sectionPositions.length; i++) {
    const start = sectionPositions[i];
    const nextStart = sectionPositions[i + 1] ?? latex.length;
    const sectionContent = latex.substring(start, nextStart);

    // Check if this section's header line contains the keyword (not in a comment)
    const headerEnd = sectionContent.indexOf('\n', sectionContent.indexOf('}'));
    const headerText = sectionContent.substring(0, headerEnd === -1 ? 100 : headerEnd);

    if (headerText.includes(keyword)) {
      // Return content after the header line until the next \section
      const contentStart = start + (headerEnd === -1 ? headerText.length : headerEnd);
      return latex.substring(contentStart, nextStart);
    }
  }

  return '';
}

function parseSkills(latex: string): string[] {
  const skills: string[] = [];

  // Match \resumeItem{\textbf{Category:} skill1, skill2, ...} — handles nested braces in skill values
  const skillRegex = /\\resumeItem\{\\textbf\{([^}]+):?\}\s*((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
  let match;

  // Only parse within TECHNICAL SKILLS section
  const skillsSection = extractSection(latex, 'TECHNICAL SKILLS');
  if (!skillsSection) return skills;

  while ((match = skillRegex.exec(skillsSection)) !== null) {
    const category = stripLatex(match[1]).replace(/:$/, '');
    const items = stripLatex(match[2]);
    // Split by commas that are NOT inside parentheses
    const individualSkills: string[] = [];
    let current = '';
    let parenDepth = 0;
    for (const char of items) {
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed.length > 0) individualSkills.push(trimmed);
        current = '';
        continue;
      }
      current += char;
    }
    const lastTrimmed = current.trim();
    if (lastTrimmed.length > 0) individualSkills.push(lastTrimmed);

    for (const skill of individualSkills) {
      skills.push(`${category}: ${skill}`);
    }
  }

  return skills;
}

function parseProjects(latex: string, sourceCompany: string): ProjectVariation[] {
  const projects: ProjectVariation[] = [];

  // Find projects section using proper \section{} detection (skips comments)
  const projectsSection = extractSection(latex, 'PROJECTS');
  if (!projectsSection) return projects;

  // Parse \resumeItem{\textbf{Project Name} [optional \href{}{}] --- description}
  // Handles ---, --, —, – separators and optional \href before separator
  const projectRegex = /\\resumeItem\{\\textbf\{([^}]+)\}\s*(?:\\href\{[^}]*\}\{[^}]*\}\s*)?(?:---|--|—|–)\s*((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
  let match;

  while ((match = projectRegex.exec(projectsSection)) !== null) {
    const name = stripLatex(match[1]);
    const content = stripLatex(match[2]);

    projects.push({
      name,
      description: content.substring(0, 200),
      bullets: [content],
      sourceCompany,
    });
  }

  // Also try simple bullet items in projects section
  const simpleBullets = parseBullets(projectsSection);
  if (simpleBullets.length > 0 && projects.length === 0) {
    projects.push({
      name: 'Projects',
      description: simpleBullets[0].substring(0, 200),
      bullets: simpleBullets,
      sourceCompany,
    });
  }

  return projects;
}

function parseBullets(latex: string): string[] {
  const bullets: string[] = [];
  // Match \resumeItem{...} accounting for up to 2 levels of nested braces
  const bulletRegex = /\\resumeItem\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
  let match;

  while ((match = bulletRegex.exec(latex)) !== null) {
    const cleaned = stripLatex(match[1]).trim();
    if (cleaned.length > 10) {
      bullets.push(cleaned);
    }
  }

  return bullets;
}

function stripLatex(text: string): string {
  let result = text;
  // Run multiple passes to handle nested commands like \textbf{\textit{...}}
  for (let i = 0; i < 3; i++) {
    result = result
      .replace(/\\textbf\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\textit\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\textcolor\{[^}]*\}\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\href\{[^}]*\}\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\emph\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1');
  }
  return result
    .replace(/\\small\s*/g, '')
    .replace(/\\footnotesize\s*/g, '')
    .replace(/\\noindent\s*/g, '')
    .replace(/\\vspace\{[^}]*\}/g, '')
    .replace(/\\hfill/g, '')
    .replace(/\\\\(\[[-\d]+pt\])?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Cache helpers ----

async function isCacheValid(mtimes: Map<string, number>): Promise<boolean> {
  for (const [filePath, mtime] of mtimes) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs !== mtime) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * List all tailored resume file paths for indexing
 */
export async function listTailoredResumePaths(): Promise<string[]> {
  const paths: string[] = [];
  try {
    const companyDirs = await fs.readdir(COMPANIES_DIR, { withFileTypes: true });
    for (const dir of companyDirs) {
      if (!dir.isDirectory()) continue;
      const companyPath = path.join(COMPANIES_DIR, dir.name);
      const files = await fs.readdir(companyPath);
      for (const file of files) {
        if (file.endsWith('.tex') && !file.includes('Cover_Letter')) {
          paths.push(path.join(companyPath, file));
        }
      }
    }
  } catch { /* directory may not exist */ }
  return paths;
}
