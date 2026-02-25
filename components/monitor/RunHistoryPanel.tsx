'use client';

import { useState } from 'react';
import { Search, Trash2, Loader2, CheckCircle2, XCircle, Ban, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatDuration } from '@/lib/agent-event-utils';
import { useAgentRunStore, type AgentRun } from '@/store/agentRunStore';

const statusConfig: Record<AgentRun['status'], { icon: typeof CheckCircle2; color: string; label: string }> = {
  running: { icon: Loader2, color: 'text-violet-500', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  cancelled: { icon: Ban, color: 'text-gray-400', label: 'Cancelled' },
};

export default function RunHistoryPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const { runs, selectedRunId, activeRunId, selectRun, clearHistory } = useAgentRunStore();

  const filteredRuns = searchQuery
    ? runs.filter((r) => r.request.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
    : runs;

  return (
    <div className="w-60 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Run History
          </h3>
          {runs.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Clear history"
            >
              <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter runs..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {filteredRuns.length === 0 ? (
          <div className="p-4 text-center">
            <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-400 dark:text-gray-500">No runs yet</p>
          </div>
        ) : (
          filteredRuns.map((run) => {
            const config = statusConfig[run.status];
            const StatusIcon = config.icon;
            const isSelected = run.id === selectedRunId;
            const isActive = run.id === activeRunId;
            const duration = (run.completedAt || Date.now()) - run.startedAt;
            const resultCount = run.result?.results.length ?? 0;

            return (
              <button
                key={run.id}
                onClick={() => selectRun(run.id)}
                className={cn(
                  'w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors',
                  isSelected && 'bg-violet-50 dark:bg-violet-950/30',
                  isActive && 'ring-1 ring-inset ring-green-400 dark:ring-green-600'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon className={cn('w-3.5 h-3.5 shrink-0', config.color, run.status === 'running' && 'animate-spin')} />
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                    {run.request.jobTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                  <span>{formatRelativeTime(run.startedAt)}</span>
                  <div className="flex items-center gap-2">
                    {resultCount > 0 && <span>{resultCount} results</span>}
                    <span className="font-mono">{formatDuration(duration)}</span>
                  </div>
                </div>
                {run.request.targetCompany && (
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {run.request.targetCompany}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
