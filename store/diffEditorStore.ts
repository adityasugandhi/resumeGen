/**
 * Diff Editor Store
 * Manages state for AI-powered resume comparison and optimization
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JobPosting } from '@/lib/indexeddb';
import type {
  EnhancedResumeChange,
  DiffResult,
  DiffViewMode,
  CompiledPDF,
  KeywordAnalysis,
  ATSScore,
} from '@/types/diff';
import { computeDiff } from '@/lib/diff/diff-engine';
import { diffLatexAware } from '@/lib/diff/latex-tokenizer';

interface DiffEditorState {
  // Context
  jobId: string | null;
  jobData: JobPosting | null;
  versionId: string | null;

  // Content
  originalLatex: string;
  optimizedLatex: string;
  changes: EnhancedResumeChange[];

  // Diff state
  diffResult: DiffResult | null;
  useLaTeXAwareDiff: boolean;

  // Change tracking
  acceptedChangeIds: Set<string>;
  rejectedChangeIds: Set<string>;

  // View state
  viewMode: DiffViewMode;
  showOnlyChanges: boolean;
  highlightKeywords: boolean;

  // Analysis
  keywordAnalysis: KeywordAnalysis | null;
  atsScore: ATSScore | null;

  // Compilation
  isCompiling: boolean;
  compiledPdfs: {
    original: CompiledPDF | null;
    optimized: CompiledPDF | null;
    applied: CompiledPDF | null;
  };

  // Error states
  compilationError: string | null;
  analysisError: string | null;
}

interface DiffEditorActions {
  // Initialization
  initializeEditor: (params: {
    jobId: string;
    jobData: JobPosting;
    versionId: string;
    originalLatex: string;
    optimizedLatex: string;
    changes: EnhancedResumeChange[];
  }) => void;
  reset: () => void;

  // Change management
  acceptChange: (changeId: string) => void;
  rejectChange: (changeId: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  toggleChange: (changeId: string) => void;

  // View controls
  setViewMode: (mode: DiffViewMode) => void;
  toggleLaTeXAwareDiff: () => void;
  toggleOnlyChanges: () => void;
  toggleHighlightKeywords: () => void;

  // Computed content
  getAppliedLatex: () => string;
  getAcceptedChanges: () => EnhancedResumeChange[];
  getRejectedChanges: () => EnhancedResumeChange[];
  getPendingChanges: () => EnhancedResumeChange[];

  // Compilation
  compileOriginal: () => Promise<void>;
  compileOptimized: () => Promise<void>;
  compileApplied: () => Promise<void>;
  setCompilationError: (error: string | null) => void;

  // Analysis
  analyzeKeywords: () => Promise<void>;
  calculateAtsScore: () => Promise<void>;
  setAnalysisError: (error: string | null) => void;

  // Export
  exportToMainEditor: () => Promise<void>;
  saveVersion: () => Promise<void>;

  // Diff computation
  recomputeDiff: () => void;
}

type DiffEditorStore = DiffEditorState & DiffEditorActions;

const initialState: DiffEditorState = {
  jobId: null,
  jobData: null,
  versionId: null,
  originalLatex: '',
  optimizedLatex: '',
  changes: [],
  diffResult: null,
  useLaTeXAwareDiff: true,
  acceptedChangeIds: new Set(),
  rejectedChangeIds: new Set(),
  viewMode: 'split',
  showOnlyChanges: false,
  highlightKeywords: true,
  keywordAnalysis: null,
  atsScore: null,
  isCompiling: false,
  compiledPdfs: {
    original: null,
    optimized: null,
    applied: null,
  },
  compilationError: null,
  analysisError: null,
};

export const useDiffEditorStore = create<DiffEditorStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Initialization
      initializeEditor: ({
        jobId,
        jobData,
        versionId,
        originalLatex,
        optimizedLatex,
        changes,
      }) => {
        set({
          jobId,
          jobData,
          versionId,
          originalLatex,
          optimizedLatex,
          changes,
          acceptedChangeIds: new Set(),
          rejectedChangeIds: new Set(),
        });

        // Compute initial diff
        get().recomputeDiff();

        // Run initial analysis
        get().analyzeKeywords();
        get().calculateAtsScore();
      },

      reset: () => {
        set(initialState);
      },

      // Change management
      acceptChange: (changeId) => {
        set((state) => {
          const newAccepted = new Set(state.acceptedChangeIds);
          const newRejected = new Set(state.rejectedChangeIds);
          newAccepted.add(changeId);
          newRejected.delete(changeId);
          return {
            acceptedChangeIds: newAccepted,
            rejectedChangeIds: newRejected,
          };
        });
      },

      rejectChange: (changeId) => {
        set((state) => {
          const newAccepted = new Set(state.acceptedChangeIds);
          const newRejected = new Set(state.rejectedChangeIds);
          newAccepted.delete(changeId);
          newRejected.add(changeId);
          return {
            acceptedChangeIds: newAccepted,
            rejectedChangeIds: newRejected,
          };
        });
      },

      acceptAll: () => {
        const { changes } = get();
        set({
          acceptedChangeIds: new Set(changes.map((c) => c.id)),
          rejectedChangeIds: new Set(),
        });
      },

      rejectAll: () => {
        const { changes } = get();
        set({
          acceptedChangeIds: new Set(),
          rejectedChangeIds: new Set(changes.map((c) => c.id)),
        });
      },

      toggleChange: (changeId) => {
        const { acceptedChangeIds } = get();
        if (acceptedChangeIds.has(changeId)) {
          get().rejectChange(changeId);
        } else {
          get().acceptChange(changeId);
        }
      },

      // View controls
      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      toggleLaTeXAwareDiff: () => {
        set((state) => ({ useLaTeXAwareDiff: !state.useLaTeXAwareDiff }));
        get().recomputeDiff();
      },

      toggleOnlyChanges: () => {
        set((state) => ({ showOnlyChanges: !state.showOnlyChanges }));
      },

      toggleHighlightKeywords: () => {
        set((state) => ({ highlightKeywords: !state.highlightKeywords }));
      },

      // Computed content
      getAppliedLatex: () => {
        const { originalLatex, optimizedLatex, acceptedChangeIds, changes } = get();

        // If no changes accepted, return original
        if (acceptedChangeIds.size === 0) {
          return originalLatex;
        }

        // If all changes accepted, return optimized
        if (acceptedChangeIds.size === changes.length) {
          return optimizedLatex;
        }

        // Apply only accepted changes (simplified implementation)
        // In production, this would need proper LaTeX AST manipulation
        let result = originalLatex;

        // Sort changes by line range (descending) to apply from bottom to top
        const acceptedChanges = changes
          .filter((c) => acceptedChangeIds.has(c.id))
          .sort((a, b) => b.lineRange.start - a.lineRange.start);

        for (const change of acceptedChanges) {
          if (change.type === 'added' && change.newContent) {
            // Insert new content at line
            const lines = result.split('\n');
            lines.splice(change.lineRange.start, 0, change.newContent);
            result = lines.join('\n');
          } else if (change.type === 'deleted' && change.originalContent) {
            // Remove content
            const lines = result.split('\n');
            lines.splice(change.lineRange.start, 1);
            result = lines.join('\n');
          } else if (change.type === 'modified' && change.newContent) {
            // Replace content
            const lines = result.split('\n');
            lines[change.lineRange.start] = change.newContent;
            result = lines.join('\n');
          }
        }

        return result;
      },

      getAcceptedChanges: () => {
        const { changes, acceptedChangeIds } = get();
        return changes.filter((c) => acceptedChangeIds.has(c.id));
      },

      getRejectedChanges: () => {
        const { changes, rejectedChangeIds } = get();
        return changes.filter((c) => rejectedChangeIds.has(c.id));
      },

      getPendingChanges: () => {
        const { changes, acceptedChangeIds, rejectedChangeIds } = get();
        return changes.filter(
          (c) => !acceptedChangeIds.has(c.id) && !rejectedChangeIds.has(c.id)
        );
      },

      // Compilation
      compileOriginal: async () => {
        const { originalLatex } = get();
        set({ isCompiling: true, compilationError: null });

        try {
          const response = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: originalLatex,
              filename: 'original.tex',
            }),
          });

          if (!response.ok) {
            throw new Error('Compilation failed');
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          set((state) => ({
            compiledPdfs: {
              ...state.compiledPdfs,
              original: { url, blob, compiledAt: Date.now() },
            },
            isCompiling: false,
          }));
        } catch (error) {
          set({
            compilationError:
              error instanceof Error ? error.message : 'Compilation failed',
            isCompiling: false,
          });
        }
      },

      compileOptimized: async () => {
        const { optimizedLatex } = get();
        set({ isCompiling: true, compilationError: null });

        try {
          const response = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: optimizedLatex,
              filename: 'optimized.tex',
            }),
          });

          if (!response.ok) {
            throw new Error('Compilation failed');
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          set((state) => ({
            compiledPdfs: {
              ...state.compiledPdfs,
              optimized: { url, blob, compiledAt: Date.now() },
            },
            isCompiling: false,
          }));
        } catch (error) {
          set({
            compilationError:
              error instanceof Error ? error.message : 'Compilation failed',
            isCompiling: false,
          });
        }
      },

      compileApplied: async () => {
        const appliedLatex = get().getAppliedLatex();
        set({ isCompiling: true, compilationError: null });

        try {
          const response = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: appliedLatex,
              filename: 'applied.tex',
            }),
          });

          if (!response.ok) {
            throw new Error('Compilation failed');
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          set((state) => ({
            compiledPdfs: {
              ...state.compiledPdfs,
              applied: { url, blob, compiledAt: Date.now() },
            },
            isCompiling: false,
          }));
        } catch (error) {
          set({
            compilationError:
              error instanceof Error ? error.message : 'Compilation failed',
            isCompiling: false,
          });
        }
      },

      setCompilationError: (error) => {
        set({ compilationError: error });
      },

      // Analysis
      analyzeKeywords: async () => {
        // TODO: Implement keyword analysis using AI
        // This would call an API endpoint to extract and compare keywords
        set({ analysisError: null });
        console.log('Keyword analysis not yet implemented');
      },

      calculateAtsScore: async () => {
        // TODO: Implement ATS score calculation
        // This would call an API endpoint to analyze resume compliance
        set({ analysisError: null });
        console.log('ATS score calculation not yet implemented');
      },

      setAnalysisError: (error) => {
        set({ analysisError: error });
      },

      // Export
      exportToMainEditor: async () => {
        const appliedLatex = get().getAppliedLatex();
        // TODO: Implement export to main editor
        // This would update the editorStore with the applied changes
        console.log('Export to main editor:', appliedLatex.length, 'chars');
      },

      saveVersion: async () => {
        // TODO: Implement version saving to IndexedDB
        // This would update the resume version with accepted changes
        console.log('Save version not yet implemented');
      },

      // Diff computation
      recomputeDiff: () => {
        const { originalLatex, optimizedLatex, useLaTeXAwareDiff } = get();

        if (!originalLatex || !optimizedLatex) {
          set({ diffResult: null });
          return;
        }

        const diffResult = useLaTeXAwareDiff
          ? diffLatexAware(originalLatex, optimizedLatex)
          : computeDiff(originalLatex, optimizedLatex);

        set({ diffResult });
      },
    }),
    {
      name: 'diff-editor-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        useLaTeXAwareDiff: state.useLaTeXAwareDiff,
        showOnlyChanges: state.showOnlyChanges,
        highlightKeywords: state.highlightKeywords,
      }),
    }
  )
);
