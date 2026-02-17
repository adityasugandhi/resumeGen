'use client';

import React from 'react';
import { Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import CountUp from '@/components/CountUp';

interface SuggestionHeaderProps {
  summary: string;
  confidence: number;
  changeCount: number;
  acceptedCount: number;
}

export default function SuggestionHeader({
  summary,
  confidence,
  changeCount,
  acceptedCount,
}: SuggestionHeaderProps) {
  const pendingCount = changeCount - acceptedCount;
  const progressPercentage = changeCount > 0 ? (acceptedCount / changeCount) * 100 : 0;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (conf >= 60) return 'text-blue-600 dark:text-blue-400';
    if (conf >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBg = (conf: number) => {
    if (conf >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (conf >= 60) return 'bg-blue-100 dark:bg-blue-900/30';
    if (conf >= 40) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="border-b border-border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
      <div className="px-6 py-5">
        {/* Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-blue-600 dark:bg-blue-500">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            AI Resume Optimization
          </h2>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          {summary}
        </p>

        {/* Stats Grid */}
        <div className="flex items-center gap-6">
          {/* Confidence Score */}
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${getConfidenceBg(confidence)}`}>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Confidence
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${getConfidenceColor(confidence)}`}>
                  <CountUp to={confidence} duration={1.2} />
                  <span className="text-xl">%</span>
                </span>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="h-12 w-px bg-border" />

          {/* Change Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{acceptedCount}</span> accepted
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{pendingCount}</span> pending
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{changeCount}</span> total changes
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {progressPercentage.toFixed(0)}% of changes reviewed
          </p>
        </div>
      </div>
    </div>
  );
}
