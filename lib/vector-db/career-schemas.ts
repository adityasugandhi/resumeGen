/**
 * LanceDB table schemas for career memory
 * 5 tables stored at ~/.lancedb/career-memory
 */

import { EMBEDDING_DIMENSION } from './schemas';

// Table names
export const CAREER_TABLE_NAMES = {
  RESUME_COMPONENTS: 'career_resume_components',
  JOB_SEARCHES: 'career_job_searches',
  JOB_MATCHES: 'career_job_matches',
  OPTIMIZED_RESUMES: 'career_optimized_resumes',
  LEARNINGS: 'career_learnings',
} as const;

export type CareerTableName = typeof CAREER_TABLE_NAMES[keyof typeof CAREER_TABLE_NAMES];

// ---- Table 1: Resume Components ----
export type ComponentType = 'bullet' | 'skill' | 'project' | 'summary';

export interface ResumeComponentDoc {
  id: string;
  type: ComponentType;
  content: string;
  vector: number[];
  section: string;         // e.g. "experience", "skills", "projects"
  sourceCompany: string;   // Which company resume this came from (or "master")
  keywords: string;        // comma-separated keywords (LanceDB prefers flat fields)
  timesUsed: number;
  avgMatchScore: number;
  createdAt: string;
}

// ---- Table 2: Job Searches ----
export interface JobSearchDoc {
  id: string;
  jobTitle: string;
  location: string;
  vector: number[];
  totalSponsors: number;
  companiesSearched: number;
  topMatches: string;      // JSON-stringified array of {company, score}
  avgMatchScore: number;
  bestCompany: string;
  timestamp: string;
}

// ---- Table 3: Job Matches ----
export interface JobMatchDoc {
  id: string;
  jobTitle: string;
  company: string;
  url: string;
  vector: number[];
  overallScore: number;
  gaps: string;            // JSON-stringified array
  strengths: string;       // JSON-stringified array
  requirements: string;    // JSON-stringified array
  applied: boolean;
  outcome: string;         // "pending" | "applied" | "interview" | "offer" | "rejected"
  createdAt: string;
}

// ---- Table 4: Optimized Resumes ----
export interface OptimizedResumeDoc {
  id: string;
  jobMatchId: string;
  jobTitle: string;
  company: string;
  vector: number[];
  changeCount: number;
  confidenceScore: number;
  filePath: string;        // Path on disk where LaTeX is stored
  createdAt: string;
}

// ---- Table 5: Learnings ----
export type LearningCategory = 'strength' | 'gap' | 'pattern' | 'recommendation';

export interface LearningDoc {
  id: string;
  category: LearningCategory;
  insight: string;
  vector: number[];
  evidence: string;        // JSON-stringified array
  confidence: number;      // 0-1
  createdAt: string;
}

// Search result wrapper
export interface CareerSearchResult<T> {
  doc: T;
  score: number;
  distance: number;
}

// Memory stats
export interface MemoryStats {
  resumeComponents: number;
  jobSearches: number;
  jobMatches: number;
  optimizedResumes: number;
  learnings: number;
  lastIndexedAt: string | null;
}

// Re-export for convenience
export { EMBEDDING_DIMENSION };
