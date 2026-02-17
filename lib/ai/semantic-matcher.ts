import { pipeline, env } from '@xenova/transformers';

// Configure Xenova to use browser cache
if (typeof window !== 'undefined') {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

/**
 * Initialize the embedding model (all-MiniLM-L6-v2)
 * This is a lightweight model that runs in the browser
 */
export async function initEmbedder() {
  if (embedder) return embedder;

  try {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        quantized: true, // Use quantized model for faster loading
      }
    );
    return embedder;
  } catch (error) {
    console.error('Failed to initialize embedder:', error);
    throw new Error('Failed to initialize embedding model');
  }
}

/**
 * Generate embedding vector for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await initEmbedder();

  if (!model) {
    throw new Error('Failed to initialize embedding model');
  }

  // Generate embedding
  const output = await model(text, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to regular array
  return Array.from(output.data);
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find top N most similar items
 */
export function findTopMatches(
  queryEmbedding: number[],
  candidateEmbeddings: { id: string; embedding: number[]; text: string }[],
  topN: number = 5
): Array<{ id: string; text: string; similarity: number }> {
  const similarities = candidateEmbeddings.map((candidate) => ({
    id: candidate.id,
    text: candidate.text,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
  }));

  // Sort by similarity (descending)
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topN);
}

/**
 * Calculate overall match score between job and resume
 */
export async function calculateJobResumeMatch(
  jobRequirements: string[],
  resumeComponents: {
    experiences: string[];
    skills: string[];
    projects?: string[];
  }
): Promise<{
  overallScore: number;
  requirementMatches: Array<{
    requirement: string;
    bestMatch: string;
    score: number;
    type: 'experience' | 'skill' | 'project';
  }>;
  gaps: string[];
}> {
  // Generate embeddings for job requirements
  const requirementEmbeddings = await generateEmbeddings(jobRequirements);

  // Generate embeddings for all resume components
  const allResumeTexts = [
    ...resumeComponents.experiences,
    ...resumeComponents.skills,
    ...(resumeComponents.projects || []),
  ];

  const allResumeEmbeddings = await generateEmbeddings(allResumeTexts);

  const resumeItems = allResumeTexts.map((text, idx) => {
    let type: 'experience' | 'skill' | 'project';
    if (idx < resumeComponents.experiences.length) {
      type = 'experience';
    } else if (idx < resumeComponents.experiences.length + resumeComponents.skills.length) {
      type = 'skill';
    } else {
      type = 'project';
    }

    return {
      id: `${type}-${idx}`,
      embedding: allResumeEmbeddings[idx],
      text,
      type,
    };
  });

  const requirementMatches = requirementEmbeddings.map((reqEmbedding, idx) => {
    const matches = findTopMatches(reqEmbedding, resumeItems, 1);
    const bestMatch = matches[0];

    return {
      requirement: jobRequirements[idx],
      bestMatch: bestMatch.text,
      score: bestMatch.similarity,
      type: resumeItems.find((item) => item.id === bestMatch.id)?.type || 'experience',
    };
  });

  // Calculate overall score (average of all requirement matches)
  const totalScore = requirementMatches.reduce((sum, match) => sum + match.score, 0);
  const overallScore = Math.round((totalScore / requirementMatches.length) * 100);

  // Identify gaps (requirements with low match scores)
  const gaps = requirementMatches
    .filter((match) => match.score < 0.5)
    .map((match) => match.requirement);

  return {
    overallScore,
    requirementMatches,
    gaps,
  };
}

/**
 * Suggest resume improvements based on job requirements
 */
export function suggestImprovements(
  requirementMatches: Array<{
    requirement: string;
    bestMatch: string;
    score: number;
    type: 'experience' | 'skill' | 'project';
  }>,
  gaps: string[]
): string[] {
  const suggestions: string[] = [];

  // Low-match requirements
  const lowMatches = requirementMatches.filter((m) => m.score < 0.7 && m.score >= 0.5);
  lowMatches.forEach((match) => {
    suggestions.push(
      `Strengthen your ${match.type} section to better highlight: "${match.requirement}"`
    );
  });

  // Gaps
  if (gaps.length > 0) {
    gaps.forEach((gap) => {
      suggestions.push(
        `Consider adding experience or skills related to: "${gap}"`
      );
    });
  }

  // High matches (positive feedback)
  const highMatches = requirementMatches.filter((m) => m.score >= 0.8);
  if (highMatches.length > 0) {
    suggestions.push(
      `Your strongest matches: ${highMatches
        .slice(0, 3)
        .map((m) => `"${m.requirement}"`)
        .join(', ')}`
    );
  }

  return suggestions;
}

/**
 * Server-side simplified match calculation for the agent pipeline.
 * Returns score, gaps, and strengths without browser-specific logic.
 */
export async function calculateJobResumeMatchFromText(
  requirements: string[],
  resumeComponents: {
    experiences: string[];
    skills: string[];
    projects: string[];
  }
): Promise<{
  overallScore: number;
  gaps: string[];
  strengths: string[];
}> {
  const matchResult = await calculateJobResumeMatch(requirements, resumeComponents);

  const strengths = matchResult.requirementMatches
    .filter((m) => m.score >= 0.7)
    .map((m) => m.requirement);

  return {
    overallScore: matchResult.overallScore,
    gaps: matchResult.gaps,
    strengths,
  };
}
