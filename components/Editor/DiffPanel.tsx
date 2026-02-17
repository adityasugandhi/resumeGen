'use client';

import React, { useRef, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

interface DiffPanelProps {
  originalLatex: string;
  modifiedLatex: string;
  highlightedLine?: number;
}

export default function DiffPanel({
  originalLatex,
  modifiedLatex,
  highlightedLine,
}: DiffPanelProps) {
  const { theme } = useUIStore();
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current && highlightedLine) {
      editorRef.current.revealLineInCenter(highlightedLine);
    }
  }, [highlightedLine]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-2 bg-surface">
        <h3 className="text-sm font-semibold">LaTeX Diff View</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Side-by-side comparison of original and optimized resume
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <DiffEditor
          height="100%"
          language="latex"
          theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          original={originalLatex}
          modified={modifiedLatex}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            renderSideBySide: true,
            renderOverviewRuler: true,
          }}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }
        />
      </div>
    </div>
  );
}
