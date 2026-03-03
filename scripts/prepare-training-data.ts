/**
 * prepare-training-data.ts
 *
 * Extracts tailored LaTeX resumes from Job_Applications/Companies/
 * and pairs them with job descriptions from PostgreSQL + LanceDB
 * to produce instruction-tuning JSONL for fine-tuning a resume LLM.
 *
 * ANTI-HALLUCINATION DESIGN:
 * Every training example includes a "Personal Facts" grounding block with
 * real identity, work history, education, and publications. The model learns
 * to ONLY use these facts and never invent names, companies, or credentials.
 *
 * Usage:
 *   npx tsx scripts/prepare-training-data.ts
 *   npx tsx scripts/prepare-training-data.ts --augment   # include section-level pairs
 *   npx tsx scripts/prepare-training-data.ts --dry-run   # preview without writing
 */

import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { jobPostings } from '@/lib/db/schema';

// ── Types ──────────────────────────────────────────────────────────────────

interface TrainingExample {
  instruction: string;
  input: string;
  output: string;
  metadata: {
    company: string;
    jobTitle: string;
    source: 'full_resume' | 'section_augmented' | 'db_paired';
  };
}

interface ResumeFile {
  company: string;
  jobTitle: string;
  filePath: string;
  latex: string;
}

interface JobRecord {
  title: string;
  company: string;
  description: string | null;
  requirements: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const COMPANIES_DIR = path.resolve('Job_Applications/Companies');
const MASTER_TEMPLATE_PATH = path.resolve('Job_Applications/Templates/master-template.tex');
const RESUME_CONTEXT_PATH = path.resolve('docs/RESUME_CONTEXT.md');
const OUTPUT_DIR = path.resolve('training-data');
const TRAIN_FILE = path.join(OUTPUT_DIR, 'train.jsonl');
const VAL_FILE = path.join(OUTPUT_DIR, 'val.jsonl');
const STATS_FILE = path.join(OUTPUT_DIR, 'stats.json');

const VAL_SPLIT_RATIO = 0.15;

// ── Personal Facts Block (GROUNDING — prevents hallucination) ─────────────
// This block is included in EVERY training example so the model learns
// these are the ONLY facts it can use. It must never invent others.

const PERSONAL_FACTS = `=== PERSONAL FACTS (use ONLY these — never invent) ===
Name: Aditya Sugandhi
Phone: +1 448 500 6857
Email: adityasugandhi.work@outlook.com
GitHub: https://github.com/adityasugandhi
Website: https://adityasugandhi.com
Location: Tallahassee, FL (open to relocation)

WORK HISTORY (use ONLY these companies and titles):
1. Software Engineer II | Florida State University | Nov 2024 – Present | Tallahassee, FL
   - IoT management platform, 35K+ devices, 172+ networks, 10K+ users
   - React.js frontend, Python/FastAPI backend, 37 REST/gRPC APIs
   - Event-driven microservices (AWS Lambda, SQS, SNS)
   - CI/CD with GitHub Actions, Docker, CloudFormation
   - AI-assisted development (Claude Code, GitHub Copilot)

2. Systems Engineer | Aspire Systems | Jan 2021 – Jul 2023 | Chennai, India
   - Distributed utility asset management platform
   - Java/Spring Boot microservices, Apache Kafka, Kubernetes
   - 500K+ IoT sensors, 5M+ telemetry events/day, 99.99% availability
   - gRPC migration (84% latency improvement), PostgreSQL sharding
   - Event-driven architecture, compliance monitoring with OPA

3. Associate Software Engineer | Aspire Systems | Jun 2019 – Jan 2021 | Chennai, India
   - Early career role, same platform, grew into Systems Engineer

EDUCATION (use ONLY these):
1. M.S. Computer Science | Florida State University | Tallahassee, FL
   - Advisor: Prof. Olmo Zavala Romero
2. B.Tech Computer Science | SRM Institute of Science and Technology | Chennai, India

PUBLICATIONS & AWARDS (use ONLY these):
- Review Classification & False Feedback Detection (IJAST)
- 2nd Place, SRM University Hackathon (2019)
- AWS Solutions Architect Course (Udemy, 2024)

REAL PROJECTS (use for Projects section):
- AI-Powered Resume Platform: Next.js 14, Claude Sonnet, LanceDB vector memory, 11 autonomous tools, LaTeX compilation
- Utility Digital Twin Platform: Java, Kafka, InfluxDB, 50M events/day, real-time anomaly detection
- BookedFlow Slack Bot: Node.js, Slack API, Socket Mode, OAuth 2.0, PM2, AWS EC2
- Building Information Portal: Role-based access, multi-criteria search, 14.6M+ sq ft, 10K+ users
- SkillSync MCP: TypeScript MCP server, 60+ threat patterns, 8 IDE integrations, npm published
=== END PERSONAL FACTS ===`;

// ── Anti-Hallucination Instruction (prepended to every instruction) ────────

const GROUNDING_RULES = `CRITICAL RULES:
- Use ONLY the personal facts provided below. NEVER invent names, companies, degrees, dates, or credentials.
- The candidate is Aditya Sugandhi. Do not use any other name.
- Work history has ONLY: Florida State University and Aspire Systems. No other employers.
- Education has ONLY: M.S. from FSU and B.Tech from SRM Institute. No other degrees.
- You may rephrase bullets, reorder sections, add keywords, and adjust emphasis — but ALL facts must come from the provided context.
- Use the master LaTeX template format: Charter font, 10pt, blue (metablue) section rules, 0.225in margins.
- Every bullet follows: Action Verb + System/Tool + Scale + Metric + Business Impact.`;

// ── Helpers ────────────────────────────────────────────────────────────────

function parseFileNameToJobTitle(fileName: string): string {
  const base = path.basename(fileName, '.tex');
  const segments = base.split('__');

  if (segments.length >= 3) {
    const titleParts = segments.slice(1).map(s => s.replace(/_/g, ' '));
    return titleParts.join(' - ').trim();
  }

  if (segments.length === 2) {
    const firstPart = segments[0].replace(/_/g, ' ');
    const secondPart = segments[1].replace(/_/g, ' ');
    return `${firstPart}, ${secondPart}`.trim();
  }

  const parts = base.split('_');
  return parts.slice(1).join(' ');
}

function extractSections(latex: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const sectionRegex = /\\section\{(?:\\textcolor\{[^}]+\}\{)?([^}]+)\}?\}([\s\S]*?)(?=\\section\{|\\end\{document\})/g;
  let match;
  while ((match = sectionRegex.exec(latex)) !== null) {
    const name = match[1].trim();
    const content = match[2].trim();
    if (content.length > 50) {
      sections[name] = content;
    }
  }
  return sections;
}

function normalizeCompanyName(dirName: string): string {
  return dirName.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
}

// ── Data Loading ───────────────────────────────────────────────────────────

function loadMasterTemplate(): string {
  try {
    return fs.readFileSync(MASTER_TEMPLATE_PATH, 'utf-8');
  } catch {
    console.warn('master-template.tex not found');
    return '';
  }
}

function loadCareerContext(): string {
  try {
    return fs.readFileSync(RESUME_CONTEXT_PATH, 'utf-8');
  } catch {
    console.warn('RESUME_CONTEXT.md not found');
    return '';
  }
}

function loadResumeFiles(): ResumeFile[] {
  const resumes: ResumeFile[] = [];

  if (!fs.existsSync(COMPANIES_DIR)) {
    console.error(`Companies directory not found: ${COMPANIES_DIR}`);
    return resumes;
  }

  const companyDirs = fs.readdirSync(COMPANIES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of companyDirs) {
    const companyPath = path.join(COMPANIES_DIR, dir);
    const texFiles = fs.readdirSync(companyPath).filter(f => f.endsWith('.tex'));

    for (const texFile of texFiles) {
      const filePath = path.join(companyPath, texFile);
      const latex = fs.readFileSync(filePath, 'utf-8');

      if (latex.length < 500 || !latex.includes('\\documentclass')) continue;

      resumes.push({
        company: normalizeCompanyName(dir),
        jobTitle: parseFileNameToJobTitle(texFile),
        filePath,
        latex,
      });
    }
  }

  return resumes;
}

async function loadJobDescriptionsFromDB(): Promise<Map<string, JobRecord>> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('DATABASE_URL not set — skipping DB job descriptions');
    return new Map();
  }

  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool);

  try {
    const jobs = await db.select({
      title: jobPostings.title,
      company: jobPostings.company,
      description: jobPostings.description,
      requirements: jobPostings.requirements,
    }).from(jobPostings);

    const jobMap = new Map<string, JobRecord>();
    for (const job of jobs) {
      const key = `${job.company}::${job.title}`.toLowerCase();
      jobMap.set(key, {
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: (job.requirements as string[]) || [],
      });
    }

    console.log(`Loaded ${jobMap.size} job descriptions from PostgreSQL`);
    return jobMap;
  } catch (err) {
    console.warn('Failed to load job descriptions from DB:', err);
    return new Map();
  } finally {
    await pool.end();
  }
}

function findJobDescription(
  resume: ResumeFile,
  jobMap: Map<string, JobRecord>
): JobRecord | null {
  const exactKey = `${resume.company}::${resume.jobTitle}`.toLowerCase();
  if (jobMap.has(exactKey)) return jobMap.get(exactKey)!;

  for (const [, job] of jobMap) {
    if (fuzzyMatch(job.company, resume.company) && fuzzyMatch(job.title, resume.jobTitle)) {
      return job;
    }
  }

  for (const [, job] of jobMap) {
    if (fuzzyMatch(job.company, resume.company)) {
      return job;
    }
  }

  return null;
}

// ── Training Pair Construction ─────────────────────────────────────────────

function createFullResumeExamples(
  resumes: ResumeFile[],
  jobMap: Map<string, JobRecord>,
  masterTemplate: string,
  careerContext: string
): TrainingExample[] {
  const examples: TrainingExample[] = [];

  // Trim career context to keep token count manageable
  const trimmedContext = careerContext.substring(0, 3000);

  for (const resume of resumes) {
    const job = findJobDescription(resume, jobMap);

    // ── Instruction: what the model should do ──
    let instruction = `${GROUNDING_RULES}\n\n`;

    if (job?.description) {
      instruction += `Tailor a complete LaTeX resume for Aditya Sugandhi targeting a ${resume.jobTitle} position at ${resume.company}.\n\nJob Description:\n${job.description}`;
    } else {
      instruction += `Generate a complete LaTeX resume for Aditya Sugandhi targeting a ${resume.jobTitle} position at ${resume.company}. Optimize bullet points, keywords, and section ordering for this role.`;
    }

    // ── Input: all grounding context ──
    const inputParts = [
      PERSONAL_FACTS,
    ];

    if (job?.requirements && job.requirements.length > 0) {
      inputParts.push(`Key Requirements:\n${job.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
    }

    inputParts.push(`Master LaTeX Template:\n\`\`\`latex\n${masterTemplate}\n\`\`\``);
    inputParts.push(`Career Deep-Dive Context:\n${trimmedContext}`);

    examples.push({
      instruction,
      input: inputParts.join('\n\n'),
      output: resume.latex,
      metadata: {
        company: resume.company,
        jobTitle: resume.jobTitle,
        source: job?.description ? 'db_paired' : 'full_resume',
      },
    });
  }

  return examples;
}

function createSectionExamples(
  resumes: ResumeFile[],
  jobMap: Map<string, JobRecord>
): TrainingExample[] {
  const examples: TrainingExample[] = [];
  const sectionTypes = ['WORK EXPERIENCE', 'PROJECTS', 'TECHNICAL SKILLS', 'SUMMARY'];
  const sectionSearchTerms: Record<string, string> = {
    'WORK EXPERIENCE': 'experience',
    'PROJECTS': 'project',
    'TECHNICAL SKILLS': 'technical skills',
    'SUMMARY': 'summary',
  };

  for (const resume of resumes) {
    const sections = extractSections(resume.latex);
    const job = findJobDescription(resume, jobMap);

    for (const sectionName of sectionTypes) {
      const searchTerm = sectionSearchTerms[sectionName];
      const matchedKey = Object.keys(sections).find(
        k => k.toLowerCase().includes(searchTerm)
      );

      if (!matchedKey) continue;

      const sectionContent = sections[matchedKey];

      // Section-level examples ALSO get grounded with personal facts
      const instruction = `${GROUNDING_RULES}\n\nWrite the ${sectionName} section (LaTeX) for Aditya Sugandhi's resume, tailored for a ${resume.jobTitle} position at ${resume.company}.${
        job?.requirements?.length
          ? `\n\nKey Requirements: ${job.requirements.slice(0, 8).join(', ')}`
          : ''
      }`;

      examples.push({
        instruction,
        input: PERSONAL_FACTS,
        output: sectionContent,
        metadata: {
          company: resume.company,
          jobTitle: resume.jobTitle,
          source: 'section_augmented',
        },
      });
    }
  }

  return examples;
}

// ── Output ─────────────────────────────────────────────────────────────────

function writeJSONL(examples: TrainingExample[], filePath: string): void {
  const lines = examples.map(ex => JSON.stringify({
    instruction: ex.instruction,
    input: ex.input,
    output: ex.output,
  }));
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const augment = args.includes('--augment');
  const dryRun = args.includes('--dry-run');

  console.log('=== Resume Training Data Preparation (Anti-Hallucination v2) ===\n');

  // 1. Load all sources
  console.log('Loading data sources...');
  const resumes = loadResumeFiles();
  const masterTemplate = loadMasterTemplate();
  const careerContext = loadCareerContext();
  const jobMap = await loadJobDescriptionsFromDB();

  console.log(`  Resumes: ${resumes.length} across ${new Set(resumes.map(r => r.company)).size} companies`);
  console.log(`  Master template: ${masterTemplate.length} chars`);
  console.log(`  Career context: ${careerContext.length} chars`);
  console.log(`  Personal facts block: ${PERSONAL_FACTS.length} chars\n`);

  if (resumes.length === 0) {
    console.error('No resume files found.');
    process.exit(1);
  }

  // 2. Build training examples
  console.log('Building grounded training examples...');
  const fullExamples = createFullResumeExamples(resumes, jobMap, masterTemplate, careerContext);

  const dbPaired = fullExamples.filter(e => e.metadata.source === 'db_paired').length;
  console.log(`  Full resume examples: ${fullExamples.length} (${dbPaired} with job descriptions)`);

  let allExamples = [...fullExamples];

  if (augment) {
    const sectionExamples = createSectionExamples(resumes, jobMap);
    console.log(`  Section-level examples: ${sectionExamples.length}`);
    allExamples = [...allExamples, ...sectionExamples];
  }

  console.log(`\nTotal training examples: ${allExamples.length}`);
  console.log(`Every example includes: personal facts + grounding rules\n`);

  // 3. Split train/val
  const shuffled = shuffleArray(allExamples);
  const valCount = Math.max(1, Math.round(shuffled.length * VAL_SPLIT_RATIO));
  const valExamples = shuffled.slice(0, valCount);
  const trainExamples = shuffled.slice(valCount);

  console.log(`Train: ${trainExamples.length} examples`);
  console.log(`Validation: ${valExamples.length} examples\n`);

  if (dryRun) {
    console.log('=== DRY RUN — Preview (first full resume example) ===\n');
    const fullEx = allExamples.find(e => e.metadata.source !== 'section_augmented')!;
    console.log(`Company: ${fullEx.metadata.company}`);
    console.log(`Job: ${fullEx.metadata.jobTitle}`);
    console.log(`\n--- INSTRUCTION (first 500 chars) ---`);
    console.log(fullEx.instruction.substring(0, 500));
    console.log(`\n--- INPUT (first 500 chars) ---`);
    console.log(fullEx.input.substring(0, 500));
    console.log(`\n--- OUTPUT (first 300 chars) ---`);
    console.log(fullEx.output.substring(0, 300));
    console.log(`\nFull instruction length: ${fullEx.instruction.length} chars`);
    console.log(`Full input length: ${fullEx.input.length} chars`);
    console.log(`Full output length: ${fullEx.output.length} chars`);

    if (augment) {
      console.log('\n=== Section Example Preview ===\n');
      const secEx = allExamples.find(e => e.metadata.source === 'section_augmented')!;
      if (secEx) {
        console.log(`Company: ${secEx.metadata.company}`);
        console.log(`Job: ${secEx.metadata.jobTitle}`);
        console.log(`\n--- INSTRUCTION (first 400 chars) ---`);
        console.log(secEx.instruction.substring(0, 400));
        console.log(`\n--- OUTPUT (first 300 chars) ---`);
        console.log(secEx.output.substring(0, 300));
      }
    }
    return;
  }

  // 4. Write output
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeJSONL(trainExamples, TRAIN_FILE);
  writeJSONL(valExamples, VAL_FILE);

  const stats = {
    version: 'v2-anti-hallucination',
    totalResumes: resumes.length,
    totalExamples: allExamples.length,
    trainCount: trainExamples.length,
    valCount: valExamples.length,
    dbPaired,
    augmented: augment,
    sectionExamples: augment ? allExamples.length - fullExamples.length : 0,
    companies: [...new Set(resumes.map(r => r.company))].sort(),
    avgOutputLength: Math.round(
      allExamples.reduce((sum, ex) => sum + ex.output.length, 0) / allExamples.length
    ),
    avgInputLength: Math.round(
      allExamples.reduce((sum, ex) => sum + ex.input.length, 0) / allExamples.length
    ),
    groundingIncluded: true,
    personalFactsLength: PERSONAL_FACTS.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');

  console.log(`Written to ${OUTPUT_DIR}/`);
  console.log(`  train.jsonl: ${trainExamples.length} examples`);
  console.log(`  val.jsonl: ${valExamples.length} examples`);
  console.log(`  stats.json: metadata`);
  console.log(`\nAvg output: ${stats.avgOutputLength} chars | Avg input: ${stats.avgInputLength} chars`);
  console.log(`Companies: ${stats.companies.length}`);
  console.log('\nDone! Next: run training with scripts/train-resume-lm.py');
}

main().catch(console.error);
