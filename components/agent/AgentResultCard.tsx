'use client';

import { ExternalLink, MapPin, DollarSign, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { MatchScoreBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { AgentJobResult } from '@/lib/ai/agent/types';

interface AgentResultCardProps {
  result: AgentJobResult;
  index: number;
  onAddToPipeline: (result: AgentJobResult) => void;
}

export default function AgentResultCard({ result, index, onAddToPipeline }: AgentResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-lg transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {result.title}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{result.company}</p>
        </div>
        <MatchScoreBadge score={result.matchScore} />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
        {result.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {result.location}
          </span>
        )}
        {result.h1bAvgWage > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            ${Math.round(result.h1bAvgWage / 1000)}k avg H1B
          </span>
        )}
        {result.optimizedResume && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <FileText className="w-3 h-3" />
            Resume optimized
          </span>
        )}
      </div>

      {/* Strengths */}
      {result.strengths.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {result.strengths.slice(0, 4).map((s, i) => (
            <Badge key={i} variant="success" size="sm">{s}</Badge>
          ))}
        </div>
      )}

      {/* Gaps */}
      {result.gaps.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {result.gaps.slice(0, 3).map((g, i) => (
            <Badge key={i} variant="danger" size="sm">{g}</Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onAddToPipeline(result)}
        >
          Add to Pipeline
        </Button>
        {result.url && (
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ExternalLink className="w-3 h-3" />}
            onClick={() => window.open(result.url, '_blank')}
          >
            View Job
          </Button>
        )}
      </div>
    </motion.div>
  );
}
