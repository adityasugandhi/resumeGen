import { ApplicationResult } from './types';

export interface TrackedApplication {
  id: string;
  jobId: string;
  company: string;
  role?: string;
  url?: string;
  platform: string;
  status: 'submitted' | 'failed' | 'pending';
  confirmationId?: string;
  error?: string;
  submittedAt: number;
}

// In-memory store for server-side tracking
// For client-side, use IndexedDB (see lib/indexeddb.ts)
const applicationLog: TrackedApplication[] = [];

export function trackApplication(result: ApplicationResult, role?: string, url?: string): TrackedApplication {
  const tracked: TrackedApplication = {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    jobId: result.jobId,
    company: result.company,
    role,
    url,
    platform: result.platform,
    status: result.success ? 'submitted' : 'failed',
    confirmationId: result.confirmationId,
    error: result.error,
    submittedAt: result.submittedAt,
  };

  applicationLog.push(tracked);

  // Log to console for server-side visibility
  const logLine = `[AUTO-APPLY] ${new Date(tracked.submittedAt).toISOString()} | ${tracked.status.toUpperCase()} | ${tracked.company} | ${tracked.role || 'N/A'} | ${tracked.platform}`;
  if (tracked.status === 'failed') {
    console.error(logLine, tracked.error);
  } else {
    console.log(logLine);
  }

  return tracked;
}

export function getApplicationHistory(limit = 50): TrackedApplication[] {
  return applicationLog.slice(-limit);
}

export function getApplicationsByCompany(company: string): TrackedApplication[] {
  return applicationLog.filter(
    (a) => a.company.toLowerCase() === company.toLowerCase()
  );
}

export function getApplicationStats(): {
  total: number;
  submitted: number;
  failed: number;
} {
  return {
    total: applicationLog.length,
    submitted: applicationLog.filter((a) => a.status === 'submitted').length,
    failed: applicationLog.filter((a) => a.status === 'failed').length,
  };
}
