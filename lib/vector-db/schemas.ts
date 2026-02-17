/**
 * TypeScript interfaces for LanceDB project knowledge base
 */

// Document types that can be indexed
export type DocumentType =
  | 'claude_md'
  | 'readme'
  | 'package_json'
  | 'pyproject'
  | 'makefile'
  | 'other';

// Main document interface stored in LanceDB
export interface ProjectDocument {
  // Unique identifier: projectName/filePath
  id: string;

  // Project information
  projectName: string;
  projectPath: string;

  // Document information
  filePath: string;
  fileType: DocumentType;

  // Content
  content: string;
  chunk: string; // Chunked content for embedding
  chunkIndex: number; // Index of chunk within document

  // Vector embedding (384-dim from all-MiniLM-L6-v2)
  vector: number[];

  // Extracted metadata
  metadata: ProjectMetadata;

  // Timestamps
  indexedAt: string;
  fileModifiedAt: string;
}

// Metadata extracted from project files
export interface ProjectMetadata {
  // From package.json / pyproject.toml
  techStack: string[];
  dependencies: string[];
  scripts: string[];

  // From CLAUDE.md / README
  description: string;
  commands: string[];
  features: string[];

  // Computed
  language: 'typescript' | 'python' | 'swift' | 'mixed' | 'unknown';
  framework?: string;
}

// Search query interface
export interface SearchQuery {
  query: string;
  topK?: number;
  filters?: SearchFilters;
}

// Filters for search
export interface SearchFilters {
  projectNames?: string[];
  fileTypes?: DocumentType[];
  techStack?: string[];
  language?: string;
}

// Search result interface
export interface SearchResult {
  document: ProjectDocument;
  score: number;
  distance: number;
}

// Index status interface
export interface IndexStatus {
  totalDocuments: number;
  totalProjects: number;
  lastIndexedAt: string;
  projectStats: {
    projectName: string;
    documentCount: number;
    lastModified: string;
  }[];
}

// Project scan result
export interface ProjectScanResult {
  projectName: string;
  projectPath: string;
  files: {
    path: string;
    type: DocumentType;
    size: number;
    modifiedAt: string;
  }[];
  metadata: ProjectMetadata;
}

// Chunking configuration
export interface ChunkConfig {
  maxChunkSize: number;    // Max characters per chunk
  chunkOverlap: number;    // Overlap between chunks
  minChunkSize: number;    // Min characters for a chunk
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxChunkSize: 1000,
  chunkOverlap: 100,
  minChunkSize: 50,
};

// Embedding dimension (all-MiniLM-L6-v2)
export const EMBEDDING_DIMENSION = 384;

// LanceDB table name
export const PROJECTS_TABLE_NAME = 'project_documents';
