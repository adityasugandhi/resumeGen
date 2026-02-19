/**
 * Career Memory LanceDB client
 * Persistent memory for the job search agent — stores resume components,
 * past searches, job matches, and learnings.
 *
 * Follows patterns from lancedb-client.ts but uses a separate DB path.
 */

import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import os from 'os';
import {
  CAREER_TABLE_NAMES,
  type CareerTableName,
  type ResumeComponentDoc,
  type JobSearchDoc,
  type JobMatchDoc,
  type OptimizedResumeDoc,
  type LearningDoc,
  type CareerSearchResult,
  type MemoryStats,
} from './career-schemas';
import { connectRemote, type RemoteLanceConnection } from './lancedb-http-client';

// Separate DB path from the project knowledge base
// Configurable via LANCEDB_CAREER_PATH env var (supports local paths or S3 URIs)
const CAREER_DB_PATH = process.env.LANCEDB_CAREER_PATH
  || path.join(os.homedir(), '.lancedb', 'career-memory');

// Remote server URL (when set, uses HTTP client instead of embedded LanceDB)
const LANCEDB_SERVER_URL = process.env.LANCEDB_SERVER_URL;

// Unified connection type: embedded or remote
type LanceConnection = lancedb.Connection | RemoteLanceConnection;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanceTable = any; // Both lancedb.Table and RemoteLanceTable share the same chainable API

let db: LanceConnection | null = null;
const tableCache = new Map<string, LanceTable>();

// ---- Connection ----

export async function initCareerMemory(): Promise<LanceConnection> {
  if (db) return db;
  try {
    if (LANCEDB_SERVER_URL) {
      db = await connectRemote(LANCEDB_SERVER_URL);
      console.log(`Career memory connected to remote server: ${LANCEDB_SERVER_URL}`);
    } else {
      db = await lancedb.connect(CAREER_DB_PATH);
      console.log(`Career memory connected at: ${CAREER_DB_PATH}`);
    }
    return db;
  } catch (error) {
    console.error('Failed to connect to career memory DB:', error);
    throw new Error('Failed to initialize career memory');
  }
}

// ---- Table management ----

async function getOrCreateTable(
  tableName: CareerTableName,
  initialDocs?: Record<string, unknown>[]
): Promise<lancedb.Table | null> {
  const cached = tableCache.get(tableName);
  if (cached) return cached;

  const database = await initCareerMemory();
  const tableNames = await database.tableNames();

  if (tableNames.includes(tableName)) {
    const table = await database.openTable(tableName);
    tableCache.set(tableName, table);
    return table;
  }

  if (initialDocs && initialDocs.length > 0) {
    const table = await database.createTable(tableName, initialDocs);
    tableCache.set(tableName, table);
    console.log(`Created career table: ${tableName} with ${initialDocs.length} docs`);
    return table;
  }

  return null;
}

async function ensureTable(
  tableName: CareerTableName,
  docs: Record<string, unknown>[]
): Promise<lancedb.Table> {
  const database = await initCareerMemory();
  const tableNames = await database.tableNames();

  if (tableNames.includes(tableName)) {
    const table = await database.openTable(tableName);
    tableCache.set(tableName, table);
    await table.add(docs);
    return table;
  }

  const table = await database.createTable(tableName, docs);
  tableCache.set(tableName, table);
  return table;
}

// ---- Resume Components ----

export async function upsertResumeComponents(
  docs: ResumeComponentDoc[]
): Promise<number> {
  if (docs.length === 0) return 0;

  const database = await initCareerMemory();
  const tableNames = await database.tableNames();
  const tableName = CAREER_TABLE_NAMES.RESUME_COMPONENTS;

  if (!tableNames.includes(tableName)) {
    const plainDocs = docs.map((d) => ({ ...d } as Record<string, unknown>));
    const table = await database.createTable(tableName, plainDocs);
    tableCache.set(tableName, table);
    console.log(`Created ${tableName} with ${docs.length} components`);
    return docs.length;
  }

  const table = await database.openTable(tableName);
  tableCache.set(tableName, table);

  // Delete existing by ID, then add
  for (const doc of docs) {
    try {
      await table.delete(`id = '${doc.id}'`);
    } catch { /* may not exist */ }
  }

  const plainDocs = docs.map((d) => ({ ...d } as Record<string, unknown>));
  await table.add(plainDocs);
  console.log(`Upserted ${docs.length} resume components`);
  return docs.length;
}

export async function searchResumeComponents(
  queryVector: number[],
  topK: number = 10,
  filters?: { type?: string; section?: string; sourceCompany?: string }
): Promise<CareerSearchResult<ResumeComponentDoc>[]> {
  const table = await getOrCreateTable(CAREER_TABLE_NAMES.RESUME_COMPONENTS);
  if (!table) return [];

  let search = table
    .vectorSearch(queryVector)
    .distanceType('cosine')
    .limit(topK * 2);

  const conditions: string[] = [];
  if (filters?.type) conditions.push(`type = '${filters.type}'`);
  if (filters?.section) conditions.push(`section = '${filters.section}'`);
  if (filters?.sourceCompany) conditions.push(`sourceCompany = '${filters.sourceCompany}'`);

  if (conditions.length > 0) {
    search = search.where(conditions.join(' AND '));
  }

  const results = await search.toArray();

  return results.slice(0, topK).map((row) => ({
    doc: {
      id: row.id,
      type: row.type,
      content: row.content,
      vector: row.vector,
      section: row.section,
      sourceCompany: row.sourceCompany,
      keywords: row.keywords,
      timesUsed: row.timesUsed,
      avgMatchScore: row.avgMatchScore,
      createdAt: row.createdAt,
    } as ResumeComponentDoc,
    score: 1 - (row._distance || 0),
    distance: row._distance || 0,
  }));
}

// ---- Job Searches ----

export async function storeJobSearch(doc: JobSearchDoc): Promise<void> {
  const plainDoc = { ...doc } as Record<string, unknown>;
  await ensureTable(CAREER_TABLE_NAMES.JOB_SEARCHES, [plainDoc]);
  console.log(`Stored job search: ${doc.jobTitle}`);
}

export async function searchPastSearches(
  queryVector: number[],
  topK: number = 5
): Promise<CareerSearchResult<JobSearchDoc>[]> {
  const table = await getOrCreateTable(CAREER_TABLE_NAMES.JOB_SEARCHES);
  if (!table) return [];

  const results = await table
    .vectorSearch(queryVector)
    .distanceType('cosine')
    .limit(topK)
    .toArray();

  return results.map((row) => ({
    doc: {
      id: row.id,
      jobTitle: row.jobTitle,
      location: row.location,
      vector: row.vector,
      totalSponsors: row.totalSponsors,
      companiesSearched: row.companiesSearched,
      topMatches: row.topMatches,
      avgMatchScore: row.avgMatchScore,
      bestCompany: row.bestCompany,
      timestamp: row.timestamp,
    } as JobSearchDoc,
    score: 1 - (row._distance || 0),
    distance: row._distance || 0,
  }));
}

// ---- Job Matches ----

export async function storeJobMatch(doc: JobMatchDoc): Promise<void> {
  const plainDoc = { ...doc } as Record<string, unknown>;
  await ensureTable(CAREER_TABLE_NAMES.JOB_MATCHES, [plainDoc]);
  console.log(`Stored job match: ${doc.company} - ${doc.jobTitle}`);
}

export async function searchJobMatches(
  queryVector: number[],
  topK: number = 10
): Promise<CareerSearchResult<JobMatchDoc>[]> {
  const table = await getOrCreateTable(CAREER_TABLE_NAMES.JOB_MATCHES);
  if (!table) return [];

  const results = await table
    .vectorSearch(queryVector)
    .distanceType('cosine')
    .limit(topK)
    .toArray();

  return results.map((row) => ({
    doc: {
      id: row.id,
      jobTitle: row.jobTitle,
      company: row.company,
      url: row.url,
      vector: row.vector,
      overallScore: row.overallScore,
      gaps: row.gaps,
      strengths: row.strengths,
      requirements: row.requirements,
      applied: row.applied,
      outcome: row.outcome,
      createdAt: row.createdAt,
    } as JobMatchDoc,
    score: 1 - (row._distance || 0),
    distance: row._distance || 0,
  }));
}

// ---- Optimized Resumes ----

export async function storeOptimizedResume(doc: OptimizedResumeDoc): Promise<void> {
  const plainDoc = { ...doc } as Record<string, unknown>;
  await ensureTable(CAREER_TABLE_NAMES.OPTIMIZED_RESUMES, [plainDoc]);
  console.log(`Stored optimized resume: ${doc.company} - ${doc.jobTitle}`);
}

// ---- Learnings ----

export async function storeLearning(doc: LearningDoc): Promise<void> {
  const plainDoc = { ...doc } as Record<string, unknown>;
  await ensureTable(CAREER_TABLE_NAMES.LEARNINGS, [plainDoc]);
  console.log(`Stored learning: [${doc.category}] ${doc.insight.substring(0, 80)}`);
}

export async function searchLearnings(
  queryVector: number[],
  category?: string,
  topK: number = 5
): Promise<CareerSearchResult<LearningDoc>[]> {
  const table = await getOrCreateTable(CAREER_TABLE_NAMES.LEARNINGS);
  if (!table) return [];

  let search = table
    .vectorSearch(queryVector)
    .distanceType('cosine')
    .limit(topK);

  if (category) {
    search = search.where(`category = '${category}'`);
  }

  const results = await search.toArray();

  return results.map((row) => ({
    doc: {
      id: row.id,
      category: row.category,
      insight: row.insight,
      vector: row.vector,
      evidence: row.evidence,
      confidence: row.confidence,
      createdAt: row.createdAt,
    } as LearningDoc,
    score: 1 - (row._distance || 0),
    distance: row._distance || 0,
  }));
}

// ---- Stats ----

export async function getMemoryStats(): Promise<MemoryStats> {
  const database = await initCareerMemory();
  const tableNames = await database.tableNames();

  const stats: MemoryStats = {
    resumeComponents: 0,
    jobSearches: 0,
    jobMatches: 0,
    optimizedResumes: 0,
    learnings: 0,
    lastIndexedAt: null,
  };

  for (const [key, tableName] of Object.entries(CAREER_TABLE_NAMES)) {
    if (!tableNames.includes(tableName)) continue;

    try {
      const table = await database.openTable(tableName);
      const rows = await table.query().toArray();
      const count = rows.length;

      switch (key) {
        case 'RESUME_COMPONENTS':
          stats.resumeComponents = count;
          if (count > 0) {
            // Find latest createdAt
            const latest = rows.reduce((max, r) =>
              r.createdAt > max ? r.createdAt : max, ''
            );
            stats.lastIndexedAt = latest || null;
          }
          break;
        case 'JOB_SEARCHES':
          stats.jobSearches = count;
          break;
        case 'JOB_MATCHES':
          stats.jobMatches = count;
          break;
        case 'OPTIMIZED_RESUMES':
          stats.optimizedResumes = count;
          break;
        case 'LEARNINGS':
          stats.learnings = count;
          break;
      }
    } catch {
      // Table may be corrupted or empty, skip
    }
  }

  return stats;
}

// ---- Cleanup ----

export async function clearCareerMemory(): Promise<void> {
  const database = await initCareerMemory();
  const tableNames = await database.tableNames();

  for (const tableName of Object.values(CAREER_TABLE_NAMES)) {
    if (tableNames.includes(tableName)) {
      await database.dropTable(tableName);
    }
  }

  tableCache.clear();
  console.log('Career memory cleared');
}
