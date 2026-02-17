/**
 * Memory Indexer
 * Bootstrap career memory by indexing all existing resumes into LanceDB.
 * Parses 22 tailored resumes + master template + RESUME_CONTEXT.md.
 */

import { v4 as uuidv4 } from 'uuid';
import { loadMasterResume, type ExperienceVariation, type ProjectVariation } from './resume-loader';
import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import { upsertResumeComponents, storeLearning } from '@/lib/vector-db/career-memory';
import type { ResumeComponentDoc, LearningDoc } from '@/lib/vector-db/career-schemas';
import { runMemoryHealthAgent } from './memory-health-agent';

export type IndexProgressCallback = (progress: {
  phase: 'parsing' | 'embedding' | 'storing' | 'learnings' | 'self_healing' | 'done';
  current: number;
  total: number;
  message: string;
}) => void;

export interface IndexResult {
  totalComponents: number;
  totalLearnings: number;
  experiences: number;
  skills: number;
  projects: number;
}

/**
 * Index all existing resume data into career memory.
 * This is a one-time bootstrap operation.
 */
export async function indexExistingResumes(
  onProgress?: IndexProgressCallback
): Promise<IndexResult> {
  onProgress?.({
    phase: 'parsing',
    current: 0,
    total: 1,
    message: 'Parsing all resume files from disk...',
  });

  let masterData = await loadMasterResume();

  const totalBullets = masterData.components.experiences.reduce((sum, e) => sum + e.bullets.length, 0);
  const totalSkills = masterData.components.skills.length;
  const totalProjects = masterData.components.projects.length;
  const totalComponents = totalBullets + totalSkills + totalProjects;

  onProgress?.({
    phase: 'parsing',
    current: 1,
    total: 1,
    message: `Parsed ${masterData.components.experiences.length} experiences, ${totalSkills} skills, ${totalProjects} projects`,
  });

  // ---- Anomaly detection: trigger self-healing if parser returned 0 components ----
  if (totalComponents === 0) {
    onProgress?.({
      phase: 'self_healing',
      current: 0,
      total: 1,
      message: 'Anomaly detected: 0 components parsed. Running memory health agent...',
    });

    try {
      const healthResult = await runMemoryHealthAgent({
        component: 'parser',
        anomaly: `${masterData.components.experiences.length} experiences, ${totalSkills} skills, ${totalProjects} projects found across all resume files`,
        expected: 'Should find 50+ bullets, 20+ skills, 5+ projects from 20+ tailored resumes',
        sampleFile: 'Job_Applications/Companies/GE_Vernova/GE_Vernova_AI_Agent_Engineer.tex',
      });

      onProgress?.({
        phase: 'self_healing',
        current: 1,
        total: 1,
        message: healthResult.fixed
          ? `Self-healing succeeded: ${healthResult.summary}`
          : `Self-healing failed: ${healthResult.summary}`,
      });

      if (healthResult.fixed && healthResult.retryRecommended) {
        // Re-load with fixed parser
        masterData = await loadMasterResume();
      }
    } catch (error) {
      console.error('[memory-indexer] Health agent failed:', error);
      onProgress?.({
        phase: 'self_healing',
        current: 1,
        total: 1,
        message: `Self-healing error: ${(error as Error).message}`,
      });
    }
  }

  // ---- Build component documents ----
  const docs: ResumeComponentDoc[] = [];

  // Experience bullets
  for (const exp of masterData.components.experiences) {
    for (const bullet of exp.bullets) {
      docs.push({
        id: `exp-${uuidv4()}`,
        type: 'bullet',
        content: bullet,
        vector: [], // filled below
        section: 'experience',
        sourceCompany: exp.sourceCompany,
        keywords: extractKeywords(bullet).join(','),
        timesUsed: 1,
        avgMatchScore: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Skills
  for (const skill of masterData.components.skills) {
    docs.push({
      id: `skill-${uuidv4()}`,
      type: 'skill',
      content: skill,
      vector: [],
      section: 'skills',
      sourceCompany: 'master',
      keywords: skill.toLowerCase().replace(/[^a-z0-9,\s]/g, ''),
      timesUsed: 1,
      avgMatchScore: 0,
      createdAt: new Date().toISOString(),
    });
  }

  // Projects
  for (const project of masterData.components.projects) {
    for (const bullet of project.bullets) {
      docs.push({
        id: `proj-${uuidv4()}`,
        type: 'project',
        content: `${project.name}: ${bullet}`,
        vector: [],
        section: 'projects',
        sourceCompany: project.sourceCompany,
        keywords: extractKeywords(bullet).join(','),
        timesUsed: 1,
        avgMatchScore: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // ---- Generate embeddings ----
  const total = docs.length;
  onProgress?.({
    phase: 'embedding',
    current: 0,
    total,
    message: `Generating embeddings for ${total} components...`,
  });

  // Process in batches of 10 to show progress
  const BATCH_SIZE = 10;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const embeddings = await Promise.all(
      batch.map((doc) => generateQueryEmbedding(doc.content))
    );

    for (let j = 0; j < batch.length; j++) {
      batch[j].vector = embeddings[j];
    }

    onProgress?.({
      phase: 'embedding',
      current: Math.min(i + BATCH_SIZE, total),
      total,
      message: `Generated ${Math.min(i + BATCH_SIZE, total)}/${total} embeddings`,
    });
  }

  // ---- Store in LanceDB ----
  onProgress?.({
    phase: 'storing',
    current: 0,
    total: 1,
    message: `Storing ${docs.length} components in career memory...`,
  });

  await upsertResumeComponents(docs);

  onProgress?.({
    phase: 'storing',
    current: 1,
    total: 1,
    message: `Stored ${docs.length} components`,
  });

  // ---- Extract learnings from RESUME_CONTEXT.md ----
  let learningCount = 0;

  if (masterData.deepContext) {
    onProgress?.({
      phase: 'learnings',
      current: 0,
      total: 1,
      message: 'Extracting learnings from resume context...',
    });

    const learnings = extractLearningsFromContext(masterData.deepContext);

    for (const learning of learnings) {
      const vector = await generateQueryEmbedding(learning.insight);
      await storeLearning({ ...learning, vector });
      learningCount++;
    }

    onProgress?.({
      phase: 'learnings',
      current: 1,
      total: 1,
      message: `Stored ${learningCount} learnings`,
    });
  }

  const result: IndexResult = {
    totalComponents: docs.length,
    totalLearnings: learningCount,
    experiences: masterData.components.experiences.reduce((sum, e) => sum + e.bullets.length, 0),
    skills: masterData.components.skills.length,
    projects: masterData.components.projects.reduce((sum, p) => sum + p.bullets.length, 0),
  };

  onProgress?.({
    phase: 'done',
    current: 1,
    total: 1,
    message: `Indexed ${result.totalComponents} components and ${result.totalLearnings} learnings`,
  });

  return result;
}

// ---- Helpers ----

function extractKeywords(text: string): string[] {
  const techTerms = text.match(
    /\b(React|Next\.js|TypeScript|JavaScript|Python|FastAPI|Docker|Kubernetes|AWS|PostgreSQL|MongoDB|Redis|Kafka|GraphQL|REST|gRPC|LangChain|MCP|AI|ML|NLP|Terraform|Node\.js|Go|Java|Spring|Scala|Spark|Flink)\b/gi
  );
  return [...new Set((techTerms || []).map((t) => t.toLowerCase()))];
}

function extractLearningsFromContext(context: string): Omit<LearningDoc, 'vector'>[] {
  const learnings: Omit<LearningDoc, 'vector'>[] = [];
  const now = new Date().toISOString();

  // Extract key strengths from context sections
  const sections = context.split('---');

  for (const section of sections) {
    // Find key metrics / enhanced bullets
    const metricMatches = section.match(/\*\*([^*]+)\*\*:\s*(.+)/g);
    if (metricMatches) {
      for (const match of metricMatches.slice(0, 3)) {
        const cleaned = match.replace(/\*\*/g, '').trim();
        learnings.push({
          id: `learning-${uuidv4()}`,
          category: 'strength',
          insight: cleaned,
          evidence: JSON.stringify([]),
          confidence: 0.8,
          createdAt: now,
        });
      }
    }

    // Extract platform capabilities as patterns
    const headerMatch = section.match(/##\s+(.+?)(?:\n|$)/);
    if (headerMatch) {
      const header = headerMatch[1].trim();
      if (header.length > 5 && !header.startsWith('#')) {
        learnings.push({
          id: `learning-${uuidv4()}`,
          category: 'pattern',
          insight: `Resume context area: ${header}. Use this domain knowledge when tailoring for related roles.`,
          evidence: JSON.stringify([header]),
          confidence: 0.9,
          createdAt: now,
        });
      }
    }
  }

  return learnings;
}
