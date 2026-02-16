// Agent request/response/event type definitions

export interface AgentSearchRequest {
  jobTitle: string;
  location?: string;
  maxJobs?: number;
  matchThreshold?: number;
  /** @deprecated Resume data is now auto-loaded from disk */
  masterResumeLatex?: string;
  /** @deprecated Resume data is now auto-loaded from disk */
  masterResume?: {
    experiences: string[];
    skills: string[];
    projects: string[];
  };
}

export type AgentStepEvent =
  | { type: 'h1b_scan'; message: string; companies: { company: string; count: number; avgWage: number }[] }
  | { type: 'registry_match'; message: string; matchedCompanies: string[] }
  | { type: 'searching'; company: string; query: string }
  | { type: 'jobs_found'; company: string; count: number }
  | { type: 'fetching'; jobTitle: string; jobUrl: string }
  | { type: 'matched'; jobTitle: string; company: string; score: number; gaps: string[] }
  | { type: 'optimizing'; jobTitle: string; company: string }
  | { type: 'optimized'; jobTitle: string; company: string; changeCount: number }
  | { type: 'error'; message: string }
  | { type: 'self_healing'; tool: string; error: string; message: string }
  | { type: 'code_fix'; filesModified: string[]; summary: string }
  | { type: 'new_provider'; company: string; platform: string }
  | { type: 'memory_recall'; message: string; pastSearches?: number; insights?: number }
  | { type: 'memory_store'; message: string; category: string }
  | { type: 'resume_loaded'; message: string; experiences: number; skills: number; projects: number }
  | { type: 'memory_health'; message: string; fixed: boolean; filesModified: string[] }
  | { type: 'file_saved'; filePath: string; company: string }
  | { type: 'pdf_compiled'; pdfPath: string; compilationMethod: string };

export interface AgentJobResult {
  title: string;
  company: string;
  url: string;
  location: string;
  h1bAvgWage: number;
  matchScore: number;
  gaps: string[];
  strengths: string[];
  optimizedResume?: {
    latex: string;
    changes: { section: string; reasoning: string }[];
    summary: string;
  };
}

export interface AgentSearchResponse {
  jobTitle: string;
  totalH1bSponsors: number;
  companiesSearched: number;
  jobsAnalyzed: number;
  results: AgentJobResult[];
}

export interface CodeAgentInput {
  toolName: string;
  error: string;
  args: Record<string, unknown>;
  stackTrace?: string;
}

export interface CodeAgentResult {
  fixed: boolean;
  filesModified: string[];
  summary: string;
  newProviderCreated?: string;
}
