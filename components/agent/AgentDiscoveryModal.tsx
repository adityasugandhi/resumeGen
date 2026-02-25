'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Sparkles,
  Search,
  MapPin,
  Building2,
  Hash,
  Target,
  Briefcase,
  BarChart3,
  Loader2,
  XCircle,
  CheckCircle2,
  Plus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAgentStream } from '@/hooks/useAgentStream';
import { useJobStore } from '@/store/jobStore';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { useEditorStore } from '@/store/editorStore';
import { useAgentRunStore } from '@/store/agentRunStore';
import AgentTimeline from './AgentTimeline';
import AgentResultCard from './AgentResultCard';
import AgentPipelineStepper from './AgentPipelineStepper';
import { AgentInterventionPanel } from './AgentInterventionPanel';
import type { AgentStepEvent, AgentSearchResponse, AgentJobResult, AgentSearchRequest, PipelineStage, InterventionAction } from '@/lib/ai/agent/types';

type Phase = 'form' | 'running' | 'results';

interface AgentDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentDiscoveryModal({ isOpen, onClose }: AgentDiscoveryModalProps) {
  const [phase, setPhase] = useState<Phase>('form');
  const [addedJobs, setAddedJobs] = useState<Set<string>>(new Set());

  // Form state
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [maxJobs, setMaxJobs] = useState('5');
  const [matchThreshold, setMatchThreshold] = useState('60');

  // Current run ID for this modal session
  const runIdRef = useRef<string | null>(null);

  // Agent run store
  const { startRun, addEvent, completeRun, failRun, cancelRun, getActiveRun } = useAgentRunStore();

  // Derive display state from the active run
  const activeRun = useAgentRunStore((s) => s.getActiveRun());
  const events = useMemo(() => activeRun?.events.map((e) => e.event) ?? [], [activeRun?.events]);
  const result = activeRun?.result ?? null;
  const stats = activeRun?.stats ?? { companiesSearched: 0, jobsFound: 0, jobsMatched: 0, errors: 0, activeWorkers: 0 };
  const currentPhase = activeRun?.currentPhase ?? 'discovery';
  const pendingIntervention = activeRun?.pendingIntervention ?? null;

  // Convert pipelineStages record to Map for AgentPipelineStepper
  const pipelineStages = useMemo(() => {
    const map = new Map<PipelineStage, 'active' | 'completed' | 'skipped'>();
    if (activeRun) {
      Object.entries(activeRun.pipelineStages).forEach(([key, value]) => {
        map.set(key as PipelineStage, value);
      });
    }
    return map;
  }, [activeRun?.pipelineStages]);

  // Convert workers record to Map for AgentPipelineStepper
  const workers = useMemo(() => {
    const map = new Map<string, { company: string; phase: string; jobsTotal: number; jobsProcessed: number }>();
    if (activeRun) {
      Object.entries(activeRun.workers).forEach(([key, value]) => {
        map.set(key, value);
      });
    }
    return map;
  }, [activeRun?.workers]);

  const { addJob } = useJobStore();

  const handleStep = useCallback((event: AgentStepEvent) => {
    if (runIdRef.current) {
      addEvent(runIdRef.current, event);
    }
  }, [addEvent]);

  const handleResult = useCallback(async (res: AgentSearchResponse) => {
    if (runIdRef.current) {
      completeRun(runIdRef.current, res);
    }
    setPhase('results');

    // Sync agent-created resumes from disk to IndexedDB
    try {
      const syncRes = await fetch('/api/resumes/sync');
      if (syncRes.ok) {
        const { companies } = await syncRes.json();
        if (companies && companies.length > 0) {
          const agentResults = res.results.map((r) => ({
            company: r.company,
            title: r.title,
            url: r.url,
            matchScore: r.matchScore,
          }));

          const { importFromDisk } = useFileSystemStore.getState();
          const mostRecentId = await importFromDisk(companies, agentResults);

          // Focus editor on most recently created file
          if (mostRecentId) {
            const file = useFileSystemStore.getState().getFile(mostRecentId);
            if (file) {
              useEditorStore.getState().setCurrentFile(file.id);
              useEditorStore.getState().setContent(file.content || '');
            }
          }

          const totalFiles = companies.reduce((sum: number, c: { files: unknown[] }) => sum + c.files.length, 0);
          toast.success(`Synced ${totalFiles} resumes from ${companies.length} companies to editor`);
        }
      }
    } catch (err) {
      console.error('Failed to sync resumes:', err);
    }
  }, []);

  const handleError = useCallback((error: string) => {
    if (runIdRef.current) {
      failRun(runIdRef.current, error);
    }
    toast.error(`Agent error: ${error}`);
    setPhase('form');
  }, [failRun]);

  const handleIntervention = useCallback((streamId: string, tool: string, error: string) => {
    // Intervention is tracked by the store via addEvent for intervention_required events
    // This callback is kept for the useAgentStream hook but the store handles the state
    void streamId; void tool; void error;
  }, []);

  const { start, cancel, respond, isRunning } = useAgentStream({
    onStep: handleStep,
    onResult: handleResult,
    onError: handleError,
    onIntervention: handleIntervention,
  });

  const handleInterventionRespond = useCallback((streamId: string, action: InterventionAction, prompt?: string) => {
    respond(streamId, action, prompt);
  }, [respond]);

  const handleSubmit = () => {
    if (!jobTitle.trim()) {
      toast.error('Job title is required');
      return;
    }

    const request: AgentSearchRequest = {
      jobTitle: jobTitle.trim(),
      location: location.trim() || undefined,
      targetCompany: targetCompany.trim() || undefined,
      maxJobs: parseInt(maxJobs) || 5,
      matchThreshold: parseInt(matchThreshold) || 60,
    };

    // Start run in shared store
    const runId = startRun(request);
    runIdRef.current = runId;
    setAddedJobs(new Set());
    setPhase('running');

    start(request);
  };

  const handleCancel = () => {
    if (runIdRef.current) {
      cancelRun(runIdRef.current);
    }
    cancel();
    setPhase('form');
  };

  const handleAddToPipeline = async (jobResult: AgentJobResult) => {
    const jobKey = `${jobResult.company}-${jobResult.title}`;
    if (addedJobs.has(jobKey)) return;

    await addJob({
      id: crypto.randomUUID(),
      url: jobResult.url,
      title: jobResult.title,
      company: jobResult.company,
      location: jobResult.location,
      description: jobResult.strengths.join(', '),
      requirements: jobResult.gaps,
      embedding: [],
      overallMatch: jobResult.matchScore,
      status: 'scanned',
      createdAt: Date.now(),
    });

    setAddedJobs((prev) => new Set(prev).add(jobKey));
    toast.success(`Added ${jobResult.title} at ${jobResult.company}`);
  };

  const handleAddAll = async () => {
    if (!result) return;
    for (const r of result.results) {
      await handleAddToPipeline(r);
    }
    toast.success(`Added ${result.results.length} jobs to pipeline`);
  };

  const handleClose = () => {
    if (isRunning) {
      if (runIdRef.current) {
        cancelRun(runIdRef.current);
      }
      cancel();
    }
    setPhase('form');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <ModalTitle>AI Job Discovery</ModalTitle>
            <ModalDescription>
              {phase === 'form' && 'Autonomous agent scans H1B sponsors, discovers jobs, and optimizes your resume'}
              {phase === 'running' && 'Agent is running — discovering and analyzing jobs'}
              {phase === 'results' && `Found ${result?.results.length ?? 0} matching jobs`}
            </ModalDescription>
          </div>
        </div>
      </ModalHeader>

      <ModalContent>
        <AnimatePresence mode="wait">
          {/* FORM PHASE */}
          {phase === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <Input
                label="Job Title *"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Software Engineer, ML Engineer, etc."
                leftIcon={<Search className="w-4 h-4" />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="San Francisco, Remote..."
                  leftIcon={<MapPin className="w-4 h-4" />}
                />
                <Input
                  label="Target Company"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="Stripe, Anthropic..."
                  leftIcon={<Building2 className="w-4 h-4" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Max Jobs"
                  type="number"
                  value={maxJobs}
                  onChange={(e) => setMaxJobs(e.target.value)}
                  placeholder="5"
                  leftIcon={<Hash className="w-4 h-4" />}
                />
                <Input
                  label="Match Threshold (%)"
                  type="number"
                  value={matchThreshold}
                  onChange={(e) => setMatchThreshold(e.target.value)}
                  placeholder="60"
                  leftIcon={<Target className="w-4 h-4" />}
                />
              </div>

              <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span className="font-medium text-violet-900 dark:text-violet-200">
                    The agent will scan H1B sponsors, discover companies, search for jobs, match your resume, and optimize it automatically.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* RUNNING PHASE */}
          {phase === 'running' && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Pipeline Stepper — full width */}
              <AgentPipelineStepper stages={pipelineStages} currentPhase={currentPhase} workers={workers} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Timeline — 2 cols */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Live Progress</span>
                  </div>
                  <AgentTimeline events={events} />
                </div>

                {/* Stats sidebar */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Live Stats
                  </h4>
                  {[
                    { label: 'Active Workers', value: stats.activeWorkers, icon: Users, color: 'text-violet-500' },
                    { label: 'Companies Searched', value: stats.companiesSearched, icon: Building2, color: 'text-cyan-500' },
                    { label: 'Jobs Found', value: stats.jobsFound, icon: Briefcase, color: 'text-teal-500' },
                    { label: 'Jobs Matched', value: stats.jobsMatched, icon: Target, color: 'text-green-500' },
                    { label: 'Errors', value: stats.errors, icon: XCircle, color: 'text-red-500' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                    >
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intervention Panel — full width, shown when pending */}
              <AnimatePresence>
                {pendingIntervention && (
                  <AgentInterventionPanel
                    streamId={pendingIntervention.streamId}
                    tool={pendingIntervention.tool}
                    error={pendingIntervention.error}
                    onRespond={handleInterventionRespond}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* RESULTS PHASE */}
          {phase === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{result.totalH1bSponsors}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">H1B Sponsors</p>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-center">
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{result.companiesSearched}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">Companies Searched</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{result.results.length}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Jobs Matched</p>
                </div>
              </div>

              {/* Result cards */}
              {result.results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.results.map((r, i) => (
                    <AgentResultCard
                      key={`${r.company}-${r.title}-${i}`}
                      result={r}
                      index={i}
                      onAddToPipeline={handleAddToPipeline}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No jobs matched your criteria. Try adjusting the threshold or broadening your search.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ModalContent>

      <ModalFooter>
        {phase === 'form' && (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<Sparkles className="w-4 h-4" />}
              onClick={handleSubmit}
              disabled={!jobTitle.trim()}
            >
              Start Discovery
            </Button>
          </>
        )}

        {phase === 'running' && (
          <Button
            variant="danger"
            leftIcon={<XCircle className="w-4 h-4" />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        )}

        {phase === 'results' && (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            {result && result.results.length > 0 && (
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleAddAll}
                disabled={addedJobs.size === result.results.length}
              >
                {addedJobs.size === result.results.length ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    All Added
                  </>
                ) : (
                  `Add All to Pipeline (${result.results.length})`
                )}
              </Button>
            )}
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
