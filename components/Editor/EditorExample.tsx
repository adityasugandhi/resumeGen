'use client';

import React from 'react';
import EditorLayout from './EditorLayout';
import { DiffLineData } from './DiffLine';

/**
 * Example implementation of the AI Resume Editor Layout
 *
 * This demonstrates how to use the EditorLayout component with all its features:
 * - Side-by-side diff visualization
 * - Synchronized scrolling
 * - View mode toggling (Source/Preview/Diff)
 * - Change tracking with character-level highlighting
 * - Accept/Reject actions
 */
export default function EditorExample() {
  // Example original resume lines
  const originalLines: DiffLineData[] = [
    {
      id: 'line-1',
      lineNumber: 1,
      type: 'unchanged',
      content: '\\section{Experience}',
    },
    {
      id: 'line-2',
      lineNumber: 2,
      type: 'modified',
      content: '\\resumeSubheading{Software Engineer}{ABC Corp}',
      charDiffs: [
        { start: 30, end: 38, type: 'deleted' },
      ],
      changeId: 'change-1',
    },
    {
      id: 'line-3',
      lineNumber: 3,
      type: 'deleted',
      content: '\\resumeItem{Built web applications using React}',
      changeId: 'change-2',
    },
    {
      id: 'line-4',
      lineNumber: 4,
      type: 'unchanged',
      content: '\\resumeItem{Collaborated with team members}',
    },
    {
      id: 'line-5',
      lineNumber: 5,
      type: 'unchanged',
      content: '\\section{Skills}',
    },
  ];

  // Example suggested resume lines
  const suggestedLines: DiffLineData[] = [
    {
      id: 'line-1',
      lineNumber: 1,
      type: 'unchanged',
      content: '\\section{Experience}',
    },
    {
      id: 'line-2',
      lineNumber: 2,
      type: 'modified',
      content: '\\resumeSubheading{Senior Software Engineer}{ABC Corp}',
      charDiffs: [
        { start: 18, end: 25, type: 'added' }, // "Senior "
      ],
      changeId: 'change-1',
    },
    {
      id: 'line-3',
      lineNumber: 3,
      type: 'added',
      content: '\\resumeItem{Architected and deployed scalable React applications serving 100K+ users}',
      changeId: 'change-2',
    },
    {
      id: 'line-4',
      lineNumber: 4,
      type: 'unchanged',
      content: '\\resumeItem{Collaborated with team members}',
    },
    {
      id: 'line-5',
      lineNumber: 5,
      type: 'unchanged',
      content: '\\section{Skills}',
    },
  ];

  // Example suggestion metadata
  const suggestion = {
    id: 'sugg-1',
    title: 'Enhance Job Title & Quantify Achievements',
    description: 'Updated title to Senior level and added metrics to demonstrate impact',
    confidence: 92,
  };

  // Example sidebar content
  const sidebarContent = (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
          Change Summary
        </h3>
        <div className="space-y-3">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
                ~
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  Job Title Enhancement
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Updated from &quot;Software Engineer&quot; to &quot;Senior Software Engineer&quot; to better reflect experience level
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
                +
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  Quantified Achievement
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Added metrics (100K+ users) to demonstrate scale and impact of work
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
          AI Reasoning
        </h3>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            Based on the job requirements, I&apos;ve identified opportunities to:
          </p>
          <ul className="mt-2 space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Elevate job title to match senior-level responsibilities</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Add quantifiable metrics to demonstrate impact</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>Highlight architectural decisions and scalability</span>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
          Match Analysis
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Before</span>
            <span className="font-semibold text-gray-900 dark:text-white">78%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">After</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">92%</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: '92%' }}
                />
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                +14%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleAccept = () => {
    console.log('Accepting all changes...');
    // Implementation: Apply suggested changes to resume
  };

  const handleReject = () => {
    console.log('Rejecting all changes...');
    // Implementation: Discard all suggestions
  };

  const handleReset = () => {
    console.log('Resetting to original...');
    // Implementation: Reset to original state
  };

  return (
    <EditorLayout>
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Diff content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-semibold">{suggestion.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
            <span className="text-xs font-medium text-emerald-600">{suggestion.confidence}% confidence</span>
          </div>
          <pre className="font-mono text-sm text-gray-900 dark:text-gray-100">
            {originalLines.map((line) => line.content).join('\n')}
          </pre>
        </div>
        {/* Right: Sidebar */}
        <div className="w-80 border-l border-border overflow-y-auto bg-surface">
          {sidebarContent}
          <div className="p-4 border-t border-border flex gap-2">
            <button onClick={handleAccept} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md">Accept All</button>
            <button onClick={handleReject} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md">Reject All</button>
            <button onClick={handleReset} className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md">Reset</button>
          </div>
        </div>
      </div>
    </EditorLayout>
  );
}
