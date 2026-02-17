'use client';

import React, { useState } from 'react';
import { useSyncScroll } from '@/hooks/useSyncScroll';
import SyncScrollContainer from './SyncScrollContainer';
import DiffLine, { DiffLineData } from './DiffLine';

interface CustomDiffPanelProps {
  originalLines: DiffLineData[];
  suggestedLines: DiffLineData[];
  onLineClick?: (lineId: string) => void;
}

/**
 * CustomDiffPanel - Alternative to Monaco-based DiffPanel
 *
 * Provides a custom side-by-side diff view with:
 * - Synchronized scrolling between original and suggested versions
 * - Line-by-line and character-level highlighting
 * - Interactive line selection
 * - Color-coded change indicators
 */
export default function CustomDiffPanel({
  originalLines,
  suggestedLines,
  onLineClick,
}: CustomDiffPanelProps) {
  const { leftRef, rightRef, handleScroll, scrollToChange } = useSyncScroll();
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const handleLineClick = (lineId: string) => {
    setSelectedLineId(lineId);
    scrollToChange(lineId);
    onLineClick?.(lineId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Column Headers */}
      <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-3 bg-white dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            Original Resume
          </h3>
        </div>
        <div className="px-6 py-3 bg-white dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            AI Suggestions
          </h3>
        </div>
      </div>

      {/* Synchronized Diff Content */}
      <div className="flex-1 overflow-hidden">
        <SyncScrollContainer
          leftRef={leftRef}
          rightRef={rightRef}
          onLeftScroll={() => handleScroll('left')}
          onRightScroll={() => handleScroll('right')}
          leftContent={
            <div className="min-h-full">
              {originalLines.map((line) => (
                <DiffLine
                  key={line.id}
                  line={line}
                  isHovered={hoveredLineId === line.id}
                  isSelected={selectedLineId === line.id}
                  onHover={setHoveredLineId}
                  onClick={handleLineClick}
                />
              ))}
            </div>
          }
          rightContent={
            <div className="min-h-full">
              {suggestedLines.map((line) => (
                <DiffLine
                  key={line.id}
                  line={line}
                  isHovered={hoveredLineId === line.id}
                  isSelected={selectedLineId === line.id}
                  onHover={setHoveredLineId}
                  onClick={handleLineClick}
                />
              ))}
            </div>
          }
        />
      </div>

      {/* Legend */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-500" />
            <span className="text-gray-600 dark:text-gray-400">Added</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-500" />
            <span className="text-gray-600 dark:text-gray-400">Modified</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-50 dark:bg-red-900/30 border-2 border-red-500" />
            <span className="text-gray-600 dark:text-gray-400">Deleted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
