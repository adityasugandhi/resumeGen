'use client';

import React, { useState } from 'react';
import { X, Check, AlertCircle, FileText, ZapIcon, Eye, List } from 'lucide-react';
import ElectricBorder from '@/components/ElectricBorder';
import FadeContent from '@/components/FadeContent';
import GlareHover from '@/components/GlareHover';
import { ResumeVersion, ResumeChange } from '@/lib/indexeddb';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/store/resumeStore';

interface PreviewModalProps {
  version: ResumeVersion;
  isOpen: boolean;
  onClose: () => void;
  onExport?: (latex: string) => void;
}

type ViewMode = 'overlay' | 'detailed';

export default function PreviewModal({ version, isOpen, onClose, onExport }: PreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overlay');
  const { acceptChange, rejectChange, applyAcceptedChanges } = useResumeStore();

  const handleAccept = async (changeId: string) => {
    await acceptChange(version.id, changeId);
  };

  const handleReject = async (changeId: string) => {
    await rejectChange(version.id, changeId);
  };

  const handleExport = () => {
    const finalLatex = applyAcceptedChanges(version.id);
    if (onExport) {
      onExport(finalLatex);
    }
  };

  const getChangeColor = (type: ResumeChange['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
      case 'modified':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'deleted':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
    }
  };

  const getChangeIcon = (type: ResumeChange['type']) => {
    switch (type) {
      case 'added':
        return '+';
      case 'modified':
        return '~';
      case 'deleted':
        return '-';
    }
  };

  const stats = {
    total: version.changes.length,
    accepted: (version.acceptedChanges || []).length,
    added: version.changes.filter((c) => c.type === 'added').length,
    modified: version.changes.filter((c) => c.type === 'modified').length,
    deleted: version.changes.filter((c) => c.type === 'deleted').length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <FadeContent className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <ElectricBorder className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Resume Preview
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {version.changes.length} changes suggested •{' '}
                      {version.overallMatchScore}% match confidence
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setViewMode('overlay')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    viewMode === 'overlay'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">Overlay View</span>
                </button>

                <button
                  onClick={() => setViewMode('detailed')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    viewMode === 'detailed'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <List className="w-4 h-4" />
                  <span className="text-sm font-medium">Detailed Changes</span>
                </button>

                <div className="flex-1" />

                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md"
                >
                  <ZapIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Export Resume</span>
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Accepted:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {stats.accepted}/{stats.total}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {stats.added} Added
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {stats.modified} Modified
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {stats.deleted} Deleted
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {viewMode === 'overlay' ? (
                <OverlayView version={version} />
              ) : (
                <DetailedView
                  version={version}
                  acceptedChangeIds={version.acceptedChanges || []}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  getChangeColor={getChangeColor}
                  getChangeIcon={getChangeIcon}
                />
              )}
            </div>
          </div>
        </ElectricBorder>
      </FadeContent>
    </div>
  );
}

// Overlay View Component
function OverlayView({
  version,
}: {
  version: ResumeVersion;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Overlay Mode
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Viewing your resume with color-coded changes. Switch to Detailed View to
              accept/reject individual changes.
            </p>
          </div>
        </div>
      </div>

      <pre className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-x-auto text-sm font-mono">
        <code>{version.tailoredLatex}</code>
      </pre>
    </div>
  );
}

// Detailed View Component
function DetailedView({
  version,
  acceptedChangeIds,
  onAccept,
  onReject,
  getChangeColor,
  getChangeIcon,
}: {
  version: ResumeVersion;
  acceptedChangeIds: string[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  getChangeColor: (type: ResumeChange['type']) => string;
  getChangeIcon: (type: ResumeChange['type']) => string;
}) {
  return (
    <div className="space-y-4">
      {version.changes.map((change) => {
        const isAccepted = acceptedChangeIds.includes(change.id);

        return (
          <GlareHover key={change.id}>
            <div
              className={cn(
                'p-4 rounded-lg border-2 transition-all',
                getChangeColor(change.type),
                isAccepted && 'ring-2 ring-blue-500 ring-offset-2'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Change Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-gray-800 text-xs font-bold">
                      {getChangeIcon(change.type)}
                    </span>
                    <span className="font-semibold text-sm">{change.section}</span>
                    {change.lineNumber && (
                      <span className="text-xs opacity-75">Line {change.lineNumber}</span>
                    )}
                  </div>

                  {/* Original Content */}
                  {change.originalContent && (
                    <div className="mb-2">
                      <p className="text-xs opacity-75 mb-1">Original:</p>
                      <pre className="text-xs bg-white/50 dark:bg-gray-800/50 p-2 rounded overflow-x-auto">
                        {change.originalContent}
                      </pre>
                    </div>
                  )}

                  {/* New Content */}
                  {change.newContent && (
                    <div className="mb-2">
                      <p className="text-xs opacity-75 mb-1">
                        {change.type === 'added' ? 'Added:' : 'New:'}
                      </p>
                      <pre className="text-xs bg-white/50 dark:bg-gray-800/50 p-2 rounded overflow-x-auto">
                        {change.newContent}
                      </pre>
                    </div>
                  )}

                  {/* Reasoning */}
                  <div className="mt-3 pt-3 border-t border-current opacity-50">
                    <p className="text-xs italic">{change.reasoning}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => (isAccepted ? onReject(change.id) : onAccept(change.id))}
                    className={cn(
                      'p-2 rounded-lg transition-all',
                      isAccepted
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    title={isAccepted ? 'Accepted' : 'Accept change'}
                  >
                    <Check className="w-4 h-4" />
                  </button>

                  {isAccepted && (
                    <button
                      onClick={() => onReject(change.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                      title="Reject change"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </GlareHover>
        );
      })}
    </div>
  );
}
