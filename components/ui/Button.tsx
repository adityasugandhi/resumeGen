'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500
    text-white font-medium
    shadow-lg shadow-emerald-500/25
    hover:shadow-xl hover:shadow-emerald-500/30
    hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400
    active:from-emerald-600 active:via-teal-600 active:to-cyan-600
    border border-emerald-400/20
  `,
  secondary: `
    bg-gray-100 dark:bg-gray-800
    text-gray-900 dark:text-gray-100
    hover:bg-gray-200 dark:hover:bg-gray-700
    active:bg-gray-300 dark:active:bg-gray-600
    border border-gray-200 dark:border-gray-700
  `,
  ghost: `
    bg-transparent
    text-gray-700 dark:text-gray-300
    hover:bg-gray-100 dark:hover:bg-gray-800
    active:bg-gray-200 dark:active:bg-gray-700
  `,
  danger: `
    bg-gradient-to-r from-red-500 to-rose-500
    text-white font-medium
    shadow-lg shadow-red-500/25
    hover:shadow-xl hover:shadow-red-500/30
    hover:from-red-400 hover:to-rose-400
    active:from-red-600 active:to-rose-600
    border border-red-400/20
  `,
  success: `
    bg-gradient-to-r from-green-500 to-emerald-500
    text-white font-medium
    shadow-lg shadow-green-500/25
    hover:shadow-xl hover:shadow-green-500/30
    hover:from-green-400 hover:to-emerald-400
    active:from-green-600 active:to-emerald-600
    border border-green-400/20
  `,
  outline: `
    bg-transparent
    text-emerald-600 dark:text-emerald-400
    border-2 border-emerald-500/50
    hover:bg-emerald-500/10
    hover:border-emerald-500
    active:bg-emerald-500/20
  `,
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
  icon: 'p-2 rounded-xl aspect-square',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={`
          inline-flex items-center justify-center
          font-medium
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2
          focus:ring-offset-white dark:focus:ring-offset-gray-900
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        disabled={isDisabled}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {rightIcon && !isLoading && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button variant for compact actions
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> & { icon: React.ReactNode; label: string }>(
  ({ icon, label, variant = 'ghost', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size="icon"
        aria-label={label}
        title={label}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';
