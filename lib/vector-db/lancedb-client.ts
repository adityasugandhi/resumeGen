/**
 * LanceDB client for project knowledge base
 * Serverless, local-first vector database
 *
 * API verified from @lancedb/lancedb v0.22.3
 */

import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import os from 'os';
import {
  ProjectDocument,
  SearchResult,
  IndexStatus,
  SearchFilters,
  PROJECTS_TABLE_NAME,
} from './schemas';
import { connectRemote, type RemoteLanceConnection } from './lancedb-http-client';

// Database path in user's home directory
// Configurable via LANCEDB_PROJECTS_PATH env var (supports local paths or S3 URIs)
const DB_PATH = process.env.LANCEDB_PROJECTS_PATH
  || path.join(os.homedir(), '.lancedb', 'resume-projects');

// Remote server URL (when set, uses HTTP client instead of embedded LanceDB)
const LANCEDB_SERVER_URL = process.env.LANCEDB_SERVER_URL;

// Unified connection type: embedded or remote
type LanceConnection = lancedb.Connection | RemoteLanceConnection;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanceTable = any; // Both lancedb.Table and RemoteLanceTable share the same chainable API

let db: LanceConnection | null = null;
let table: LanceTable | null = null;

/**
 * Initialize LanceDB connection
 */
export async function initDatabase(): Promise<LanceConnection> {
  if (db) return db;

  try {
    if (LANCEDB_SERVER_URL) {
      db = await connectRemote(LANCEDB_SERVER_URL);
      console.log(`LanceDB connected to remote server: ${LANCEDB_SERVER_URL}`);
    } else {
      db = await lancedb.connect(DB_PATH);
      console.log(`LanceDB connected at: ${DB_PATH}`);
    }
    return db;
  } catch (error) {
    console.error('Failed to connect to LanceDB:', error);
    throw new Error('Failed to initialize LanceDB');
  }
}

/**
 * Get or create the projects table
 */
export async function getProjectsTable(): Promise<lancedb.Table> {
  if (table) return table;

  const database = await initDatabase();

  try {
    const tableNames = await database.tableNames();

    if (tableNames.includes(PROJECTS_TABLE_NAME)) {
      table = await database.openTable(PROJECTS_TABLE_NAME);
      console.log(`Opened existing table: ${PROJECTS_TABLE_NAME}`);
    } else {
      // Table doesn't exist yet - will be created on first insert
      table = null;
      console.log(`Table ${PROJECTS_TABLE_NAME} does not exist yet`);
    }

    return table as lancedb.Table;
  } catch (error) {
    console.error('Failed to get projects table:', error);
    throw new Error('Failed to initialize projects table');
  }
}

/**
 * Create table with initial documents (LanceDB infers schema from data)
 */
export async function createTableWithDocuments(
  documents: ProjectDocument[]
): Promise<lancedb.Table> {
  const database = await initDatabase();

  if (documents.length === 0) {
    throw new Error('Cannot create table with empty documents');
  }

  try {
    // Drop existing table if it exists
    const tableNames = await database.tableNames();
    if (tableNames.includes(PROJECTS_TABLE_NAME)) {
      await database.dropTable(PROJECTS_TABLE_NAME);
      console.log(`Dropped existing table: ${PROJECTS_TABLE_NAME}`);
    }

    // Create table - LanceDB infers schema from the data
    // Convert documents to plain objects for LanceDB compatibility
    const plainDocs = documents.map(doc => ({ ...doc } as Record<string, unknown>));
    table = await database.createTable(PROJECTS_TABLE_NAME, plainDocs);
    console.log(`Created table ${PROJECTS_TABLE_NAME} with ${documents.length} documents`);

    return table;
  } catch (error) {
    console.error('Failed to create table:', error);
    throw new Error('Failed to create table');
  }
}

/**
 * Insert or update documents in the database
 */
export async function upsertDocuments(
  documents: ProjectDocument[]
): Promise<number> {
  if (documents.length === 0) {
    return 0;
  }

  const database = await initDatabase();

  try {
    const tableNames = await database.tableNames();

    if (!tableNames.includes(PROJECTS_TABLE_NAME)) {
      // Create table with the documents
      await createTableWithDocuments(documents);
      return documents.length;
    }

    // Table exists - delete existing documents by ID and add new ones
    const projectsTable = await database.openTable(PROJECTS_TABLE_NAME);
    table = projectsTable;

    // Delete existing documents by ID
    for (const doc of documents) {
      try {
        await projectsTable.delete(`id = '${doc.id}'`);
      } catch {
        // Document might not exist, ignore
      }
    }

    // Add new documents - convert to plain objects for LanceDB
    const plainDocs = documents.map(doc => ({ ...doc } as Record<string, unknown>));
    await projectsTable.add(plainDocs);

    console.log(`Upserted ${documents.length} documents`);
    return documents.length;
  } catch (error) {
    console.error('Failed to upsert documents:', error);
    throw new Error('Failed to upsert documents');
  }
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchDocuments(
  queryVector: number[],
  topK: number = 10,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  const database = await initDatabase();
  const tableNames = await database.tableNames();

  if (!tableNames.includes(PROJECTS_TABLE_NAME)) {
    console.log('Table does not exist, returning empty results');
    return [];
  }

  const projectsTable = await database.openTable(PROJECTS_TABLE_NAME);

  try {
    // Start vector search
    let searchQuery = projectsTable
      .vectorSearch(queryVector)
      .distanceType('cosine')
      .limit(topK * 2); // Get more to filter

    // Build filter conditions
    const filterConditions: string[] = [];

    if (filters?.projectNames && filters.projectNames.length > 0) {
      const projectFilter = filters.projectNames
        .map((p) => `projectName = '${p}'`)
        .join(' OR ');
      filterConditions.push(`(${projectFilter})`);
    }

    if (filters?.fileTypes && filters.fileTypes.length > 0) {
      const typeFilter = filters.fileTypes
        .map((t) => `fileType = '${t}'`)
        .join(' OR ');
      filterConditions.push(`(${typeFilter})`);
    }

    if (filters?.language) {
      filterConditions.push(`language = '${filters.language}'`);
    }

    // Apply filters if any
    if (filterConditions.length > 0) {
      searchQuery = searchQuery.where(filterConditions.join(' AND '));
    }

    const results = await searchQuery.toArray();

    // Map to SearchResult format
    const searchResults: SearchResult[] = results.slice(0, topK).map((row) => ({
      document: {
        id: row.id,
        projectName: row.projectName,
        projectPath: row.projectPath,
        filePath: row.filePath,
        fileType: row.fileType,
        content: row.content,
        chunk: row.chunk,
        chunkIndex: row.chunkIndex,
        vector: row.vector,
        metadata: row.metadata,
        indexedAt: row.indexedAt,
        fileModifiedAt: row.fileModifiedAt,
      },
      // Convert distance to similarity score (cosine distance: 0 = identical)
      score: 1 - (row._distance || 0),
      distance: row._distance || 0,
    }));

    return searchResults;
  } catch (error) {
    console.error('Failed to search documents:', error);
    throw new Error('Failed to search documents');
  }
}

/**
 * Get all documents for a project
 */
export async function getProjectDocuments(
  projectName: string
): Promise<ProjectDocument[]> {
  const database = await initDatabase();
  const tableNames = await database.tableNames();

  if (!tableNames.includes(PROJECTS_TABLE_NAME)) {
    return [];
  }

  const projectsTable = await database.openTable(PROJECTS_TABLE_NAME);

  try {
    const results = await projectsTable
      .query()
      .where(`projectName = '${projectName}'`)
      .toArray();

    return results.map((row) => ({
      id: row.id,
      projectName: row.projectName,
      projectPath: row.projectPath,
      filePath: row.filePath,
      fileType: row.fileType,
      content: row.content,
      chunk: row.chunk,
      chunkIndex: row.chunkIndex,
      vector: row.vector,
      metadata: row.metadata,
      indexedAt: row.indexedAt,
      fileModifiedAt: row.fileModifiedAt,
    }));
  } catch (error) {
    console.error('Failed to get project documents:', error);
    throw new Error('Failed to get project documents');
  }
}

/**
 * Delete all documents for a project
 */
export async function deleteProjectDocuments(
  projectName: string
): Promise<number> {
  const database = await initDatabase();
  const tableNames = await database.tableNames();

  if (!tableNames.includes(PROJECTS_TABLE_NAME)) {
    return 0;
  }

  const projectsTable = await database.openTable(PROJECTS_TABLE_NAME);

  try {
    const existing = await getProjectDocuments(projectName);
    await projectsTable.delete(`projectName = '${projectName}'`);
    console.log(`Deleted ${existing.length} documents for project: ${projectName}`);
    return existing.length;
  } catch (error) {
    console.error('Failed to delete project documents:', error);
    throw new Error('Failed to delete project documents');
  }
}

/**
 * Get index status
 */
export async function getIndexStatus(): Promise<IndexStatus> {
  const database = await initDatabase();
  const tableNames = await database.tableNames();

  if (!tableNames.includes(PROJECTS_TABLE_NAME)) {
    return {
      totalDocuments: 0,
      totalProjects: 0,
      lastIndexedAt: new Date().toISOString(),
      projectStats: [],
    };
  }

  const projectsTable = await database.openTable(PROJECTS_TABLE_NAME);

  try {
    const allDocs = await projectsTable.query().toArray();

    // Group by project
    const projectMap = new Map<
      string,
      { count: number; lastModified: string }
    >();

    for (const doc of allDocs) {
      const existing = projectMap.get(doc.projectName);
      if (!existing) {
        projectMap.set(doc.projectName, {
          count: 1,
          lastModified: doc.fileModifiedAt,
        });
      } else {
        existing.count++;
        if (doc.fileModifiedAt > existing.lastModified) {
          existing.lastModified = doc.fileModifiedAt;
        }
      }
    }

    const projectStats = Array.from(projectMap.entries()).map(
      ([projectName, stats]) => ({
        projectName,
        documentCount: stats.count,
        lastModified: stats.lastModified,
      })
    );

    // Find latest indexedAt
    const latestIndexedAt = allDocs.reduce(
      (latest, doc) =>
        doc.indexedAt > latest ? doc.indexedAt : latest,
      ''
    );

    return {
      totalDocuments: allDocs.length,
      totalProjects: projectStats.length,
      lastIndexedAt: latestIndexedAt || new Date().toISOString(),
      projectStats,
    };
  } catch (error) {
    console.error('Failed to get index status:', error);
    throw new Error('Failed to get index status');
  }
}

/**
 * Clear all documents from the database
 */
export async function clearDatabase(): Promise<void> {
  const database = await initDatabase();

  try {
    const tableNames = await database.tableNames();

    if (tableNames.includes(PROJECTS_TABLE_NAME)) {
      await database.dropTable(PROJECTS_TABLE_NAME);
      table = null;
      console.log(`Cleared table: ${PROJECTS_TABLE_NAME}`);
    }
  } catch (error) {
    console.error('Failed to clear database:', error);
    throw new Error('Failed to clear database');
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  db = null;
  table = null;
  console.log('Database connection closed');
}

/**
 * Get all unique project names in the index
 */
export async function getIndexedProjectNames(): Promise<string[]> {
  const status = await getIndexStatus();
  return status.projectStats.map((p) => p.projectName);
}
