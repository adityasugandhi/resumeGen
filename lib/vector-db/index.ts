/**
 * Vector DB module exports
 */

// Schemas and types
export * from './schemas';

// LanceDB client operations
export {
  initDatabase,
  getProjectsTable,
  upsertDocuments,
  searchDocuments,
  getProjectDocuments,
  deleteProjectDocuments,
  getIndexStatus,
  clearDatabase,
  closeDatabase,
} from './lancedb-client';
