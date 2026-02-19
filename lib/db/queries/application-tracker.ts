import { eq, sql, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../index';
import { applicationTracker } from '../schema';
import type { TrackedApplication } from '@/lib/careers/auto-apply/tracker';
import type { ApplicationResult } from '@/lib/careers/auto-apply/types';

function toTrackedApplication(row: typeof applicationTracker.$inferSelect): TrackedApplication {
  return {
    id: row.trackId,
    jobId: row.jobId,
    company: row.company,
    role: row.role ?? undefined,
    url: row.url ?? undefined,
    platform: row.platform,
    status: row.status,
    confirmationId: row.confirmationId ?? undefined,
    error: row.error ?? undefined,
    submittedAt: row.submittedAt.getTime(),
  };
}

export async function trackApplicationInDb(
  result: ApplicationResult,
  role?: string,
  url?: string
): Promise<TrackedApplication> {
  const trackId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const [row] = await db
    .insert(applicationTracker)
    .values({
      trackId,
      jobId: result.jobId,
      company: result.company,
      role: role ?? null,
      url: url ?? null,
      platform: result.platform,
      status: result.success ? 'submitted' : 'failed',
      confirmationId: result.confirmationId ?? null,
      error: result.error ?? null,
      submittedAt: new Date(result.submittedAt),
    })
    .returning();

  const tracked = toTrackedApplication(row);

  // Log to console for server-side visibility
  const logLine = `[AUTO-APPLY] ${new Date(tracked.submittedAt).toISOString()} | ${tracked.status.toUpperCase()} | ${tracked.company} | ${tracked.role || 'N/A'} | ${tracked.platform}`;
  if (tracked.status === 'failed') {
    console.error(logLine, tracked.error);
  } else {
    console.log(logLine);
  }

  return tracked;
}

export async function hasApplied(url: string): Promise<boolean> {
  const rows = await db
    .select({ id: applicationTracker.id })
    .from(applicationTracker)
    .where(eq(applicationTracker.url, url))
    .limit(1);
  return rows.length > 0;
}

export async function getApplicationHistory(limit = 50): Promise<TrackedApplication[]> {
  const rows = await db
    .select()
    .from(applicationTracker)
    .orderBy(desc(applicationTracker.submittedAt))
    .limit(limit);
  return rows.map(toTrackedApplication);
}

export async function getApplicationsByCompany(company: string): Promise<TrackedApplication[]> {
  const rows = await db
    .select()
    .from(applicationTracker)
    .where(sql`LOWER(${applicationTracker.company}) = LOWER(${company})`);
  return rows.map(toTrackedApplication);
}

export async function getApplicationStats(): Promise<{
  total: number;
  submitted: number;
  failed: number;
}> {
  const rows = await db.select().from(applicationTracker);
  return {
    total: rows.length,
    submitted: rows.filter((a) => a.status === 'submitted').length,
    failed: rows.filter((a) => a.status === 'failed').length,
  };
}

export async function getApplicationsByDate(date: string): Promise<TrackedApplication[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select()
    .from(applicationTracker)
    .where(
      and(
        gte(applicationTracker.submittedAt, dayStart),
        lte(applicationTracker.submittedAt, dayEnd)
      )
    );
  return rows.map(toTrackedApplication);
}

export async function getAllApplications(): Promise<TrackedApplication[]> {
  const rows = await db.select().from(applicationTracker);
  return rows.map(toTrackedApplication);
}
