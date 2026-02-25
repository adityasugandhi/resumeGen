// lib/ai/agent barrel — re-exports public API from agent modules

// Types
export type {
  AgentSearchRequest,
  AgentStepEvent,
  AgentJobResult,
  AgentSearchResponse,
  CodeAgentInput,
  CodeAgentResult,
  JobSearchAgentOptions,
  PipelineStage,
  InterventionAction,
  InterventionResponse,
  CodeAgentOptions,
} from './types';

// Job Search Agent (3-phase parallel orchestrator)
export { runJobSearchAgent, runJobSearchAgentLegacy } from './job-search-agent';

// Sub-agents
export { runDiscoveryPhase } from './sub-agents/discovery-agent';
export { processCompany } from './sub-agents/company-worker';
export { processJob } from './sub-agents/job-processor';
export { WriteQueue, Semaphore, lanceWriteQueue } from './sub-agents/write-queue';
export type {
  DiscoveryResult,
  TargetCompany,
  CompanyWorkerResult,
  JobWorkerResult,
  WorkerProgress,
} from './sub-agents/types';

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
