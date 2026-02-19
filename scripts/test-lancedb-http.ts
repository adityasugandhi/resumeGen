import { connectRemote } from '../lib/vector-db/lancedb-http-client';

async function main() {
  const url = process.env.LANCEDB_SERVER_URL!;
  console.log('Connecting to:', url);

  const conn = await connectRemote(url);
  const tables = await conn.tableNames();
  console.log('Tables:', tables);

  // Test count
  for (const name of tables) {
    if (name === 'test_vectors') continue;
    const table = await conn.openTable(name);
    const count = await table.countRows();
    console.log(`  ${name}: ${count} rows`);
  }

  // Test query
  console.log('\nSample learnings:');
  const learnings = await conn.openTable('career_learnings');
  const rows = await learnings.query().limit(3).toArray();
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    console.log(`  [${r.category}] ${String(r.insight || '').substring(0, 80)}`);
  }

  console.log('\nHTTP client working!');
}

main().catch(console.error);
