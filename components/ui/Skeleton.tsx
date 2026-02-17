'use client';

import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton = ({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) => {
  const variantClasses = {
    text: 'rounded-md h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  };

  return (
    <div
      className={`
        bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
        dark:from-gray-800 dark:via-gray-700 dark:to-gray-800
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={{
        width: width,
        height: height,
        ...style,
      }}
      {...props}
    />
  );
};

// Card Skeleton - Pre-built skeleton for card loading states
export const CardSkeleton = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
        </div>
        <Skeleton variant="circular" width={40} height={40} />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="90%" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="rounded" width={80} height={28} />
        <Skeleton variant="rounded" width={60} height={28} />
      </div>
    </div>
  );
};

// Job Card Skeleton - Specific skeleton for job cards
export const JobCardSkeleton = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      {/* Header gradient placeholder */}
      <div className="h-2 bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-cyan-500/30" />

      <div className="p-5">
        {/* Company and status */}
        <div className="flex items-center justify-between mb-3">
          <Skeleton variant="text" width={120} height={14} />
          <Skeleton variant="rounded" width={70} height={24} />
        </div>

        {/* Title */}
        <Skeleton variant="text" width="90%" height={24} className="mb-2" />

        {/* Location */}
        <Skeleton variant="text" width="50%" height={14} className="mb-4" />

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <Skeleton variant="rounded" width={80} height={32} />
          <Skeleton variant="text" width={100} height={14} />
        </div>

        {/* Requirements preview */}
        <div className="space-y-1.5">
          <Skeleton variant="text" width="100%" height={12} />
          <Skeleton variant="text" width="85%" height={12} />
          <Skeleton variant="text" width="70%" height={12} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Skeleton variant="rounded" width="50%" height={36} />
          <Skeleton variant="rounded" width="50%" height={36} />
        </div>
      </div>
    </div>
  );
};

// Stat Card Skeleton
export const StatCardSkeleton = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`rounded-2xl bg-gray-100 dark:bg-gray-800 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton variant="text" width={80} height={12} />
        <Skeleton variant="circular" width={20} height={20} />
      </div>
      <Skeleton variant="text" width={60} height={36} />
    </div>
  );
};

// List Skeleton - Multiple items
export const ListSkeleton = ({
  count = 3,
  className = ''
}: {
  count?: number;
  className?: string;
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={12} />
          </div>
          <Skeleton variant="rounded" width={80} height={32} />
        </div>
      ))}
    </div>
  );
};
