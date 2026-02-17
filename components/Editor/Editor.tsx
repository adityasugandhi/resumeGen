'use client';

import React, { useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { toast } from 'sonner';
import { debounce } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { useUIStore } from '@/store/uiStore';
import EditorToolbar from './EditorToolbar';

export default function Editor() {
  const { currentFileId, content, setContent, setHasUnsavedChanges } = useEditorStore();
  const { updateFile, getFile } = useFileSystemStore();
  const { theme } = useUIStore();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Auto-save functionality
  const autoSave = useRef(
    debounce((fileId: string, content: string) => {
      updateFile(fileId, content);
      setHasUnsavedChanges(false);
      toast.success('Auto-saved successfully', {
        duration: 2000,
        description: 'Your changes have been saved to local storage',
      });
    }, 2000)
  );

  useEffect(() => {
    if (currentFileId && content) {
      autoSave.current(currentFileId, content);
    }
  }, [content, currentFileId]);

  // Load file content when switching files
  useEffect(() => {
    if (currentFileId) {
      const file = getFile(currentFileId);
      if (file) {
        setContent(file.content || '');
      }
    }
  }, [currentFileId, getFile, setContent]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
    }
  };

  const handleEditorMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editorInstance;

    // Add custom LaTeX snippets
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (currentFileId) {
        updateFile(currentFileId, content);
        setHasUnsavedChanges(false);
      }
    });
  };

  if (!currentFileId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">No file selected</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Create a new file or select an existing one to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
      <EditorToolbar />
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language="latex"
          theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            rulers: [80],
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
          }}
        />
      </div>
    </div>
  );
}
