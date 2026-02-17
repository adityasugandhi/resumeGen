'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// Base Card Component
interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'elevated' | 'bordered' | 'gradient';
  hover?: boolean;
  children: React.ReactNode;
}

const cardVariants = {
  default: `
    bg-white dark:bg-gray-900
    border border-gray-200 dark:border-gray-800
  `,
  glass: `
    bg-white/70 dark:bg-gray-900/70
    backdrop-blur-xl
    border border-white/20 dark:border-gray-700/50
    shadow-xl shadow-gray-500/5
  `,
  elevated: `
    bg-white dark:bg-gray-900
    shadow-xl shadow-gray-900/10 dark:shadow-black/30
    border border-gray-100 dark:border-gray-800
  `,
  bordered: `
    bg-transparent
    border-2 border-gray-200 dark:border-gray-700
  `,
  gradient: `
    bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800
    border border-gray-200/50 dark:border-gray-700/50
    shadow-lg
  `,
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hover = false, className = '', children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`
          rounded-2xl
          overflow-hidden
          ${cardVariants[variant]}
          ${hover ? 'cursor-pointer transition-shadow hover:shadow-2xl' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Title
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  children: React.ReactNode;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = 'h3', className = '', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = 'CardTitle';

// Card Description
interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm text-gray-500 dark:text-gray-400 mt-1 ${className}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

// Card Content
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`px-6 py-4 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// Card Footer
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// Stat Card - Specialized for displaying metrics
interface StatCardProps extends HTMLMotionProps<'div'> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'rose';
}

const statColors = {
  default: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    icon: 'text-gray-600 dark:text-gray-400',
    value: 'text-gray-900 dark:text-white',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    icon: 'text-rose-600 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-300',
  },
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, icon, trend, color = 'default', className = '', ...props }, ref) => {
    const colors = statColors[color];

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`
          relative overflow-hidden
          rounded-2xl p-5
          ${colors.bg}
          border border-gray-200/50 dark:border-gray-700/50
          ${className}
        `}
        {...props}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {label}
            </span>
            {icon && (
              <span className={`${colors.icon}`}>
                {icon}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between">
            <span className={`text-3xl font-bold tracking-tight ${colors.value}`}>
              {value}
            </span>

            {trend && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  trend.isPositive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

StatCard.displayName = 'StatCard';
