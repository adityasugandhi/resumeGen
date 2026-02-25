'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { eventConfig, getEventMessage, formatTimestamp } from '@/lib/agent-event-utils';
import type { TimestampedEvent } from '@/store/agentRunStore';

interface EventLogRowProps {
  tsEvent: TimestampedEvent;
  runStartedAt: number;
}

const levelColors: Record<string, { badge: string; text: string }> = {
  info: { badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', text: 'text-gray-600 dark:text-gray-400' },
  warn: { badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  error: { badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400', text: 'text-red-600 dark:text-red-400' },
};

export default function EventLogRow({ tsEvent, runStartedAt }: EventLogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const config = eventConfig[tsEvent.event.type] || eventConfig.error;
  const Icon = config.icon;
  const colors = levelColors[tsEvent.level] || levelColors.info;
  const elapsed = tsEvent.receivedAt - runStartedAt;

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        {/* Timestamp */}
        <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0 w-[90px]">
          {formatTimestamp(tsEvent.receivedAt)}
        </span>

        {/* Level badge */}
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 w-[46px] text-center ${colors.badge}`}>
          {tsEvent.level}
        </span>

        {/* Icon */}
        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${config.bgColor}`}>
          <Icon className={`w-3 h-3 ${config.color}`} />
        </div>

        {/* Source tag */}
        <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 shrink-0 max-w-[100px] truncate">
          [{tsEvent.source}]
        </span>

        {/* Message */}
        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
          {getEventMessage(tsEvent.event)}
        </span>

        {/* Duration badge */}
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 shrink-0">
          +{elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}
        </span>

        {/* Expand chevron */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded JSON payload */}
      {expanded && (
        <div className="mx-3 mb-2 p-3 rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-700 overflow-x-auto">
          <pre className="font-mono text-[10px] text-gray-300 whitespace-pre-wrap break-all">
            {JSON.stringify(tsEvent.event, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
