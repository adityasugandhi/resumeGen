import { ApplicationResult } from './types';
import {
  trackApplicationInDb,
  hasApplied as dbHasApplied,
  getApplicationHistory as dbGetHistory,
  getApplicationsByCompany as dbGetByCompany,
  getApplicationStats as dbGetStats,
  getApplicationsByDate,
  getAllApplications,
} from '@/lib/db/queries/application-tracker';

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

export async function trackApplication(
  result: ApplicationResult,
  role?: string,
  url?: string
): Promise<TrackedApplication> {
  return trackApplicationInDb(result, role, url);
}

export async function getApplicationHistory(limit = 50): Promise<TrackedApplication[]> {
  return dbGetHistory(limit);
}

export async function getApplicationsByCompany(company: string): Promise<TrackedApplication[]> {
  return dbGetByCompany(company);
}

export async function getApplicationStats(): Promise<{
  total: number;
  submitted: number;
  failed: number;
}> {
  return dbGetStats();
}

export class PersistentTracker {
  async hasApplied(url: string): Promise<boolean> {
    return dbHasApplied(url);
  }

  async track(result: ApplicationResult, role?: string, url?: string): Promise<TrackedApplication> {
    return trackApplicationInDb(result, role, url);
  }

  async getStats(): Promise<{ total: number; submitted: number; failed: number }> {
    return dbGetStats();
  }

  async getByDate(date: string): Promise<TrackedApplication[]> {
    return getApplicationsByDate(date);
  }

  async getAll(): Promise<TrackedApplication[]> {
    return getAllApplications();
  }
}
