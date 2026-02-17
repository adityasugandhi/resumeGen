'use client';

import React from 'react';
import { Check, X, Sparkles, Upload, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ActionBarProps {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onRefine: () => void;
  onExport: () => void;
  onDownload: () => void;
  pendingCount: number;
  isCompiling: boolean;
}

export default function ActionBar({
  onAcceptAll,
  onRejectAll,
  onRefine,
  onExport,
  onDownload,
  pendingCount,
  isCompiling,
}: ActionBarProps) {
  return (
    <div className="border-t border-border bg-surface shadow-lg">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Bulk Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="success"
              size="md"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={onAcceptAll}
              disabled={pendingCount === 0}
            >
              Accept All
            </Button>

            <Button
              variant="outline"
              size="md"
              leftIcon={<X className="w-4 h-4" />}
              onClick={onRejectAll}
              disabled={pendingCount === 0}
            >
              Reject All
            </Button>

            <Button
              variant="secondary"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4" />}
              onClick={onRefine}
            >
              Refine with AI
            </Button>
          </div>

          {/* Right: Export Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={onExport}
            >
              Export to Editor
            </Button>

            <Button
              variant="primary"
              size="md"
              leftIcon={isCompiling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              onClick={onDownload}
              disabled={isCompiling}
              isLoading={isCompiling}
            >
              {isCompiling ? 'Compiling...' : 'Compile & Download PDF'}
            </Button>
          </div>
        </div>

        {/* Info Text */}
        {pendingCount > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {pendingCount} {pendingCount === 1 ? 'change' : 'changes'} pending review
          </p>
        )}
      </div>
    </div>
  );
}
