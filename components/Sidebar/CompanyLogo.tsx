'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  name: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Generate a consistent color from company name
function getCompanyColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-pink-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const sizeClasses = {
  sm: 'w-4 h-4 text-[10px]',
  md: 'w-6 h-6 text-xs',
  lg: 'w-8 h-8 text-sm',
};

export default function CompanyLogo({
  name,
  logoUrl,
  size = 'md',
  className,
}: CompanyLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initial = name.charAt(0).toUpperCase();
  const colorClass = getCompanyColor(name);
  const sizeClass = sizeClasses[size];

  // Show fallback if no URL or if image failed to load
  if (!logoUrl || imageError) {
    return (
      <div
        className={cn(
          sizeClass,
          colorClass,
          'rounded-sm flex items-center justify-center text-white font-semibold flex-shrink-0',
          className
        )}
        title={name}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        'relative rounded-sm overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800',
        className
      )}
    >
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            colorClass
          )}
        >
          <span className="text-white font-semibold">{initial}</span>
        </div>
      )}
      <Image
        src={logoUrl}
        alt={`${name} logo`}
        fill
        sizes={size === 'sm' ? '16px' : size === 'md' ? '24px' : '32px'}
        className={cn(
          'object-contain transition-opacity duration-200',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
        }}
        unoptimized // Logo.dev logos are already optimized via CDN
      />
    </div>
  );
}
