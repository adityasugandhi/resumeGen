'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Award, Lightbulb, ChevronDown, ChevronUp, Filter, Sparkles } from 'lucide-react';
import type { KeywordCategory, ATSScore } from '@/types';
import { CategoryBadge } from './KeywordBadge';
import { IconButton } from '@/components/ui/Button';

interface KeywordAnalysisProps {
  originalScore?: ATSScore;
  optimizedScore?: ATSScore;
  newKeywordsCount?: number;
  onClose?: () => void;
  className?: string;
}

export default function KeywordAnalysis({
  originalScore,
  optimizedScore,
  newKeywordsCount = 0,
  onClose,
  className = '',
}: KeywordAnalysisProps) {
  const [selectedCategory, setSelectedCategory] = useState<KeywordCategory | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['score', 'improvements', 'keywords'])
  );

  const hasComparison = originalScore && optimizedScore;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const improvement = useMemo(() => {
    if (!hasComparison) return null;
    return {
      overall: optimizedScore.overall - originalScore.overall,
      hardSkills: optimizedScore.breakdown.hardSkills - originalScore.breakdown.hardSkills,
      softSkills: optimizedScore.breakdown.softSkills - originalScore.breakdown.softSkills,
      actionVerbs: optimizedScore.breakdown.actionVerbs - originalScore.breakdown.actionVerbs,
      metrics: optimizedScore.breakdown.metrics - originalScore.breakdown.metrics,
      industryTerms: optimizedScore.breakdown.industryTerms - originalScore.breakdown.industryTerms,
    };
  }, [originalScore, optimizedScore, hasComparison]);

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-blue-600 dark:text-blue-400';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const improvementColor = (value: number) => {
    if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`w-80 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto flex flex-col ${className}`}
    >
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-500" />
            Keyword Analysis
          </h3>
          {onClose && (
            <IconButton icon={<X className="w-4 h-4" />} label="Close" variant="ghost" onClick={onClose} />
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">ATS compatibility and keyword breakdown</p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <CollapsibleSection
          title="ATS Match Score"
          icon={<TrendingUp className="w-4 h-4" />}
          isExpanded={expandedSections.has('score')}
          onToggle={() => toggleSection('score')}
        >
          <div className="space-y-4">
            {hasComparison ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Original</div>
                    <div className={`text-2xl font-bold ${scoreColor(originalScore.overall)}`}>{originalScore.overall}%</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{originalScore.grade}</div>
                  </div>
                  <div className="flex items-center justify-center px-3">
                    <div className="flex items-center gap-1">
                      <div className="h-px w-6 bg-gradient-to-r from-gray-300 to-emerald-500" />
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Optimized</div>
                    <div className={`text-2xl font-bold ${scoreColor(optimizedScore.overall)}`}>{optimizedScore.overall}%</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{optimizedScore.grade}</div>
                  </div>
                </div>
                {improvement && improvement.overall !== 0 && (
                  <div className={`text-center py-2 px-3 rounded-lg ${improvement.overall > 0 ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800'}`}>
                    <span className={`text-sm font-semibold ${improvementColor(improvement.overall)}`}>
                      {improvement.overall > 0 ? '+' : ''}{improvement.overall} points
                    </span>
                  </div>
                )}
              </>
            ) : optimizedScore ? (
              <div className="text-center py-6">
                <div className={`text-4xl font-bold mb-2 ${scoreColor(optimizedScore.overall)}`}>{optimizedScore.overall}%</div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Grade: {optimizedScore.grade}</div>
                {optimizedScore.passingScore && (
                  <div className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Award className="w-3 h-3" />Passing Score
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </CollapsibleSection>

        {newKeywordsCount > 0 && (
          <CollapsibleSection
            title={`New Keywords (${newKeywordsCount})`}
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            isExpanded={expandedSections.has('new-keywords')}
            onToggle={() => toggleSection('new-keywords')}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {newKeywordsCount} new keywords added
            </div>
          </CollapsibleSection>
        )}

        {improvement && optimizedScore && (
          <CollapsibleSection
            title="Key Improvements"
            icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
            isExpanded={expandedSections.has('improvements')}
            onToggle={() => toggleSection('improvements')}
          >
            <div className="space-y-2">
              {Object.entries(improvement)
                .filter(([key]) => key !== 'overall')
                .map(([key, value]) => {
                  if (value === 0) return null;
                  const label = key.replace(/([A-Z])/g, ' $1').trim();
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{label}</span>
                      <span className={`font-semibold ${improvementColor(value)}`}>
                        {value > 0 ? '+' : ''}{value}
                      </span>
                    </div>
                  );
                })}
              {optimizedScore.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <ul className="space-y-2">
                    {optimizedScore.suggestions.slice(0, 3).map((suggestion, idx) => (
                      <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 pl-3 relative before:content-['•'] before:absolute before:left-0">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {optimizedScore && (
          <CollapsibleSection
            title="Keyword Breakdown"
            icon={<Filter className="w-4 h-4" />}
            isExpanded={expandedSections.has('keywords')}
            onToggle={() => toggleSection('keywords')}
          >
            <div className="space-y-2">
              <CategoryBadge category="hard_skill" count={optimizedScore.breakdown.hardSkills} onClick={() => setSelectedCategory((prev) => (prev === 'hard_skill' ? null : 'hard_skill'))} isActive={selectedCategory === 'hard_skill'} />
              <CategoryBadge category="action_verb" count={optimizedScore.breakdown.actionVerbs} onClick={() => setSelectedCategory((prev) => (prev === 'action_verb' ? null : 'action_verb'))} isActive={selectedCategory === 'action_verb'} />
              <CategoryBadge category="metric" count={optimizedScore.breakdown.metrics} onClick={() => setSelectedCategory((prev) => (prev === 'metric' ? null : 'metric'))} isActive={selectedCategory === 'metric'} />
              <CategoryBadge category="industry_term" count={optimizedScore.breakdown.industryTerms} onClick={() => setSelectedCategory((prev) => (prev === 'industry_term' ? null : 'industry_term'))} isActive={selectedCategory === 'industry_term'} />
              <CategoryBadge category="soft_skill" count={optimizedScore.breakdown.softSkills} onClick={() => setSelectedCategory((prev) => (prev === 'soft_skill' ? null : 'soft_skill'))} isActive={selectedCategory === 'soft_skill'} />
            </div>
          </CollapsibleSection>
        )}
      </div>
    </motion.div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, isExpanded, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          {icon}
          {title}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-3 bg-white dark:bg-gray-900">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
