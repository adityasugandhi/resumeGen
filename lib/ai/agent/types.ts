// Agent request/response/event type definitions

// Pipeline stage tracking
export type PipelineStage =
  | 'memory_check'
  | 'h1b_scan'
  | 'cross_reference'
  | 'explore_roles'
  | 'search'
  | 'select'
  | 'fetch'
  | 'match'
  | 'optimize'
  | 'apply'
  | 'summarize';

// Intervention types for user control over self-healing
export type InterventionAction = 'auto_fix' | 'skip' | 'retry' | 'edit_prompt';

export interface InterventionResponse {
  action: InterventionAction;
  prompt?: string;
}

export interface CodeAgentOptions {
  onEvent?: (event: AgentStepEvent) => void;
  additionalPrompt?: string;
}

export interface AgentSearchRequest {
  jobTitle: string;
  location?: string;
  targetCompany?: string;
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
  | { type: 'pdf_compiled'; pdfPath: string; compilationMethod: string }
  | { type: 'engineering_roles'; company: string; totalJobs: number; engineeringCount: number; departments: string[] }
  | { type: 'companies_discovered'; message: string; companies: { name: string; platform: string }[] }
  | { type: 'company_registered'; message: string; company: string; platform: string }
  | { type: 'pipeline_stage'; stage: PipelineStage; status: 'active' | 'completed' | 'skipped' }
  | { type: 'code_agent_step'; action: 'read_file' | 'write_file' | 'list_files' | 'web_search' | 'run_fetch' | 'thinking'; detail: string; iteration: number; maxIterations: number }
  | { type: 'intervention_required'; streamId: string; tool: string; error: string; options: InterventionAction[] }
  | { type: 'intervention_resolved'; action: InterventionAction }
  | { type: 'worker_started'; company: string; workerId: string }
  | { type: 'worker_progress'; company: string; phase: string; jobsTotal: number; jobsProcessed: number }
  | { type: 'worker_completed'; company: string; jobsMatched: number; topScore: number; errors: number }
  | { type: 'worker_error'; company: string; error: string }
  | { type: 'parallel_batch'; batchIndex: number; companies: string[]; status: 'started' | 'completed' }
  | { type: 'phase_transition'; phase: 'discovery' | 'processing' | 'summarize'; status: 'started' | 'completed' }
  | { type: 'applying'; company: string; jobTitle: string; method: 'provider' | 'ai_browser' }
  | { type: 'application_submitted'; success: boolean; method: 'provider' | 'ai_browser'; confirmationId?: string; error?: string }
  | { type: 'browser_action'; action: string; element: string }
  | { type: 'captcha_detected'; company: string; requiresHuman: boolean }
  | { type: 'form_scraped'; fieldCount: number; fields: string[] };

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

export interface JobSearchAgentOptions {
  maxJobs?: number;
  matchThreshold?: number;
  targetCompany?: string;
  onEvent?: (event: AgentStepEvent) => void;
  streamId?: string;
  onIntervention?: (tool: string, error: string) => Promise<InterventionResponse>;
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
