'use client';

import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResumeChange } from '@/lib/indexeddb';
import { cn } from '@/lib/utils';
import GlareHover from '@/components/GlareHover';

interface ChangeCardProps {
  change: ResumeChange;
  isAccepted: boolean;
  isRejected: boolean;
  onAccept: () => void;
  onReject: () => void;
  onHover: () => void;
  onClick: () => void;
}

// Category badge colors
const CATEGORY_COLORS: Record<string, string> = {
  grammar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  style: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  keyword_optimization: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  clarity: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  impact: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
  latex_formatting: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700',
};

const CHANGE_TYPE_COLORS: Record<ResumeChange['type'], string> = {
  added: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700',
  modified: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  deleted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
};

const CHANGE_TYPE_ICONS: Record<ResumeChange['type'], string> = {
  added: '+',
  modified: '~',
  deleted: '-',
};

export default function ChangeCard({
  change,
  isAccepted,
  isRejected,
  onAccept,
  onReject,
  onHover,
  onClick,
}: ChangeCardProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  return (
    <GlareHover>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'rounded-xl border-2 transition-all duration-200',
          CHANGE_TYPE_COLORS[change.type],
          isAccepted && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900',
          isRejected && 'opacity-50',
          'cursor-pointer hover:shadow-lg'
        )}
        onMouseEnter={onHover}
        onClick={onClick}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {/* Change Type Icon */}
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-gray-800 text-sm font-bold shadow-sm flex-shrink-0">
                  {CHANGE_TYPE_ICONS[change.type]}
                </span>

                {/* Section Label */}
                <span className="font-semibold text-sm truncate">
                  {change.section}
                </span>

                {/* Line Number */}
                {change.lineNumber && (
                  <span className="text-xs opacity-75 flex-shrink-0">
                    Line {change.lineNumber}
                  </span>
                )}
              </div>

              {/* Type Badge */}
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-white/50 dark:bg-gray-800/50 border">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept();
                }}
                className={cn(
                  'p-2 rounded-lg transition-all shadow-sm',
                  isAccepted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                title={isAccepted ? 'Accepted' : 'Accept change'}
              >
                <Check className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                className={cn(
                  'p-2 rounded-lg transition-all shadow-sm',
                  isRejected
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                title={isRejected ? 'Rejected' : 'Reject change'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Diff */}
          <div className="space-y-2">
            {/* Original Content */}
            {change.originalContent && (
              <div>
                <p className="text-xs opacity-75 mb-1 font-medium">Original:</p>
                <pre className="text-xs bg-white/50 dark:bg-gray-800/50 p-2 rounded border border-current/20 overflow-x-auto font-mono">
                  {change.originalContent}
                </pre>
              </div>
            )}

            {/* New Content */}
            {change.newContent && (
              <div>
                <p className="text-xs opacity-75 mb-1 font-medium">
                  {change.type === 'added' ? 'Added:' : 'New:'}
                </p>
                <pre className="text-xs bg-white/50 dark:bg-gray-800/50 p-2 rounded border border-current/20 overflow-x-auto font-mono">
                  {change.newContent}
                </pre>
              </div>
            )}
          </div>

          {/* Reasoning (Expandable) */}
          <div className="mt-3 pt-3 border-t border-current/20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsReasoningExpanded(!isReasoningExpanded);
              }}
              className="flex items-center justify-between w-full text-xs font-medium opacity-75 hover:opacity-100 transition-opacity"
            >
              <span>Reasoning</span>
              {isReasoningExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {isReasoningExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-xs italic mt-2 opacity-75">
                    {change.reasoning}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </GlareHover>
  );
}
