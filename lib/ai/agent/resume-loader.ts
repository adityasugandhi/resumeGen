/**
 * Resume Data Loader
 * Auto-loads all resume data from disk (master template, 22 tailored resumes, context docs).
 * Cached in-memory with file mtime tracking and 5-min TTL.
 */

import fs from 'fs/promises';
import path from 'path';
import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import { cosineSimilarity } from '@/lib/ai/semantic-matcher';

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
  // Auto-detect and fix double-escaped LaTeX (single-line files with literal \n and \\)
  const normalizedLatex = unescapeLatexIfNeeded(latex);

  const experiences = parseExperiences(normalizedLatex, sourceCompany);
  const skills = parseSkills(normalizedLatex);
  const projects = parseProjects(normalizedLatex, sourceCompany);

  return { experiences, skills, projects };
}

/**
 * Detect and fix double-escaped LaTeX content.
 * Some .tex files were saved with JSON-escaped content (\\n instead of newlines, \\\\ instead of \\).
 * This heuristic detects and unescapes them so the parser works on both formats.
 */
function unescapeLatexIfNeeded(latex: string): string {
  // Heuristic: if the file has \\documentclass (double backslash) and literal \n sequences
  // but no actual newlines, it's double-escaped
  const hasRealNewlines = latex.includes('\n');
  const hasLiteralEscapedNewlines = latex.includes('\\n');
  const hasDoubleBackslash = latex.includes('\\\\documentclass');

  if (hasDoubleBackslash && hasLiteralEscapedNewlines && !hasRealNewlines) {
    return latex
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
  }

  return latex;
}

function parseExperiences(latex: string, sourceCompany: string): ExperienceVariation[] {
  const experiences: ExperienceVariation[] = [];

  // Only parse within the WORK EXPERIENCE section to avoid picking up Education subheadings
  const experienceSection = extractSection(latex, 'WORK EXPERIENCE') || extractSection(latex, 'EXPERIENCE');
  if (!experienceSection) return experiences;

  // Match \resumeSubheading{title}{dates}{company}{location} — handles multi-line format
  const subheadingRegex = /\\resumeSubheading\s*\n?\s*\{([^}]*)\}\{([^}]*)\}\s*\n?\s*\{([^}]*)\}\{([^}]*)\}/g;
  let match;

  while ((match = subheadingRegex.exec(experienceSection)) !== null) {
    const [, title, dates, company, location] = match;
    const startPos = match.index + match[0].length;

    // Find bullets between this subheading and the next one (or section end)
    const nextSubheading = experienceSection.indexOf('\\resumeSubheading', startPos);
    const endPos = nextSubheading === -1 ? experienceSection.length : nextSubheading;

    const bulletSection = experienceSection.substring(startPos, endPos);
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

/**
 * Deep-strip LaTeX to plain text for embedding generation.
 * Removes preamble, commands, environments, and LaTeX syntax — keeps only human-readable content.
 */
function stripLatexDeep(latex: string): string {
  // Auto-unescape if double-escaped
  let text = unescapeLatexIfNeeded(latex);

  // Remove everything before \begin{document}
  const docStart = text.indexOf('\\begin{document}');
  text = docStart !== -1 ? text.substring(docStart + 16) : text;

  // Remove \end{document}
  text = text.replace(/\\end\{document\}/g, '');

  // Strip LaTeX commands progressively (deepest nesting first)
  for (let i = 0; i < 3; i++) {
    text = text
      .replace(/\\textbf\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\textit\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\textcolor\{[^}]*\}\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\href\{[^}]*\}\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1')
      .replace(/\\emph\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '$1');
  }

  // Remove remaining commands and syntax
  text = text
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, ' ')  // \command{arg}
    .replace(/\\[a-zA-Z]+\[[^\]]*\]/g, ' ')  // \command[opt]
    .replace(/\\[a-zA-Z]+/g, ' ')             // \command
    .replace(/[{}%\\]/g, ' ')                 // braces, percent, backslash
    .replace(/\s+/g, ' ')
    .trim();

  return text;
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

// ---- Embedding cache for semantic base resume selection ----
const embeddingCache = new Map<string, { vec: number[]; mtime: number }>();

// Placeholder patterns that indicate fabricated or incomplete content
const PLACEHOLDER_PATTERNS = ['ABC Company', 'XYZ Corp', 'Lorem ipsum', 'PLACEHOLDER', 'Company Name Here', 'Your Name'];

/**
 * Select the best existing tailored resume as a base for optimization.
 * Uses semantic embedding similarity (primary) + keyword overlap (bonus).
 * Includes quality guards to reject resumes with fabricated content.
 * Falls back to master template if no good match (threshold 0.35).
 */
export async function selectBestBaseResume(
  jobRequirements: string[],
  jobTitle: string,
  excludeCompany?: string
): Promise<{ latex: string; sourceCompany: string; semanticScore?: number; keywordScore?: number }> {
  const candidates: {
    sourceCompany: string;
    filePath: string;
    latex: string;
    semanticScore: number;
    keywordScore: number;
    totalScore: number;
  }[] = [];

  // Build query text for embedding
  const queryText = `${jobTitle} ${jobRequirements.slice(0, 10).join(' ')}`;

  // Build keyword set for bonus scoring
  const requirementKeywords = new Set<string>();
  for (const req of jobRequirements) {
    for (const word of req.toLowerCase().split(/\W+/)) {
      if (word.length > 2) requirementKeywords.add(word);
    }
  }
  for (const word of jobTitle.toLowerCase().split(/\W+/)) {
    if (word.length > 2) requirementKeywords.add(word);
  }

  // Generate query embedding
  let queryVec: number[];
  try {
    queryVec = await generateQueryEmbedding(queryText);
  } catch (embErr) {
    console.warn('[resume-loader] Embedding generation failed, falling back to keyword-only:', embErr);
    return selectBestBaseResumeKeywordFallback(jobRequirements, jobTitle, excludeCompany);
  }

  try {
    const companyDirs = await fs.readdir(COMPANIES_DIR, { withFileTypes: true });

    for (const dir of companyDirs) {
      if (!dir.isDirectory()) continue;
      // Normalize for comparison: "Verse Medical" matches "Verse_Medical"
      const normalizedDir = dir.name.toLowerCase().replace(/[_\-\s]+/g, '');
      const normalizedExclude = excludeCompany?.toLowerCase().replace(/[_\-\s]+/g, '') ?? '';
      if (excludeCompany && normalizedDir === normalizedExclude) continue;

      const companyPath = path.join(COMPANIES_DIR, dir.name);
      const files = await fs.readdir(companyPath);

      for (const file of files) {
        if (!file.endsWith('.tex') || file.includes('Cover_Letter')) continue;

        const filePath = path.join(companyPath, file);
        try {
          const stat = await fs.stat(filePath);
          const latex = await fs.readFile(filePath, 'utf-8');

          // Quality guard: skip skeletons
          if (latex.includes('%%% CONTENT HERE %%%') || latex.length < 2000) continue;

          // Quality guard: skip resumes with placeholder/fabricated content
          if (PLACEHOLDER_PATTERNS.some(p => latex.includes(p))) {
            console.warn(`[resume-loader] Skipping ${dir.name}/${file} — contains placeholder pattern`);
            continue;
          }

          // Quality guard: must have at least 3 experience bullets
          const components = extractResumeComponents(latex, dir.name);
          const totalBullets = components.experiences.reduce((sum, e) => sum + e.bullets.length, 0);
          if (totalBullets < 3) {
            console.warn(`[resume-loader] Skipping ${dir.name}/${file} — only ${totalBullets} bullets`);
            continue;
          }

          // Get or compute resume embedding (cached by file path + mtime)
          let resumeVec: number[];
          const cached = embeddingCache.get(filePath);
          if (cached && cached.mtime === stat.mtimeMs) {
            resumeVec = cached.vec;
          } else {
            // Deep-strip LaTeX to plain text for better embeddings
            const plainText = stripLatexDeep(latex);
            resumeVec = await generateQueryEmbedding(plainText.substring(0, 1500));
            embeddingCache.set(filePath, { vec: resumeVec, mtime: stat.mtimeMs });
          }

          // Primary: semantic similarity (0-1)
          const semanticScore = cosineSimilarity(queryVec, resumeVec);

          // Bonus: keyword overlap (0-0.05 range)
          const lowerLatex = latex.toLowerCase();
          let keywordHits = 0;
          for (const keyword of requirementKeywords) {
            if (lowerLatex.includes(keyword)) keywordHits++;
          }
          const keywordScore = requirementKeywords.size > 0
            ? 0.05 * (keywordHits / requirementKeywords.size)
            : 0;

          const totalScore = semanticScore + keywordScore;

          candidates.push({
            sourceCompany: dir.name,
            filePath,
            latex,
            semanticScore,
            keywordScore,
            totalScore,
          });
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    console.warn('[resume-loader] Companies directory not found for base resume selection');
  }

  if (candidates.length === 0) {
    const masterLatex = await parseMasterTemplate();
    return { latex: masterLatex, sourceCompany: 'master' };
  }

  // Sort by total score descending
  candidates.sort((a, b) => b.totalScore - a.totalScore);

  const best = candidates[0];

  // Minimum threshold: if best semantic score < 0.35, use master template
  if (best.semanticScore < 0.35) {
    console.log(
      `[resume-loader] Best candidate ${best.sourceCompany} scored ${best.semanticScore.toFixed(3)} (below 0.35 threshold) — using master template`
    );
    const masterLatex = await parseMasterTemplate();
    return { latex: masterLatex, sourceCompany: 'master', semanticScore: best.semanticScore };
  }

  console.log(
    `[resume-loader] Best base resume: ${best.sourceCompany} (semantic: ${best.semanticScore.toFixed(3)}, keyword: ${best.keywordScore.toFixed(3)}, total: ${best.totalScore.toFixed(3)})`
  );

  return {
    latex: best.latex,
    sourceCompany: best.sourceCompany,
    semanticScore: best.semanticScore,
    keywordScore: best.keywordScore,
  };
}

/**
 * Keyword-only fallback for selectBestBaseResume when embeddings fail.
 */
async function selectBestBaseResumeKeywordFallback(
  jobRequirements: string[],
  jobTitle: string,
  excludeCompany?: string
): Promise<{ latex: string; sourceCompany: string }> {
  const resumes: { sourceCompany: string; latex: string; score: number }[] = [];

  const requirementKeywords = new Set<string>();
  for (const req of jobRequirements) {
    for (const word of req.toLowerCase().split(/\W+/)) {
      if (word.length > 2) requirementKeywords.add(word);
    }
  }
  for (const word of jobTitle.toLowerCase().split(/\W+/)) {
    if (word.length > 2) requirementKeywords.add(word);
  }

  try {
    const companyDirs = await fs.readdir(COMPANIES_DIR, { withFileTypes: true });
    for (const dir of companyDirs) {
      if (!dir.isDirectory()) continue;
      const nDir = dir.name.toLowerCase().replace(/[_\-\s]+/g, '');
      const nExclude = excludeCompany?.toLowerCase().replace(/[_\-\s]+/g, '') ?? '';
      if (excludeCompany && nDir === nExclude) continue;

      const companyPath = path.join(COMPANIES_DIR, dir.name);
      const files = await fs.readdir(companyPath);

      for (const file of files) {
        if (!file.endsWith('.tex') || file.includes('Cover_Letter')) continue;
        const filePath = path.join(companyPath, file);
        try {
          const latex = await fs.readFile(filePath, 'utf-8');
          if (latex.includes('%%% CONTENT HERE %%%') || latex.length < 2000) continue;
          if (PLACEHOLDER_PATTERNS.some(p => latex.includes(p))) continue;

          const lowerLatex = latex.toLowerCase();
          let score = 0;
          for (const keyword of requirementKeywords) {
            if (lowerLatex.includes(keyword)) score++;
          }
          resumes.push({ sourceCompany: dir.name, latex, score });
        } catch { /* skip */ }
      }
    }
  } catch {
    console.warn('[resume-loader] Companies directory not found');
  }

  if (resumes.length === 0) {
    const masterLatex = await parseMasterTemplate();
    return { latex: masterLatex, sourceCompany: 'master' };
  }

  resumes.sort((a, b) => b.score - a.score);
  console.log(`[resume-loader] Keyword fallback — best: ${resumes[0].sourceCompany} (${resumes[0].score}/${requirementKeywords.size})`);
  return { latex: resumes[0].latex, sourceCompany: resumes[0].sourceCompany };
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
