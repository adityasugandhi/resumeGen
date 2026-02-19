/**
 * Migrate local LanceDB data to remote server
 *
 * Reads all 5 career-memory tables from local ~/.lancedb/career-memory
 * and POSTs them to the remote LanceDB server.
 *
 * Compatible with both the minimal server (3 endpoints) and the full server.
 *
 * Usage: npx tsx --env-file=.env.local scripts/migrate-lancedb-data.ts
 */

import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import os from 'os';

const LOCAL_CAREER_PATH = path.join(os.homedir(), '.lancedb', 'career-memory');
const LOCAL_PROJECTS_PATH = path.join(os.homedir(), '.lancedb', 'resume-projects');
const SERVER_URL = process.env.LANCEDB_SERVER_URL;

if (!SERVER_URL) {
  console.error('ERROR: LANCEDB_SERVER_URL not set in environment');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

async function serverFetch(urlPath: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${SERVER_URL}${urlPath}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  return res;
}

async function serverFetchJson(urlPath: string, options?: RequestInit) {
  const res = await serverFetch(urlPath, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// Check if an endpoint exists (for compatibility with minimal server)
async function endpointExists(urlPath: string, method: string = 'GET'): Promise<boolean> {
  try {
    const res = await serverFetch(urlPath, { method });
    return res.status !== 404;
  } catch {
    return false;
  }
}

async function migrateTable(localDb: lancedb.Connection, tableName: string): Promise<number> {
  const localTables = await localDb.tableNames();
  if (!localTables.includes(tableName)) {
    console.log(`  SKIP: ${tableName} (not found locally)`);
    return 0;
  }

  const table = await localDb.openTable(tableName);
  const rows = await table.query().toArray();

  if (rows.length === 0) {
    console.log(`  SKIP: ${tableName} (empty)`);
    return 0;
  }

  // Convert rows to plain objects
  const plainRows = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        obj[key] = Array.from(value as Float32Array);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  });

  // Check if table already exists on server — server returns {tables: [{name, ...}]}
  const serverTables = await serverFetchJson('/tables');
  const existingNames = (serverTables.tables || []).map(
    (t: { name: string } | string) => typeof t === 'string' ? t : t.name
  );
  if (existingNames.includes(tableName)) {
    const delRes = await serverFetch(`/tables/${encodeURIComponent(tableName)}`, { method: 'DELETE' });
    if (delRes.ok) {
      console.log(`  DROP: ${tableName} (replaced)`);
    } else {
      console.log(`  WARN: ${tableName} already exists, cannot delete`);
      return 0;
    }
  }

  // Create table — server expects POST /tables with {table_name, data} in body
  console.log(`  PUSH: ${tableName} (${plainRows.length} rows, ${(JSON.stringify(plainRows).length / 1024).toFixed(0)}KB)...`);
  await serverFetchJson(`/tables`, {
    method: 'POST',
    body: JSON.stringify({ table_name: tableName, data: plainRows }),
  });

  console.log(`  OK: ${tableName} → ${plainRows.length} rows`);
  return plainRows.length;
}

async function main() {
  console.log('=== LanceDB Migration to Remote Server ===');
  console.log(`Server: ${SERVER_URL}`);
  console.log('');

  // Verify server is reachable
  try {
    const health = await serverFetchJson('/');
    console.log(`Server status: ${health.status}`);
  } catch (error) {
    console.error(`ERROR: Cannot reach server at ${SERVER_URL}`);
    console.error(error);
    process.exit(1);
  }

  // Check server capabilities
  const hasDelete = await endpointExists('/tables/__test_nonexistent__', 'DELETE');
  const hasCount = await endpointExists('/tables/__test_nonexistent__/count');
  console.log(`Server API: ${hasDelete ? 'full' : 'minimal'} (delete: ${hasDelete ? 'yes' : 'no'}, count: ${hasCount ? 'yes' : 'no'})`);

  let totalRows = 0;

  // Migrate career memory tables
  console.log('\n--- Career Memory Tables ---');
  const careerDb = await lancedb.connect(LOCAL_CAREER_PATH);
  const careerTables = [
    'career_resume_components',
    'career_job_searches',
    'career_job_matches',
    'career_optimized_resumes',
    'career_learnings',
  ];

  for (const tableName of careerTables) {
    try {
      const count = await migrateTable(careerDb, tableName);
      totalRows += count;
    } catch (error) {
      console.error(`  ERROR: ${tableName} — ${(error as Error).message}`);
    }
  }

  // Migrate project knowledge base
  console.log('\n--- Project Knowledge Base ---');
  try {
    const projectsDb = await lancedb.connect(LOCAL_PROJECTS_PATH);
    const projectTables = await projectsDb.tableNames();

    if (projectTables.length === 0) {
      console.log('  SKIP: No project tables found locally');
    }

    for (const tableName of projectTables) {
      try {
        const count = await migrateTable(projectsDb, tableName);
        totalRows += count;
      } catch (error) {
        console.error(`  ERROR: ${tableName} — ${(error as Error).message}`);
      }
    }
  } catch (error) {
    console.error(`  No local projects at ${LOCAL_PROJECTS_PATH}`);
  }

  // Verify
  console.log('\n--- Verification ---');
  const finalTables = await serverFetchJson('/tables');
  const tableList = (finalTables.tables || []).map(
    (t: { name: string; row_count?: number } | string) => typeof t === 'string' ? t : t.name
  );
  console.log(`Remote tables: ${tableList.join(', ') || '(none)'}`);

  for (const tName of tableList) {
    try {
      const countRes = await serverFetchJson(`/tables/${encodeURIComponent(tName)}/count`);
      console.log(`  ${tName}: ${countRes.count ?? countRes.row_count ?? '?'} rows`);
    } catch { /* skip */ }
  }

  console.log(`\n=== Migration complete: ${totalRows} total rows migrated ===`);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
