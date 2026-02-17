/**
 * SuperMemory Type Definitions
 *
 * Defines TypeScript types for memory objects, API responses, and sync operations.
 */

// ============================================
// Memory Types (Container Tags)
// ============================================

export type MemoryType =
  | 'resume_component'    // Individual resume experiences, skills, projects
  | 'job_posting'         // Scanned job postings
  | 'resume_version'      // Tailored resume versions
  | 'cover_letter'        // Generated cover letters
  | 'application_outcome' // Application results (interview, offer, rejection)
  | 'change_pattern'      // Successful optimization patterns
  | 'master_resume';      // User's master resume

export type ComponentType =
  | 'experience'
  | 'skill'
  | 'project'
  | 'education'
  | 'summary';

export type ApplicationStatus =
  | 'scanned'
  | 'applied'
  | 'interviewing'
  | 'rejected'
  | 'offer';

// ============================================
// Memory Metadata Interfaces
// ============================================

export interface BaseMemoryMetadata {
  type: MemoryType;
  userId: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ResumeComponentMetadata extends BaseMemoryMetadata {
  type: 'resume_component';
  componentType: ComponentType;
  componentId: string;
  title?: string;
  company?: string;
  years?: string;
  technologies?: string[];
  keywords?: string[];
}

export interface JobPostingMetadata extends BaseMemoryMetadata {
  type: 'job_posting';
  jobId: string;
  jobTitle: string;
  company: string;
  location?: string;
  salary?: string;
  employmentType?: string;
  url: string;
  status: ApplicationStatus;
  industry?: string;
  seniority?: string;
  technologies?: string[];
  scannedAt: number;
}

export interface ResumeVersionMetadata extends BaseMemoryMetadata {
  type: 'resume_version';
  versionId: string;
  jobId: string;
  jobTitle?: string;
  company?: string;
  overallMatchScore: number;
  changesCount: number;
  acceptedChangesCount?: number;
  optimizedAt: number;
  wasAccepted?: boolean;
}

export interface CoverLetterMetadata extends BaseMemoryMetadata {
  type: 'cover_letter';
  letterId: string;
  jobId: string;
  jobTitle?: string;
  company?: string;
  tone?: string;
  generatedAt: number;
}

export interface ApplicationOutcomeMetadata extends BaseMemoryMetadata {
  type: 'application_outcome';
  outcomeId: string;
  jobId: string;
  versionId?: string;
  status: ApplicationStatus;
  responseTime?: number; // days to response
  interviewDate?: number;
  feedback?: string;
  notes?: string;
}

export interface ChangePatternMetadata extends BaseMemoryMetadata {
  type: 'change_pattern';
  patternId: string;
  changeType: 'added' | 'modified' | 'deleted';
  context: string; // What type of job/industry
  successRate: number; // 0-100
  timesUsed: number;
}

export type MemoryMetadata =
  | ResumeComponentMetadata
  | JobPostingMetadata
  | ResumeVersionMetadata
  | CoverLetterMetadata
  | ApplicationOutcomeMetadata
  | ChangePatternMetadata;

// ============================================
// Memory Objects (Full Structure)
// ============================================

export interface Memory<T extends MemoryMetadata = MemoryMetadata> {
  id: string;
  content: string;
  userId: string;
  containerTags: string[];
  metadata: T;
  customId?: string;
  createdAt: number;
  updatedAt?: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface AddMemoryRequest {
  content: string;
  userId: string;
  containerTags: string[];
  customId?: string;
  metadata?: Record<string, unknown>;
}

export interface AddMemoryResponse {
  id: string;
  success: boolean;
  message?: string;
}

// SuperMemory search result (matches SDK response structure)
export interface SearchMemoryResult<T extends MemoryMetadata = MemoryMetadata> {
  id: string;
  content: string;
  metadata: T;
  score: number; // Relevance score (0-1)
  containerTags: string[];
}

// Our custom search response wrapper
export interface SearchMemoryResponse<T extends MemoryMetadata = MemoryMetadata> {
  results: SearchMemoryResult<T>[];
  total: number;
  query: string;
}

// ============================================
// Sync Operation Types
// ============================================

export interface SyncStatus {
  isEnabled: boolean;
  isSyncing: boolean;
  lastSyncAt?: number;
  syncError?: string;
  stats: {
    totalMemories: number;
    resumeComponents: number;
    jobs: number;
    resumeVersions: number;
    coverLetters: number;
    outcomes: number;
  };
}

export interface SyncOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  memoryType: MemoryType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface SyncResult {
  success: boolean;
  operationsCompleted: number;
  operationsFailed: number;
  errors: Array<{ operation: SyncOperation; error: string }>;
  duration: number; // milliseconds
}

// ============================================
// Context Retrieval Types
// ============================================

export interface ResumeContext {
  relevantExperiences: SearchMemoryResult<ResumeComponentMetadata>[];
  relevantSkills: SearchMemoryResult<ResumeComponentMetadata>[];
  relevantProjects: SearchMemoryResult<ResumeComponentMetadata>[];
  pastOptimizations: SearchMemoryResult<ResumeVersionMetadata>[];
  successPatterns: SearchMemoryResult<ChangePatternMetadata>[];
}

export interface JobContext {
  similarJobs: SearchMemoryResult<JobPostingMetadata>[];
  successfulApplications: SearchMemoryResult<ApplicationOutcomeMetadata>[];
  relevantResumes: SearchMemoryResult<ResumeVersionMetadata>[];
}

// ============================================
// Error Types
// ============================================

export class SuperMemoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SuperMemoryError';
  }
}

export class SuperMemoryAPIError extends SuperMemoryError {
  constructor(
    message: string,
    status: number,
    details?: unknown
  ) {
    super(message, 'API_ERROR', status, details);
    this.name = 'SuperMemoryAPIError';
  }
}

export class SuperMemorySyncError extends SuperMemoryError {
  constructor(
    message: string,
    public operations: SyncOperation[]
  ) {
    super(message, 'SYNC_ERROR');
    this.name = 'SuperMemorySyncError';
  }
}

// ============================================
// Utility Types
// ============================================

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
