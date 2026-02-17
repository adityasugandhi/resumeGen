'use client';

import React, { forwardRef } from 'react';

interface SyncScrollContainerProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  leftRef: React.RefObject<HTMLDivElement>;
  rightRef: React.RefObject<HTMLDivElement>;
  onLeftScroll: () => void;
  onRightScroll: () => void;
}

const SyncScrollContainer = forwardRef<HTMLDivElement, SyncScrollContainerProps>(
  ({ leftContent, rightContent, leftRef, rightRef, onLeftScroll, onRightScroll }, ref) => {
    return (
      <div ref={ref} className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 h-full">
        {/* Left Panel */}
        <div
          ref={leftRef}
          onScroll={onLeftScroll}
          className="overflow-y-auto bg-white dark:bg-gray-900 scroll-smooth"
        >
          {leftContent}
        </div>

        {/* Right Panel */}
        <div
          ref={rightRef}
          onScroll={onRightScroll}
          className="overflow-y-auto bg-white dark:bg-gray-900 scroll-smooth"
        >
          {rightContent}
        </div>
      </div>
    );
  }
);

SyncScrollContainer.displayName = 'SyncScrollContainer';

export default SyncScrollContainer;
