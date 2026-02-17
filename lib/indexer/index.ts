/**
 * Indexer module exports
 */

// Index manager
export {
  indexProject,
  indexAllProjects,
  reindexProject,
  getIndexingStatus,
  clearIndex,
  generateQueryEmbedding,
  type IndexProgressCallback,
} from './index-manager';

// Project scanner
export {
  scanProject,
  scanProjectsDirectory,
  readFileContent,
  getDefaultProjectsPath,
  listProjectNames,
} from './project-scanner';

// Document parser
export {
  detectDocumentType,
  parsePackageJson,
  parsePyprojectToml,
  parseMakefile,
  parseClaudeMd,
  parseReadmeMd,
  mergeMetadata,
} from './document-parser';

// Chunker
export {
  chunkDocument,
  chunkMarkdown,
  chunkJSON,
  chunkTOML,
  type Chunk,
} from './chunker';
