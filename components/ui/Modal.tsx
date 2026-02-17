'use client';

import { forwardRef, useEffect, useCallback, HTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export const Modal = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
}: ModalProps) => {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Modal container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`
              relative w-full ${modalSizes[size]}
              bg-white dark:bg-gray-900
              rounded-3xl
              shadow-2xl shadow-black/20
              border border-gray-200 dark:border-gray-800
              overflow-hidden
              max-h-[90vh]
              flex flex-col
            `}
          >
            {/* Gradient border effect */}
            <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20 pointer-events-none" />

            {/* Close button */}
            {showCloseButton && (
              <div className="absolute top-4 right-4 z-10">
                <IconButton
                  icon={<X className="w-5 h-5" />}
                  label="Close"
                  variant="ghost"
                  onClick={onClose}
                />
              </div>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Modal Header
interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-5
          border-b border-gray-100 dark:border-gray-800
          bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-800/50
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

// Modal Title
interface ModalTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const ModalTitle = forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={`text-xl font-bold text-gray-900 dark:text-white ${className}`}
        {...props}
      >
        {children}
      </h2>
    );
  }
);

ModalTitle.displayName = 'ModalTitle';

// Modal Description
interface ModalDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const ModalDescription = forwardRef<HTMLParagraphElement, ModalDescriptionProps>(
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

ModalDescription.displayName = 'ModalDescription';

// Modal Content
interface ModalContentProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex-1 overflow-y-auto p-6 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalContent.displayName = 'ModalContent';

// Modal Footer
interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-4
          border-t border-gray-100 dark:border-gray-800
          bg-gray-50/50 dark:bg-gray-800/30
          flex items-center justify-end gap-3
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';
