/**
 * Index Manager - orchestrates project indexing
 */

import {
  ProjectDocument,
  ProjectMetadata,
  DocumentType,
  EMBEDDING_DIMENSION,
  DEFAULT_CHUNK_CONFIG,
} from '../vector-db/schemas';
import {
  upsertDocuments,
  getIndexStatus,
  clearDatabase,
  deleteProjectDocuments,
} from '../vector-db/lancedb-client';
import {
  scanProjectsDirectory,
  scanProject,
  readFileContent,
  getDefaultProjectsPath,
} from './project-scanner';
import { chunkDocument, chunkJSON, chunkTOML } from './chunker';

// Server-side embedding using Xenova transformers
// Note: This needs to be imported differently for server vs client
let embedder: any = null;

/**
 * Initialize the embedding model for server-side use
 */
async function initServerEmbedder() {
  if (embedder) return embedder;

  try {
    // Dynamic import for server-side
    const { pipeline, env } = await import('@xenova/transformers');

    // Configure for server
    env.allowLocalModels = true;
    env.useBrowserCache = false;

    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });

    console.log('Server-side embedding model initialized');
    return embedder;
  } catch (error) {
    console.error('Failed to initialize embedding model:', error);
    throw new Error('Failed to initialize embedding model');
  }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = await initServerEmbedder();

  const output = await model(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

/**
 * Generate embeddings for multiple texts
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Index progress callback type
 */
export type IndexProgressCallback = (progress: {
  phase: 'scanning' | 'chunking' | 'embedding' | 'storing';
  current: number;
  total: number;
  projectName?: string;
  message: string;
}) => void;

/**
 * Index a single project
 */
export async function indexProject(
  projectPath: string,
  onProgress?: IndexProgressCallback
): Promise<number> {
  const scanResult = await scanProject(projectPath);

  if (!scanResult) {
    console.log(`No indexable files found in ${projectPath}`);
    return 0;
  }

  const documents: ProjectDocument[] = [];
  const { projectName, files, metadata } = scanResult;

  onProgress?.({
    phase: 'chunking',
    current: 0,
    total: files.length,
    projectName,
    message: `Processing ${projectName}`,
  });

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = await readFileContent(file.path);

    if (!content) continue;

    onProgress?.({
      phase: 'chunking',
      current: i + 1,
      total: files.length,
      projectName,
      message: `Chunking ${file.path}`,
    });

    // Chunk the content based on file type
    let chunks;
    if (file.type === 'package_json') {
      chunks = chunkJSON(content, DEFAULT_CHUNK_CONFIG);
    } else if (file.type === 'pyproject') {
      chunks = chunkTOML(content, DEFAULT_CHUNK_CONFIG);
    } else {
      chunks = chunkDocument(content, DEFAULT_CHUNK_CONFIG);
    }

    // Create document for each chunk
    for (const chunk of chunks) {
      documents.push({
        id: `${projectName}/${file.path}#${chunk.index}`,
        projectName,
        projectPath: scanResult.projectPath,
        filePath: file.path,
        fileType: file.type,
        content: content,
        chunk: chunk.text,
        chunkIndex: chunk.index,
        vector: [], // Will be filled during embedding
        metadata,
        indexedAt: new Date().toISOString(),
        fileModifiedAt: file.modifiedAt,
      });
    }
  }

  if (documents.length === 0) {
    return 0;
  }

  // Generate embeddings
  onProgress?.({
    phase: 'embedding',
    current: 0,
    total: documents.length,
    projectName,
    message: `Generating embeddings for ${projectName}`,
  });

  const chunkTexts = documents.map((d) => d.chunk);
  const embeddings = await generateEmbeddings(chunkTexts);

  // Assign embeddings to documents
  for (let i = 0; i < documents.length; i++) {
    documents[i].vector = embeddings[i];

    if (i % 10 === 0) {
      onProgress?.({
        phase: 'embedding',
        current: i + 1,
        total: documents.length,
        projectName,
        message: `Generated ${i + 1}/${documents.length} embeddings`,
      });
    }
  }

  // Store in LanceDB
  onProgress?.({
    phase: 'storing',
    current: 0,
    total: 1,
    projectName,
    message: `Storing ${documents.length} documents for ${projectName}`,
  });

  await upsertDocuments(documents);

  onProgress?.({
    phase: 'storing',
    current: 1,
    total: 1,
    projectName,
    message: `Indexed ${documents.length} documents for ${projectName}`,
  });

  return documents.length;
}

/**
 * Index all projects in the default directory
 */
export async function indexAllProjects(
  onProgress?: IndexProgressCallback
): Promise<{
  totalDocuments: number;
  totalProjects: number;
  errors: string[];
}> {
  const projectsDir = getDefaultProjectsPath();
  const errors: string[] = [];
  let totalDocuments = 0;
  let processedProjects = 0;

  onProgress?.({
    phase: 'scanning',
    current: 0,
    total: 0,
    message: `Scanning projects in ${projectsDir}`,
  });

  // Scan all projects
  const scanResults = await scanProjectsDirectory(projectsDir);
  const totalProjects = scanResults.length;

  onProgress?.({
    phase: 'scanning',
    current: totalProjects,
    total: totalProjects,
    message: `Found ${totalProjects} projects to index`,
  });

  // Index each project
  for (const scanResult of scanResults) {
    try {
      processedProjects++;

      const projectProgress: IndexProgressCallback = (progress) => {
        onProgress?.({
          ...progress,
          message: `[${processedProjects}/${totalProjects}] ${progress.message}`,
        });
      };

      const docCount = await indexProject(scanResult.projectPath, projectProgress);
      totalDocuments += docCount;

      console.log(`Indexed ${scanResult.projectName}: ${docCount} documents`);
    } catch (error) {
      const errorMsg = `Failed to index ${scanResult.projectName}: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return {
    totalDocuments,
    totalProjects: processedProjects,
    errors,
  };
}

/**
 * Reindex a specific project
 */
export async function reindexProject(
  projectName: string,
  onProgress?: IndexProgressCallback
): Promise<number> {
  const projectsDir = getDefaultProjectsPath();
  const projectPath = `${projectsDir}/${projectName}`;

  // Delete existing documents for this project
  await deleteProjectDocuments(projectName);

  // Reindex
  return indexProject(projectPath, onProgress);
}

/**
 * Get indexing status
 */
export async function getIndexingStatus() {
  return getIndexStatus();
}

/**
 * Clear entire index
 */
export async function clearIndex() {
  return clearDatabase();
}

/**
 * Generate embedding for a query (for search)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query);
}
