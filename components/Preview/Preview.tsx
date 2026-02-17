'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import PDFViewer from './PDFViewer';

export default function Preview() {
  const { compiledPdfUrl, compilationStatus, currentFileId } = useEditorStore();

  if (!currentFileId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">No preview available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Select a file and compile to see the preview
          </p>
        </div>
      </div>
    );
  }

  if (compilationStatus === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">Ready to compile</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Click the &quot;Compile&quot; button to generate a PDF preview
          </p>
        </div>
      </div>
    );
  }

  if (compilationStatus === 'compiling') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-lg text-gray-500 dark:text-gray-400">Compiling LaTeX...</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            This may take a few seconds
          </p>
        </div>
      </div>
    );
  }

  if (compilationStatus === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="text-lg text-red-600 dark:text-red-400 mb-2">Compilation Failed</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check the error message in the editor toolbar and fix the LaTeX syntax
          </p>
        </div>
      </div>
    );
  }

  if (compilationStatus === 'success' && compiledPdfUrl) {
    return (
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
        <PDFViewer pdfUrl={compiledPdfUrl} />
      </div>
    );
  }

  return null;
}
