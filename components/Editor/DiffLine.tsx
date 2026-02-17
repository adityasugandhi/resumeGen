'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface DiffLineData {
  id: string;
  lineNumber: number;
  type: 'unchanged' | 'added' | 'deleted' | 'modified';
  content: string;
  charDiffs?: Array<{
    start: number;
    end: number;
    type: 'added' | 'deleted';
  }>;
  changeId?: string;
}

interface DiffLineProps {
  line: DiffLineData;
  isHovered?: boolean;
  isSelected?: boolean;
  onHover?: (lineId: string | null) => void;
  onClick?: (lineId: string) => void;
}

export default function DiffLine({
  line,
  isHovered = false,
  isSelected = false,
  onHover,
  onClick,
}: DiffLineProps) {
  const getLineStyles = () => {
    switch (line.type) {
      case 'added':
        return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'deleted':
        return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through';
      case 'modified':
        return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      default:
        return 'text-gray-900 dark:text-gray-100';
    }
  };

  const getChangeMarker = () => {
    switch (line.type) {
      case 'added':
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold">
            +
          </span>
        );
      case 'deleted':
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
            -
          </span>
        );
      case 'modified':
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
            ~
          </span>
        );
      default:
        return null;
    }
  };

  const renderContentWithHighlights = () => {
    if (!line.charDiffs || line.charDiffs.length === 0) {
      return <span>{line.content}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    line.charDiffs.forEach((diff, idx) => {
      // Add text before the diff
      if (diff.start > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>{line.content.substring(lastIndex, diff.start)}</span>
        );
      }

      // Add highlighted diff
      const highlightClass =
        diff.type === 'added'
          ? 'bg-emerald-200 dark:bg-emerald-700 font-semibold'
          : 'bg-red-200 dark:bg-red-700 font-semibold';

      parts.push(
        <span key={`diff-${idx}`} className={highlightClass}>
          {line.content.substring(diff.start, diff.end)}
        </span>
      );

      lastIndex = diff.end;
    });

    // Add remaining text
    if (lastIndex < line.content.length) {
      parts.push(<span key="text-end">{line.content.substring(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      data-change-id={line.changeId}
      className={`
        group flex items-start gap-3 px-4 py-2 border-l-2 transition-all duration-200
        ${getLineStyles()}
        ${isHovered ? 'bg-opacity-80 dark:bg-opacity-80' : ''}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'border-transparent'}
        ${onClick ? 'cursor-pointer hover:bg-opacity-70' : ''}
      `}
      onMouseEnter={() => onHover?.(line.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(line.id)}
    >
      {/* Line Number */}
      <span className="flex-shrink-0 w-12 text-right text-xs text-gray-500 dark:text-gray-400 font-mono select-none">
        {line.lineNumber}
      </span>

      {/* Change Marker */}
      {line.type !== 'unchanged' && (
        <div className="flex-shrink-0 mt-0.5">{getChangeMarker()}</div>
      )}

      {/* Content */}
      <pre className="flex-1 font-mono text-sm whitespace-pre-wrap break-words">
        {renderContentWithHighlights()}
      </pre>
    </motion.div>
  );
}
