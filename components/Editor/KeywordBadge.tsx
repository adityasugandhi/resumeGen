'use client';

import { forwardRef, HTMLAttributes } from 'react';
import type { KeywordCategory } from '@/types';
import { KEYWORD_COLORS, KEYWORD_LABELS } from '@/lib/keywords/keyword-categories';
import { Sparkles } from 'lucide-react';

interface KeywordBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  word: string;
  category: KeywordCategory;
  count?: number;
  isNew?: boolean;
  showCategory?: boolean;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

/**
 * KeywordBadge component - displays a keyword with category-specific styling
 * Used in keyword analysis sidebar and preview modals
 */
export const KeywordBadge = forwardRef<HTMLSpanElement, KeywordBadgeProps>(
  (
    {
      word,
      category,
      count = 1,
      isNew = false,
      showCategory = false,
      showCount = false,
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const colors = KEYWORD_COLORS[category];
    const label = KEYWORD_LABELS[category];

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1.5
          font-medium
          rounded-full
          border
          transition-all duration-200
          hover:scale-105
          ${colors.light}
          dark:${colors.dark}
          ${sizes[size]}
          ${className}
        `}
        title={showCategory ? label : word}
        {...props}
      >
        {/* New keyword indicator */}
        {isNew && (
          <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400 animate-pulse" />
        )}

        {/* Category label (optional) */}
        {showCategory && (
          <span className="opacity-70 text-[10px] uppercase tracking-wider">
            {label}
          </span>
        )}

        {/* Keyword text */}
        <span className="font-semibold">{word}</span>

        {/* Count indicator (optional) */}
        {showCount && count > 1 && (
          <span className="opacity-60 text-[10px] font-normal">
            ×{count}
          </span>
        )}
      </span>
    );
  }
);

KeywordBadge.displayName = 'KeywordBadge';

/**
 * KeywordBadgeGroup - displays multiple keywords in a wrapped grid
 */
interface KeywordBadgeGroupProps {
  keywords: Array<{
    word: string;
    category: KeywordCategory;
    count?: number;
    isNew?: boolean;
  }>;
  showCategory?: boolean;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  className?: string;
}

export function KeywordBadgeGroup({
  keywords,
  showCategory = false,
  showCount = false,
  size = 'md',
  maxDisplay,
  className = '',
}: KeywordBadgeGroupProps) {
  const displayKeywords = maxDisplay ? keywords.slice(0, maxDisplay) : keywords;
  const remainingCount = maxDisplay ? Math.max(0, keywords.length - maxDisplay) : 0;

  if (keywords.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No keywords found
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayKeywords.map((keyword, idx) => (
        <KeywordBadge
          key={`${keyword.word}-${idx}`}
          word={keyword.word}
          category={keyword.category}
          count={keyword.count}
          isNew={keyword.isNew}
          showCategory={showCategory}
          showCount={showCount}
          size={size}
        />
      ))}
      {remainingCount > 0 && (
        <span
          className={`
            inline-flex items-center justify-center
            font-medium
            rounded-full
            border
            bg-gray-100 text-gray-600 border-gray-200
            dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700
            ${sizes[size]}
          `}
        >
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

/**
 * CategoryBadge - displays a category with count
 */
interface CategoryBadgeProps {
  category: KeywordCategory;
  count: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function CategoryBadge({
  category,
  count,
  onClick,
  isActive = false,
}: CategoryBadgeProps) {
  const colors = KEYWORD_COLORS[category];
  const label = KEYWORD_LABELS[category];

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-between gap-3
        w-full px-3 py-2
        font-medium text-sm
        rounded-lg
        border
        transition-all duration-200
        ${onClick ? 'hover:scale-[1.02] cursor-pointer' : ''}
        ${isActive ? 'ring-2 ring-offset-2 ring-emerald-500/50' : ''}
        ${colors.light}
        dark:${colors.dark}
      `}
    >
      <span>{label}</span>
      <span className="font-bold tabular-nums">{count}</span>
    </button>
  );
}
