import { eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { applicationQueue } from '../schema';
import type { QueueStatus, QueuedApplication } from '@/lib/cron/application-queue';

function toQueuedApplication(row: typeof applicationQueue.$inferSelect): QueuedApplication {
  return {
    id: row.shortId,
    jobTitle: row.jobTitle,
    company: row.company,
    url: row.url,
    location: row.location,
    matchScore: row.matchScore,
    gaps: row.gaps as string[],
    strengths: row.strengths as string[],
    tailoredResumePath: row.tailoredResumePath,
    tailoredPdfPath: row.tailoredPdfPath,
    status: row.status,
    queuedAt: row.queuedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString(),
    submittedAt: row.submittedAt?.toISOString(),
    error: row.error ?? undefined,
  };
}

export async function addToQueue(
  app: Omit<QueuedApplication, 'id' | 'status' | 'queuedAt'>
): Promise<QueuedApplication> {
  // Check for existing URL
  const existing = await db
    .select()
    .from(applicationQueue)
    .where(eq(applicationQueue.url, app.url))
    .limit(1);

  if (existing.length > 0) return toQueuedApplication(existing[0]);

  const shortId = crypto.randomUUID().slice(0, 8);
  const [row] = await db
    .insert(applicationQueue)
    .values({
      shortId,
      jobTitle: app.jobTitle,
      company: app.company,
      url: app.url,
      location: app.location,
      matchScore: app.matchScore,
      gaps: app.gaps,
      strengths: app.strengths,
      tailoredResumePath: app.tailoredResumePath,
      tailoredPdfPath: app.tailoredPdfPath,
    })
    .returning();

  return toQueuedApplication(row);
}

export async function hasUrl(url: string): Promise<boolean> {
  const rows = await db
    .select({ id: applicationQueue.id })
    .from(applicationQueue)
    .where(eq(applicationQueue.url, url))
    .limit(1);
  return rows.length > 0;
}

export async function listByStatus(status: QueueStatus): Promise<QueuedApplication[]> {
  const rows = await db
    .select()
    .from(applicationQueue)
    .where(eq(applicationQueue.status, status));
  return rows.map(toQueuedApplication);
}

export async function listAll(): Promise<QueuedApplication[]> {
  const rows = await db.select().from(applicationQueue);
  return rows.map(toQueuedApplication);
}

export async function getById(shortId: string): Promise<QueuedApplication | undefined> {
  const rows = await db
    .select()
    .from(applicationQueue)
    .where(eq(applicationQueue.shortId, shortId))
    .limit(1);
  return rows.length > 0 ? toQueuedApplication(rows[0]) : undefined;
}

export async function approve(shortId: string): Promise<boolean> {
  const result = await db
    .update(applicationQueue)
    .set({ status: 'approved', reviewedAt: new Date() })
    .where(
      sql`${applicationQueue.shortId} = ${shortId} AND ${applicationQueue.status} = 'pending'`
    )
    .returning();
  return result.length > 0;
}

export async function reject(shortId: string): Promise<boolean> {
  const result = await db
    .update(applicationQueue)
    .set({ status: 'rejected', reviewedAt: new Date() })
    .where(
      sql`${applicationQueue.shortId} = ${shortId} AND ${applicationQueue.status} = 'pending'`
    )
    .returning();
  return result.length > 0;
}

export async function approveAll(): Promise<number> {
  const result = await db
    .update(applicationQueue)
    .set({ status: 'approved', reviewedAt: new Date() })
    .where(eq(applicationQueue.status, 'pending'))
    .returning();
  return result.length;
}

export async function updateQueueStatus(
  shortId: string,
  status: QueueStatus,
  error?: string
): Promise<boolean> {
  const updates: Record<string, unknown> = { status };
  if (status === 'submitted' || status === 'failed') {
    updates.submittedAt = new Date();
  }
  if (error) {
    updates.error = error;
  }
  const result = await db
    .update(applicationQueue)
    .set(updates)
    .where(eq(applicationQueue.shortId, shortId))
    .returning();
  return result.length > 0;
}
