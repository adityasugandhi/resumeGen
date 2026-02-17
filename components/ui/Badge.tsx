'use client';

import { forwardRef, HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  default: `
    bg-gray-100 text-gray-700
    dark:bg-gray-800 dark:text-gray-300
    border border-gray-200 dark:border-gray-700
  `,
  success: `
    bg-emerald-50 text-emerald-700
    dark:bg-emerald-950/50 dark:text-emerald-400
    border border-emerald-200 dark:border-emerald-800
  `,
  warning: `
    bg-amber-50 text-amber-700
    dark:bg-amber-950/50 dark:text-amber-400
    border border-amber-200 dark:border-amber-800
  `,
  danger: `
    bg-red-50 text-red-700
    dark:bg-red-950/50 dark:text-red-400
    border border-red-200 dark:border-red-800
  `,
  info: `
    bg-blue-50 text-blue-700
    dark:bg-blue-950/50 dark:text-blue-400
    border border-blue-200 dark:border-blue-800
  `,
  outline: `
    bg-transparent text-gray-700
    dark:text-gray-300
    border border-gray-300 dark:border-gray-600
  `,
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  outline: 'bg-gray-500',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1.5
          font-medium
          rounded-full
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {dot && (
          <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge - Pre-configured for common status values
interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  status: 'scanned' | 'applied' | 'interviewing' | 'rejected' | 'offer' | 'pending' | 'success' | 'error';
  children?: React.ReactNode;
}

const statusConfig: Record<StatusBadgeProps['status'], { variant: BadgeVariant; label: string }> = {
  scanned: { variant: 'info', label: 'Scanned' },
  applied: { variant: 'warning', label: 'Applied' },
  interviewing: { variant: 'info', label: 'Interviewing' },
  rejected: { variant: 'danger', label: 'Rejected' },
  offer: { variant: 'success', label: 'Offer' },
  pending: { variant: 'default', label: 'Pending' },
  success: { variant: 'success', label: 'Success' },
  error: { variant: 'danger', label: 'Error' },
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, children, ...props }, ref) => {
    const config = statusConfig[status];
    return (
      <Badge ref={ref} variant={config.variant} dot {...props}>
        {children || config.label}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

// Match Score Badge - Visual indicator for match percentage
interface MatchScoreBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  score: number;
  showLabel?: boolean;
}

export const MatchScoreBadge = forwardRef<HTMLSpanElement, MatchScoreBadgeProps>(
  ({ score, showLabel = true, className = '', ...props }, ref) => {
    const getScoreVariant = (s: number): BadgeVariant => {
      if (s >= 80) return 'success';
      if (s >= 60) return 'info';
      if (s >= 40) return 'warning';
      return 'danger';
    };

    return (
      <Badge ref={ref} variant={getScoreVariant(score)} size="lg" className={className} {...props}>
        <span className="font-bold">{score}%</span>
        {showLabel && <span className="font-normal opacity-80">match</span>}
      </Badge>
    );
  }
);

MatchScoreBadge.displayName = 'MatchScoreBadge';
