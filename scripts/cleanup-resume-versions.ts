/**
 * Garbage collection for resume_versions table.
 * Deletes versions older than 30 days (configurable).
 *
 * Usage: npx tsx scripts/cleanup-resume-versions.ts [--days=30] [--dry-run]
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { db } from '@/lib/db';
import { resumeVersions } from '@/lib/db/schema';
import { lt, sql } from 'drizzle-orm';

const args = process.argv.slice(2);
const daysArg = args.find((a) => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;
const dryRun = args.includes('--dry-run');

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  console.log(
    `Resume Version GC — deleting versions older than ${days} days (before ${cutoff.toISOString()})`
  );
  if (dryRun) console.log('(DRY RUN — no deletions)');

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(resumeVersions)
    .where(lt(resumeVersions.createdAt, cutoff));

  const toDelete = Number(countResult[0]?.count ?? 0);
  console.log(`Found ${toDelete} versions to delete`);

  if (toDelete === 0 || dryRun) {
    process.exit(0);
  }

  const deleted = await db
    .delete(resumeVersions)
    .where(lt(resumeVersions.createdAt, cutoff))
    .returning({ id: resumeVersions.id });

  console.log(`Deleted ${deleted.length} resume versions`);
  process.exit(0);
}

main().catch((err) => {
  console.error('GC failed:', err);
  process.exit(1);
});
