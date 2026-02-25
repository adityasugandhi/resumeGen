'use client';

import { Clock, Building2, Layers } from 'lucide-react';
import { formatDuration } from '@/lib/agent-event-utils';
import type { AgentRun } from '@/store/agentRunStore';

interface MonitorTimingViewProps {
  run: AgentRun;
}

export default function MonitorTimingView({ run }: MonitorTimingViewProps) {
  const totalElapsed = (run.completedAt || Date.now()) - run.startedAt;

  // Phase durations
  const phases = Object.entries(run.timing.phases).map(([name, t]) => ({
    name,
    duration: (t.completedAt || Date.now()) - t.startedAt,
    completed: !!t.completedAt,
  }));

  const maxPhaseDuration = Math.max(...phases.map((p) => p.duration), 1);

  // Company durations sorted by duration desc
  const companies = Object.entries(run.timing.companies)
    .map(([name, t]) => {
      const duration = (t.completedAt || Date.now()) - t.startedAt;
      // Find stats for this company from events
      const workerCompleted = run.events.find(
        (e) => e.event.type === 'worker_completed' && e.source === name
      );
      const jobsFound = run.events.filter(
        (e) => e.event.type === 'jobs_found' && e.source === name
      );
      const totalJobs = jobsFound.reduce((sum, e) => {
        if (e.event.type === 'jobs_found') return sum + e.event.count;
        return sum;
      }, 0);
      const topScore = workerCompleted?.event.type === 'worker_completed' ? workerCompleted.event.topScore : 0;
      const errors = run.events.filter((e) => e.level === 'error' && e.source === name).length;

      return { name, duration, completed: !!t.completedAt, totalJobs, topScore, errors };
    })
    .sort((a, b) => b.duration - a.duration);

  const phaseLabels: Record<string, string> = {
    discovery: 'Discovery',
    processing: 'Parallel Processing',
    summarize: 'Summarization',
  };

  const phaseColors: Record<string, string> = {
    discovery: 'bg-blue-500',
    processing: 'bg-violet-500',
    summarize: 'bg-emerald-500',
  };

  return (
    <div className="space-y-6 p-4">
      {/* Total elapsed */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <Clock className="w-5 h-5 text-gray-500" />
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Elapsed</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">{formatDuration(totalElapsed)}</p>
        </div>
      </div>

      {/* Phase duration bars */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Phase Breakdown</h3>
        </div>
        <div className="space-y-3">
          {phases.map((phase) => (
            <div key={phase.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {phaseLabels[phase.name] || phase.name}
                </span>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {formatDuration(phase.duration)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${phaseColors[phase.name] || 'bg-gray-500'} ${!phase.completed ? 'animate-pulse' : ''}`}
                  style={{ width: `${Math.max((phase.duration / maxPhaseDuration) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Company breakdown table */}
      {companies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Company Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Company</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Duration</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Jobs</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Top Score</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Errors</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.name} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100">{company.name}</td>
                    <td className="py-2 px-2 text-right font-mono text-gray-600 dark:text-gray-400">
                      {formatDuration(company.duration)}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{company.totalJobs}</td>
                    <td className="py-2 px-2 text-right">
                      {company.topScore > 0 ? (
                        <span className={company.topScore >= 70 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                          {company.topScore}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {company.errors > 0 ? (
                        <span className="text-red-600 dark:text-red-400">{company.errors}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
