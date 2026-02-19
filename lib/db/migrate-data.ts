/**
 * One-time data migration script.
 * Reads existing JSON files and inserts into PostgreSQL.
 *
 * Usage: tsx --env-file=.env.local lib/db/migrate-data.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { applicationQueue, applicationTracker } from './schema';

const QUEUE_PATH = join(process.cwd(), 'Job_Applications/queue/applications-queue.json');
const TRACKER_PATH = join(process.cwd(), 'Job_Applications/tracker/applications.json');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // ── Migrate application queue ──────────────────────────────────────────
  if (existsSync(QUEUE_PATH)) {
    try {
      const raw = readFileSync(QUEUE_PATH, 'utf-8');
      const items = JSON.parse(raw) as Array<{
        id: string;
        jobTitle: string;
        company: string;
        url: string;
        location: string;
        matchScore: number;
        gaps: string[];
        strengths: string[];
        tailoredResumePath: string;
        tailoredPdfPath: string;
        status: string;
        queuedAt: string;
        reviewedAt?: string;
        submittedAt?: string;
        error?: string;
      }>;

      console.log(`Migrating ${items.length} queue items...`);

      for (const item of items) {
        await db
          .insert(applicationQueue)
          .values({
            shortId: item.id,
            jobTitle: item.jobTitle,
            company: item.company,
            url: item.url,
            location: item.location || '',
            matchScore: item.matchScore,
            gaps: item.gaps,
            strengths: item.strengths,
            tailoredResumePath: item.tailoredResumePath || '',
            tailoredPdfPath: item.tailoredPdfPath || '',
            status: item.status as 'pending' | 'approved' | 'rejected' | 'submitted' | 'failed',
            queuedAt: new Date(item.queuedAt),
            reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
            submittedAt: item.submittedAt ? new Date(item.submittedAt) : null,
            error: item.error || null,
          })
          .onConflictDoNothing();
      }
      console.log(`Queue migration complete.`);
    } catch (err) {
      console.error('Queue migration failed:', err);
    }
  } else {
    console.log('No queue file found, skipping.');
  }

  // ── Migrate application tracker ────────────────────────────────────────
  if (existsSync(TRACKER_PATH)) {
    try {
      const raw = readFileSync(TRACKER_PATH, 'utf-8');
      const items = JSON.parse(raw) as Array<{
        id: string;
        jobId: string;
        company: string;
        role?: string;
        url?: string;
        platform: string;
        status: string;
        confirmationId?: string;
        error?: string;
        submittedAt: number;
      }>;

      console.log(`Migrating ${items.length} tracker items...`);

      for (const item of items) {
        await db
          .insert(applicationTracker)
          .values({
            trackId: item.id,
            jobId: item.jobId,
            company: item.company,
            role: item.role || null,
            url: item.url || null,
            platform: item.platform,
            status: item.status as 'submitted' | 'failed' | 'pending',
            confirmationId: item.confirmationId || null,
            error: item.error || null,
            submittedAt: new Date(item.submittedAt),
          });
      }
      console.log('Tracker migration complete.');
    } catch (err) {
      console.error('Tracker migration failed:', err);
    }
  } else {
    console.log('No tracker file found, skipping.');
  }

  await pool.end();
  console.log('Migration done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
