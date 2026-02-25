'use client';

import { useEffect, useState } from 'react';
import { Users, Building2, Briefcase, Target, XCircle, Layers, Clock } from 'lucide-react';
import { formatDuration } from '@/lib/agent-event-utils';
import type { AgentRun } from '@/store/agentRunStore';

interface LiveStatsPanelProps {
  run: AgentRun | undefined;
}

export default function LiveStatsPanel({ run }: LiveStatsPanelProps) {
  const [now, setNow] = useState(Date.now());

  // Tick every second for elapsed time
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [run?.status]);

  if (!run) {
    return (
      <div className="w-72 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center p-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Select a run to view stats</p>
      </div>
    );
  }

  const isRunning = run.status === 'running';
  const elapsed = (run.completedAt || now) - run.startedAt;

  const statItems = [
    { label: 'Active Workers', value: run.stats.activeWorkers, icon: Users, color: 'text-violet-500' },
    { label: 'Companies Searched', value: run.stats.companiesSearched, icon: Building2, color: 'text-cyan-500' },
    { label: 'Jobs Found', value: run.stats.jobsFound, icon: Briefcase, color: 'text-teal-500' },
    { label: 'Jobs Matched', value: run.stats.jobsMatched, icon: Target, color: 'text-green-500' },
    { label: 'Errors', value: run.stats.errors, icon: XCircle, color: 'text-red-500' },
  ];

  const phaseLabels: Record<string, string> = {
    discovery: 'Discovery',
    processing: 'Processing',
    summarize: 'Summarize',
  };

  const workers = Object.values(run.workers);

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          {isRunning ? 'Live Stats' : 'Run Summary'}
        </h3>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <Clock className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-[10px] text-gray-400">Elapsed</p>
            <p className="text-sm font-bold font-mono text-gray-900 dark:text-white">{formatDuration(elapsed)}</p>
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Phase</span>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-center ${
          isRunning ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 animate-pulse' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}>
          {phaseLabels[run.currentPhase] || run.currentPhase}
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-3 space-y-2">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
          >
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Worker progress cards (only during running or if workers exist) */}
      {workers.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Workers</h4>
          <div className="space-y-2">
            {workers.map((worker) => {
              const progress = worker.jobsTotal > 0 ? (worker.jobsProcessed / worker.jobsTotal) * 100 : 0;
              const isDone = worker.phase === 'done';
              return (
                <div
                  key={worker.company}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-gray-900 dark:text-gray-100 truncate">
                      {worker.company}
                    </span>
                    <span className={`text-[10px] ${isDone ? 'text-emerald-500' : 'text-violet-500'}`}>
                      {worker.phase}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-violet-500'}`}
                      style={{ width: `${isDone ? 100 : progress}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 text-right mt-0.5">
                    {worker.jobsProcessed}/{worker.jobsTotal}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result count for completed runs */}
      {run.result && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{run.result.results.length}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Jobs Matched</p>
          </div>
        </div>
      )}
    </div>
  );
}
