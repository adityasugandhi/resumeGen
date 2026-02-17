'use client';

import React, { useState } from 'react';
import { Play, Save, AlertCircle, CheckCircle, Loader2, Download, Terminal, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn, downloadBlob } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { useFileSystemStore } from '@/store/fileSystemStore';

interface CompilationResponse {
  success: boolean;
  pdfUrl?: string;
  error?: string;
  localError?: string;
  onlineError?: string;
  errorType?: string;
  lineNumber?: number;
  compilationMethod?: string;
  latexAvailable?: boolean;
  suggestion?: string;
  logs?: string;
  attemptedMethods?: string[];
  installInstructions?: {
    macos?: string;
    linux?: string;
    windows?: string;
  };
}

interface InstallInstructions {
  macos?: string;
  linux?: string;
  windows?: string;
}

export default function EditorToolbar() {
  const { currentFileId, hasUnsavedChanges, compilationStatus, compilationError, setCompilationStatus, setCompilationError, setCompiledPdfUrl, content } = useEditorStore();
  const { getFile, updateFile } = useFileSystemStore();
  const [compilationMethod, setCompilationMethod] = useState<string | null>(null);
  const [installInstructions, setInstallInstructions] = useState<InstallInstructions | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const currentFile = currentFileId ? getFile(currentFileId) : null;

  const handleSave = () => {
    if (currentFileId) {
      updateFile(currentFileId, content);
      toast.success('File saved', {
        duration: 2000,
        description: 'Your changes have been saved successfully',
      });
    }
  };

  const handleCompile = async () => {
    if (!currentFileId || !currentFile) return;

    setCompilationStatus('compiling');
    setCompilationError(null);
    setShowInstructions(false);

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          filename: currentFile.name,
        }),
      });

      const data: CompilationResponse = await response.json();

      if (data.success && data.pdfUrl) {
        setCompilationStatus('success');
        setCompiledPdfUrl(data.pdfUrl);
        setCompilationMethod(data.compilationMethod || null);
      } else {
        setCompilationStatus('error');

        // Build comprehensive error message
        let errorMsg = data.error || 'Compilation failed';

        if (data.errorType) {
          errorMsg += `\n\n🔍 Error Type: ${data.errorType}`;
        }

        if (data.lineNumber) {
          errorMsg += `\n📍 Line Number: ${data.lineNumber}`;
        }

        if (data.localError && data.onlineError) {
          errorMsg += `\n\n📍 Local Compilation Error:\n${data.localError}`;
          errorMsg += `\n\n☁️ Online Fallback Error:\n${data.onlineError}`;
        } else if (data.localError) {
          errorMsg += `\n\nLocal Error: ${data.localError}`;
        } else if (data.onlineError) {
          errorMsg += `\n\nOnline Error: ${data.onlineError}`;
        }

        if (data.suggestion) {
          errorMsg += `\n\n💡 Suggestion:\n${data.suggestion}`;
        }

        if (data.attemptedMethods && data.attemptedMethods.length > 0) {
          errorMsg += `\n\n🔄 Attempted: ${data.attemptedMethods.join(', ')}`;
        }

        setCompilationError(errorMsg);

        if (data.installInstructions) {
          setInstallInstructions(data.installInstructions);
          setShowInstructions(true);
        }
      }
    } catch (error) {
      setCompilationStatus('error');
      setCompilationError(error instanceof Error ? error.message : 'Network error');
    }
  };

  const handleDownload = async () => {
    if (!currentFile) return;

    setCompilationStatus('compiling');
    setCompilationError(null);

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          filename: currentFile.name,
        }),
      });

      const data: CompilationResponse = await response.json();

      if (data.success && data.pdfUrl) {
        // Convert base64 to blob
        const base64Data = data.pdfUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        downloadBlob(blob, currentFile.name.replace('.tex', '.pdf'));
        setCompilationStatus('success');
        setCompilationMethod(data.compilationMethod || null);
      } else {
        setCompilationStatus('error');

        // Build comprehensive error message
        let errorMsg = data.error || 'Compilation failed';

        if (data.errorType) {
          errorMsg += `\n\n🔍 Error Type: ${data.errorType}`;
        }

        if (data.lineNumber) {
          errorMsg += `\n📍 Line Number: ${data.lineNumber}`;
        }

        if (data.localError && data.onlineError) {
          errorMsg += `\n\n📍 Local Compilation Error:\n${data.localError}`;
          errorMsg += `\n\n☁️ Online Fallback Error:\n${data.onlineError}`;
        } else if (data.localError) {
          errorMsg += `\n\nLocal Error: ${data.localError}`;
        } else if (data.onlineError) {
          errorMsg += `\n\nOnline Error: ${data.onlineError}`;
        }

        if (data.suggestion) {
          errorMsg += `\n\n💡 Suggestion:\n${data.suggestion}`;
        }

        if (data.attemptedMethods && data.attemptedMethods.length > 0) {
          errorMsg += `\n\n🔄 Attempted: ${data.attemptedMethods.join(', ')}`;
        }

        setCompilationError(errorMsg);

        if (data.installInstructions) {
          setInstallInstructions(data.installInstructions);
          setShowInstructions(true);
        }
      }
    } catch (error) {
      setCompilationStatus('error');
      setCompilationError(error instanceof Error ? error.message : 'Network error');
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{currentFile?.name || 'Untitled'}</span>
          {hasUnsavedChanges && (
            <span className="text-xs text-orange-600 dark:text-orange-400">● Unsaved</span>
          )}
          {compilationMethod && compilationStatus === 'success' && (
            <span
              className={cn(
                "text-xs flex items-center gap-1 px-2 py-0.5 rounded-full",
                (compilationMethod.includes('docker') || compilationMethod.includes('local')) && !compilationMethod.includes('fallback')
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              )}
              title={
                compilationMethod.includes('docker') && !compilationMethod.includes('fallback')
                  ? "Compiled using Docker (consistent environment, all packages available)"
                  : compilationMethod.includes('local') && !compilationMethod.includes('fallback')
                  ? "Compiled using local LaTeX installation (faster, more features)"
                  : "Compiled using online service (may have limited package support)"
              }
            >
              {(compilationMethod.includes('docker') || compilationMethod.includes('local')) && !compilationMethod.includes('fallback') ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400 animate-pulse"></span>
                  {compilationMethod.includes('docker') ? 'Docker' : 'Local'}
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                  Online
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Compilation Status */}
          {compilationStatus === 'compiling' && (
            <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Compiling...</span>
            </div>
          )}
          {compilationStatus === 'success' && (
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Success</span>
            </div>
          )}
          {compilationStatus === 'error' && (
            <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400" title={compilationError || undefined}>
              <AlertCircle className="w-4 h-4" />
              <span>Error</span>
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors',
              hasUnsavedChanges
                ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            )}
            title="Save (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>

          <button
            onClick={handleCompile}
            disabled={compilationStatus === 'compiling'}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Compile LaTeX"
          >
            <Play className="w-4 h-4" />
            <span>Compile</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={compilationStatus === 'compiling'}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {compilationError && (
        <div className="mt-2 space-y-2">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="text-sm text-red-700 dark:text-red-300">Compilation Error</strong>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap">{compilationError}</p>
              </div>
              <button
                onClick={() => {
                  setCompilationError(null);
                  setShowInstructions(false);
                }}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Installation Instructions */}
          {showInstructions && installInstructions && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="flex items-start gap-2">
                <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="text-sm text-blue-700 dark:text-blue-300">Installation Instructions</strong>

                  {installInstructions.macos && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">macOS:</p>
                      <code className="block text-xs bg-blue-100 dark:bg-blue-900/40 p-2 rounded text-blue-800 dark:text-blue-200 overflow-x-auto">
                        {installInstructions.macos}
                      </code>
                    </div>
                  )}

                  {installInstructions.linux && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Linux:</p>
                      <code className="block text-xs bg-blue-100 dark:bg-blue-900/40 p-2 rounded text-blue-800 dark:text-blue-200">
                        {installInstructions.linux}
                      </code>
                    </div>
                  )}

                  {installInstructions.windows && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Windows:</p>
                      <code className="block text-xs bg-blue-100 dark:bg-blue-900/40 p-2 rounded text-blue-800 dark:text-blue-200">
                        {installInstructions.windows}
                      </code>
                    </div>
                  )}

                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    After installation, restart the development server and try compiling again.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
