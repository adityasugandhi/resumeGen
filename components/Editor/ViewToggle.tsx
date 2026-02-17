'use client';

import React from 'react';
import { Eye, List, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'diff' | 'overlay' | 'raw';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export default function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  const views: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'diff', label: 'Diff View', icon: <List className="w-4 h-4" /> },
    { mode: 'overlay', label: 'Overlay View', icon: <Eye className="w-4 h-4" /> },
    { mode: 'raw', label: 'Raw LaTeX', icon: <Code className="w-4 h-4" /> },
  ];

  return (
    <div className="border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-2">
        {views.map((view) => (
          <button
            key={view.mode}
            onClick={() => onViewChange(view.mode)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium',
              currentView === view.mode
                ? 'bg-primary text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {view.icon}
            <span>{view.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
