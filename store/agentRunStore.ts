import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentStepEvent, AgentSearchResponse, AgentSearchRequest } from '@/lib/ai/agent/types';

export type EventLevel = 'info' | 'warn' | 'error';

export interface TimestampedEvent {
  id: string;
  event: AgentStepEvent;
  receivedAt: number;
  level: EventLevel;
  source: string;
}

export interface AgentRunStats {
  companiesSearched: number;
  jobsFound: number;
  jobsMatched: number;
  errors: number;
  activeWorkers: number;
}

export interface AgentRun {
  id: string;
  request: { jobTitle: string; location?: string; targetCompany?: string };
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  events: TimestampedEvent[];
  result?: AgentSearchResponse;
  stats: AgentRunStats;
  currentPhase: 'discovery' | 'processing' | 'summarize';
  pipelineStages: Record<string, 'active' | 'completed' | 'skipped'>;
  workers: Record<string, { company: string; phase: string; jobsTotal: number; jobsProcessed: number }>;
  pendingIntervention: { streamId: string; tool: string; error: string } | null;
  timing: {
    phases: Record<string, { startedAt: number; completedAt?: number }>;
    companies: Record<string, { startedAt: number; completedAt?: number }>;
  };
}

const MAX_RUNS = 30;
const MAX_DISPLAY_EVENTS = 200;

function getEventLevel(type: AgentStepEvent['type']): EventLevel {
  switch (type) {
    case 'error':
    case 'worker_error':
      return 'error';
    case 'self_healing':
    case 'intervention_required':
    case 'code_fix':
    case 'memory_health':
      return 'warn';
    default:
      return 'info';
  }
}

function getEventSource(event: AgentStepEvent): string {
  switch (event.type) {
    case 'h1b_scan': return 'h1b_scan';
    case 'registry_match': return 'registry';
    case 'searching': return event.company;
    case 'jobs_found': return event.company;
    case 'fetching': return 'fetch_job';
    case 'matched': return event.company;
    case 'optimizing': return event.company;
    case 'optimized': return event.company;
    case 'error': return 'agent';
    case 'self_healing': return event.tool;
    case 'code_fix': return 'code_agent';
    case 'memory_recall': return 'memory';
    case 'memory_store': return 'memory';
    case 'resume_loaded': return 'resume';
    case 'engineering_roles': return event.company;
    case 'companies_discovered': return 'discovery';
    case 'company_registered': return event.company;
    case 'file_saved': return event.company;
    case 'pdf_compiled': return 'compiler';
    case 'new_provider': return event.company;
    case 'memory_health': return 'memory';
    case 'pipeline_stage': return event.stage;
    case 'code_agent_step': return 'code_agent';
    case 'intervention_required': return event.tool;
    case 'intervention_resolved': return 'intervention';
    case 'worker_started': return event.company;
    case 'worker_progress': return event.company;
    case 'worker_completed': return event.company;
    case 'worker_error': return event.company;
    case 'parallel_batch': return 'batch';
    case 'phase_transition': return event.phase;
    default: return 'unknown';
  }
}

interface AgentRunStore {
  runs: AgentRun[];
  selectedRunId: string | null;
  activeRunId: string | null;

  // Actions
  startRun: (request: AgentSearchRequest) => string;
  addEvent: (runId: string, event: AgentStepEvent) => void;
  completeRun: (runId: string, result: AgentSearchResponse) => void;
  failRun: (runId: string, error?: string) => void;
  cancelRun: (runId: string) => void;
  selectRun: (runId: string | null) => void;
  clearHistory: () => void;

  // Getters
  getActiveRun: () => AgentRun | undefined;
  getSelectedRun: () => AgentRun | undefined;
  getDisplayRun: () => AgentRun | undefined;
}

export const useAgentRunStore = create<AgentRunStore>()(
  persist(
    (set, get) => ({
      runs: [],
      selectedRunId: null,
      activeRunId: null,

      startRun: (request) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const run: AgentRun = {
          id,
          request: {
            jobTitle: request.jobTitle,
            location: request.location,
            targetCompany: request.targetCompany,
          },
          status: 'running',
          startedAt: now,
          events: [],
          stats: { companiesSearched: 0, jobsFound: 0, jobsMatched: 0, errors: 0, activeWorkers: 0 },
          currentPhase: 'discovery',
          pipelineStages: {},
          workers: {},
          pendingIntervention: null,
          timing: { phases: {}, companies: {} },
        };

        set((state) => ({
          runs: [run, ...state.runs].slice(0, MAX_RUNS),
          activeRunId: id,
          selectedRunId: id,
        }));

        return id;
      },

      addEvent: (runId, event) => {
        const now = Date.now();
        const tsEvent: TimestampedEvent = {
          id: `${runId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
          event,
          receivedAt: now,
          level: getEventLevel(event.type),
          source: getEventSource(event),
        };

        set((state) => {
          const runs = state.runs.map((run) => {
            if (run.id !== runId) return run;

            const updatedRun = { ...run };
            updatedRun.events = [...run.events, tsEvent];

            // Update stats
            const stats = { ...run.stats };
            if (event.type === 'searching') stats.companiesSearched++;
            if (event.type === 'jobs_found') stats.jobsFound += event.count;
            if (event.type === 'matched') stats.jobsMatched++;
            if (event.type === 'error' || event.type === 'worker_error') stats.errors++;
            if (event.type === 'worker_started') stats.activeWorkers++;
            if ((event.type === 'worker_completed' || event.type === 'worker_error') && stats.activeWorkers > 0) {
              stats.activeWorkers--;
            }
            updatedRun.stats = stats;

            // Update pipeline stages
            if (event.type === 'pipeline_stage') {
              updatedRun.pipelineStages = { ...run.pipelineStages, [event.stage]: event.status };
            }

            // Update phase
            if (event.type === 'phase_transition' && event.status === 'started') {
              updatedRun.currentPhase = event.phase;
            }

            // Update timing
            const timing = { phases: { ...run.timing.phases }, companies: { ...run.timing.companies } };
            if (event.type === 'phase_transition') {
              if (event.status === 'started') {
                timing.phases[event.phase] = { startedAt: now };
              } else if (event.status === 'completed' && timing.phases[event.phase]) {
                timing.phases[event.phase] = { ...timing.phases[event.phase], completedAt: now };
              }
            }
            if (event.type === 'worker_started') {
              timing.companies[event.company] = { startedAt: now };
            }
            if (event.type === 'worker_completed' || event.type === 'worker_error') {
              if (timing.companies[event.company]) {
                timing.companies[event.company] = { ...timing.companies[event.company], completedAt: now };
              }
            }
            updatedRun.timing = timing;

            // Update workers
            if (event.type === 'worker_started') {
              updatedRun.workers = {
                ...run.workers,
                [event.company]: { company: event.company, phase: 'starting', jobsTotal: 0, jobsProcessed: 0 },
              };
            }
            if (event.type === 'worker_progress') {
              const existing = run.workers[event.company] || { company: event.company, phase: event.phase, jobsTotal: 0, jobsProcessed: 0 };
              updatedRun.workers = {
                ...run.workers,
                [event.company]: { ...existing, phase: event.phase, jobsTotal: event.jobsTotal, jobsProcessed: event.jobsProcessed },
              };
            }
            if (event.type === 'worker_completed') {
              const existing = run.workers[event.company];
              if (existing) {
                updatedRun.workers = {
                  ...run.workers,
                  [event.company]: { ...existing, phase: 'done', jobsProcessed: existing.jobsTotal },
                };
              }
            }
            if (event.type === 'worker_error') {
              const { [event.company]: _, ...rest } = run.workers;
              updatedRun.workers = rest;
            }

            // Update intervention
            if (event.type === 'intervention_required') {
              updatedRun.pendingIntervention = { streamId: event.streamId, tool: event.tool, error: event.error };
            }
            if (event.type === 'intervention_resolved') {
              updatedRun.pendingIntervention = null;
            }

            return updatedRun;
          });

          return { runs };
        });
      },

      completeRun: (runId, result) => {
        set((state) => ({
          runs: state.runs.map((run) =>
            run.id === runId
              ? { ...run, status: 'completed' as const, completedAt: Date.now(), result, pendingIntervention: null }
              : run
          ),
          activeRunId: state.activeRunId === runId ? null : state.activeRunId,
        }));
      },

      failRun: (runId, error) => {
        set((state) => ({
          runs: state.runs.map((run) =>
            run.id === runId
              ? {
                  ...run,
                  status: 'failed' as const,
                  completedAt: Date.now(),
                  pendingIntervention: null,
                  ...(error ? { events: [...run.events, {
                    id: `${runId}-fail-${Date.now()}`,
                    event: { type: 'error' as const, message: error },
                    receivedAt: Date.now(),
                    level: 'error' as const,
                    source: 'agent',
                  }] } : {}),
                }
              : run
          ),
          activeRunId: state.activeRunId === runId ? null : state.activeRunId,
        }));
      },

      cancelRun: (runId) => {
        set((state) => ({
          runs: state.runs.map((run) =>
            run.id === runId
              ? { ...run, status: 'cancelled' as const, completedAt: Date.now(), pendingIntervention: null }
              : run
          ),
          activeRunId: state.activeRunId === runId ? null : state.activeRunId,
        }));
      },

      selectRun: (runId) => {
        set({ selectedRunId: runId });
      },

      clearHistory: () => {
        const { activeRunId, runs } = get();
        set({
          runs: activeRunId ? runs.filter((r) => r.id === activeRunId) : [],
          selectedRunId: activeRunId,
        });
      },

      getActiveRun: () => {
        const { runs, activeRunId } = get();
        return runs.find((r) => r.id === activeRunId);
      },

      getSelectedRun: () => {
        const { runs, selectedRunId } = get();
        return runs.find((r) => r.id === selectedRunId);
      },

      getDisplayRun: () => {
        const { runs, selectedRunId, activeRunId } = get();
        const id = selectedRunId || activeRunId;
        return id ? runs.find((r) => r.id === id) : runs[0];
      },
    }),
    {
      name: 'agent-run-store',
      version: 1,
      partialize: (state) => ({
        runs: state.runs.map((run) => ({
          ...run,
          // Limit persisted events to last MAX_DISPLAY_EVENTS per run
          events: run.events.slice(-MAX_DISPLAY_EVENTS),
        })),
        selectedRunId: state.selectedRunId,
      }),
    }
  )
);
