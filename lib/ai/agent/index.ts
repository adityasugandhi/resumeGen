// lib/ai/agent barrel — re-exports public API from agent modules

// Types
export type {
  AgentSearchRequest,
  AgentStepEvent,
  AgentJobResult,
  AgentSearchResponse,
  CodeAgentInput,
  CodeAgentResult,
} from './types';

// Job Search Agent
export { runJobSearchAgent } from './job-search-agent';
export type { JobSearchAgentOptions } from './job-search-agent';

// Code Agent
export { runCodeAgent } from './code-agent';

// Memory Health Agent
export { runMemoryHealthAgent } from './memory-health-agent';
export type { HealthCheckResult } from './memory-health-agent';

// Tools
export { createAgentTools } from './tools';
export type { AgentTool } from './tools';

// Code Tools
export { codeTools, formatErrorContext } from './code-tools';
export type { CodeTool } from './code-tools';

// Memory Health Tools
export { memoryHealthTools, formatHealthContext } from './memory-health-tools';
export type { HealthCheckInput } from './memory-health-tools';

// Memory Indexer
export { indexExistingResumes } from './memory-indexer';
export type { IndexResult, IndexProgressCallback } from './memory-indexer';

// Resume Loader
export {
  loadMasterResume,
  loadResumeForAgent,
  extractResumeComponents,
  selectBestBaseResume,
  listTailoredResumePaths,
} from './resume-loader';
export type {
  ExperienceVariation,
  ProjectVariation,
  ResumeComponents,
  MasterResumeData,
} from './resume-loader';
