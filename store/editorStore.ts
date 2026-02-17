import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EditorStore } from '@/types';

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      currentFileId: null,
      content: '',
      hasUnsavedChanges: false,
      cursorPosition: null,
      compilationStatus: 'idle',
      compilationError: null,
      compiledPdfUrl: null,

      setCurrentFile: (fileId: string | null) =>
        set({
          currentFileId: fileId,
          hasUnsavedChanges: false,
          compilationStatus: 'idle',
          compilationError: null,
        }),

      setContent: (content: string) =>
        set({
          content,
          hasUnsavedChanges: true,
        }),

      setHasUnsavedChanges: (hasChanges: boolean) =>
        set({ hasUnsavedChanges: hasChanges }),

      setCursorPosition: (position: { line: number; column: number }) =>
        set({ cursorPosition: position }),

      setCompilationStatus: (status) =>
        set({ compilationStatus: status }),

      setCompilationError: (error: string | null) =>
        set({ compilationError: error }),

      setCompiledPdfUrl: (url: string | null) =>
        set({ compiledPdfUrl: url }),

      resetEditor: () =>
        set({
          currentFileId: null,
          content: '',
          hasUnsavedChanges: false,
          cursorPosition: null,
          compilationStatus: 'idle',
          compilationError: null,
          compiledPdfUrl: null,
        }),
    }),
    {
      name: 'editor-storage',
      partialize: (state) => ({
        currentFileId: state.currentFileId,
        content: state.content,
      }),
    }
  )
);
