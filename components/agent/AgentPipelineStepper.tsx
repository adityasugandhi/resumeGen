'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Globe,
  Building2,
  Users,
  Search,
  FileText,
  Target,
  Sparkles,
  BarChart3,
  Check,
  Layers,
  Zap
} from 'lucide-react';
import { PipelineStage } from '@/lib/ai/agent/types';

interface AgentPipelineStepperProps {
  stages: Map<PipelineStage, 'active' | 'completed' | 'skipped'>;
  currentPhase?: 'discovery' | 'processing' | 'summarize';
  workers?: Map<string, { company: string; phase: string; jobsTotal: number; jobsProcessed: number }>;
}

const DISCOVERY_STAGES: Array<{
  key: PipelineStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'memory_check', label: 'Memory', icon: Brain },
  { key: 'h1b_scan', label: 'H1B Scan', icon: Globe },
  { key: 'cross_reference', label: 'Cross-reference', icon: Building2 },
];

const WORKER_PHASES = [
  { key: 'explore', label: 'Explore', icon: Users },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'fetch', label: 'Fetch', icon: FileText },
  { key: 'match', label: 'Match', icon: Target },
  { key: 'optimize', label: 'Optimize', icon: Sparkles },
  { key: 'done', label: 'Done', icon: Check }
];

export default function AgentPipelineStepper({ stages, currentPhase = 'discovery', workers = new Map() }: AgentPipelineStepperProps) {
  const getStageStatus = (stage: PipelineStage) => {
    return stages.get(stage) || 'pending';
  };

  const getStageClasses = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 animate-pulse';
      case 'completed':
        return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400';
      case 'skipped':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
    }
  };

  const getLineClasses = (currentStatus: string, nextStatus: string) => {
    if (currentStatus === 'completed' && nextStatus === 'completed') {
      return 'bg-emerald-500 dark:bg-emerald-400';
    }
    if (currentStatus === 'completed' && nextStatus === 'active') {
      return 'bg-gradient-to-r from-emerald-500 to-violet-500 dark:from-emerald-400 dark:to-violet-400';
    }
    return 'bg-gray-300 dark:bg-gray-600';
  };

  const getPhaseClasses = (phase: 'discovery' | 'processing' | 'summarize') => {
    if (currentPhase === phase) return 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-700';
    if (phase === 'discovery' && (currentPhase === 'processing' || currentPhase === 'summarize')) return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700';
    if (phase === 'processing' && currentPhase === 'summarize') return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700';
    return 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700';
  };

  const getWorkerPhaseProgress = (workerId: string) => {
    const worker = workers.get(workerId);
    if (!worker) return 0;
    if (worker.jobsTotal === 0) return 0;
    return (worker.jobsProcessed / worker.jobsTotal) * 100;
  };

  return (
    <div className="w-full space-y-4">
      {/* Mobile View */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-3">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Phase: {currentPhase === 'discovery' ? 'Discovery' : currentPhase === 'processing' ? 'Processing' : 'Summary'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {workers.size > 0 ? `${workers.size} active workers` : 'Initializing...'}
              </div>
            </div>
          </div>
        </div>

        {currentPhase === 'processing' && workers.size > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {Array.from(workers.values()).slice(0, 4).map((worker) => (
              <div key={worker.company} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mb-1">
                  {worker.company}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <motion.div
                    className="bg-violet-500 h-1 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${getWorkerPhaseProgress(worker.company)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop View - 3 Phase Layout */}
      <div className="hidden md:block space-y-4">
        {/* Phase 1: Discovery */}
        <div className={`p-4 rounded-xl border-2 transition-all ${getPhaseClasses('discovery')}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Phase 1: Discovery</h3>
          </div>
          <div className="flex items-center justify-between relative">
            {DISCOVERY_STAGES.map((stage, index) => {
              const status = getStageStatus(stage.key);
              const Icon = stage.icon;
              const isLast = index === DISCOVERY_STAGES.length - 1;
              const nextStatus = !isLast ? getStageStatus(DISCOVERY_STAGES[index + 1].key) : null;

              return (
                <React.Fragment key={stage.key}>
                  <motion.div
                    className="flex flex-col items-center gap-2 relative z-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${getStageClasses(status)}`}>
                        {status === 'completed' ? (
                          <>
                            <Icon className="w-5 h-5" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full flex items-center justify-center">
                              <Check className="w-2 h-2 text-white" />
                            </div>
                          </>
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-medium text-center ${status === 'skipped' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {stage.label}
                    </span>
                  </motion.div>

                  {!isLast && (
                    <div className="flex-1 h-0.5 relative -mx-2">
                      <div className="absolute inset-0 bg-gray-300 dark:bg-gray-600" />
                      <motion.div
                        className={`absolute inset-0 origin-left ${getLineClasses(status, nextStatus || 'pending')}`}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: status === 'completed' ? 1 : 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 + 0.1 }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Phase 2: Processing */}
        <div className={`p-4 rounded-xl border-2 transition-all ${getPhaseClasses('processing')}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Phase 2: Parallel Processing</h3>
            {workers.size > 0 && (
              <span className="text-xs bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">
                {workers.size} workers active
              </span>
            )}
          </div>

          {workers.size > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from(workers.values()).map((worker) => {
                const phaseIndex = WORKER_PHASES.findIndex(p => worker.phase.toLowerCase().includes(p.key));
                const PhaseIcon = phaseIndex >= 0 ? WORKER_PHASES[phaseIndex].icon : Layers;

                return (
                  <motion.div
                    key={worker.company}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-violet-100 dark:bg-violet-900/50">
                        <PhaseIcon className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                        {worker.company}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{worker.phase}</span>
                        <span className="text-gray-700 dark:text-gray-300">{worker.jobsProcessed}/{worker.jobsTotal}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <motion.div
                          className="bg-gradient-to-r from-violet-500 to-purple-500 h-1.5 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${getWorkerPhaseProgress(worker.company)}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Waiting for workers to start...</p>
            </div>
          )}
        </div>

        {/* Phase 3: Summary */}
        <div className={`p-4 rounded-xl border-2 transition-all ${getPhaseClasses('summarize')}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Phase 3: Summary</h3>
            {currentPhase === 'summarize' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-auto"
              >
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  Finalizing results...
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}