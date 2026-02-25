/**
 * Type definitions for the parallel sub-agent system.
 */

export interface DiscoveryResult {
  companies: TargetCompany[];
  h1bData: {
    totalPositions: number;
    topCompanies: Array<{ company: string; count: number; avgWage: number }>;
  };
  memoryInsights: {
    pastSearches: number;
    pastMatches: number;
  };
}

export interface TargetCompany {
  name: string;
  platform: string;
  h1bPositions: number;
  h1bAvgWage: number;
}

export interface CompanyWorkerResult {
  company: string;
  jobs: JobWorkerResult[];
  engineeringRoles: number;
  totalRoles: number;
  errors: string[];
}

export interface JobWorkerResult {
  title: string;
  company: string;
  url: string;
  location: string;
  matchScore: number;
  gaps: string[];
  strengths: string[];
  optimizedResume?: {
    latex: string;
    changes: Array<{ section: string; reasoning: string }>;
    summary: string;
  };
}

export interface WorkerProgress {
  company: string;
  phase: 'explore' | 'search' | 'fetch' | 'match' | 'optimize' | 'done' | 'error';
  jobsTotal: number;
  jobsProcessed: number;
}
