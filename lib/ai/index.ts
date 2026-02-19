// lib/ai barrel — re-exports public API from AI modules

// Job Parser
export { JobParser, JobDataSchema } from './job-parser';
export type { JobData } from './job-parser';

// Semantic Matcher
export {
  initEmbedder,
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  findTopMatches,
  calculateJobResumeMatch,
  calculateJobResumeMatchFromText,
  suggestImprovements,
} from './semantic-matcher';

// Resume Optimizer
export { ResumeOptimizer } from './resume-optimizer';
export type { OptimizationResult } from './resume-optimizer';

// LinkedIn Note Generator
export { LinkedInNoteGenerator, LinkedInNoteSchema } from './linkedin-note-generator';
export type { LinkedInNoteResult, LinkedInNoteParams } from './linkedin-note-generator';
