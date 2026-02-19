// lib/supermemory barrel — re-exports public API from SuperMemory modules

// Types
export type {
  MemoryType,
  ComponentType,
  ApplicationStatus,
  BaseMemoryMetadata,
  ResumeComponentMetadata,
  JobPostingMetadata,
  ResumeVersionMetadata,
  CoverLetterMetadata,
  ApplicationOutcomeMetadata,
  ChangePatternMetadata,
  MemoryMetadata,
  Memory,
  AddMemoryRequest,
  AddMemoryResponse,
  SearchMemoryResult,
  SearchMemoryResponse,
  SyncStatus,
  SyncOperation,
  SyncResult,
  ResumeContext,
  JobContext,
  PartialBy,
  RequiredBy,
} from './types';
export { SuperMemoryError, SuperMemoryAPIError, SuperMemorySyncError } from './types';

// Client
export { getSupermemoryClient, isSupermemoryEnabled, supermemoryClient } from './client';

// Service
export {
  MemoryService,
  ResumeComponentService,
  JobPostingService,
  ResumeVersionService,
  memoryService,
  resumeComponentService,
  jobPostingService,
  resumeVersionService,
} from './service';

// Sync
export { syncAll, syncJob, syncResumeVersion } from './sync';
