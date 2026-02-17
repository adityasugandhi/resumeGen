/**
 * Diff computation engine using diff-match-patch
 * Converts character-level diffs to line-based diffs with hunks
 */

import DiffMatchPatch from 'diff-match-patch';
import type { DiffResult, DiffLine, DiffHunk, CharDiff } from '@/types/diff';
import {
  isDiffDelete,
  isDiffInsert,
  isDiffEqual,
  DEFAULT_HUNK_CONFIG,
  type HunkConfig,
  type LineDiffState,
} from './diff-types';

const dmp = new DiffMatchPatch();

/**
 * Compute line-based diff from two text strings
 */
export function computeDiff(
  original: string,
  modified: string,
  config: HunkConfig = DEFAULT_HUNK_CONFIG
): DiffResult {
  // Compute character-level diff
  const charDiffs = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(charDiffs);

  // Convert to line-based diff
  const lines = convertToLineDiff(original, modified, charDiffs);

  // Group into hunks
  const hunks = groupIntoHunks(lines, config);

  // Calculate statistics
  const stats = calculateStats(lines);

  return { lines, hunks, stats };
}

/**
 * Convert character diffs to line diffs
 */
function convertToLineDiff(
  original: string,
  modified: string,
  charDiffs: DiffMatchPatch.Diff[]
): DiffLine[] {
  const leftLines = original.split('\n');
  const rightLines = modified.split('\n');
  const diffLines: DiffLine[] = [];

  const state: LineDiffState = {
    leftLineNum: 0,
    rightLineNum: 0,
    currentHunk: null,
  };

  let leftIdx = 0;
  let rightIdx = 0;

  for (const diff of charDiffs) {
    const text = diff[1];

    if (isDiffEqual(diff)) {
      // Equal content - advance both sides
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          state.leftLineNum++;
          state.rightLineNum++;
        }

        const isLastChunk = i === lines.length - 1;
        if (!isLastChunk || lines[i].length > 0) {
          diffLines.push({
            lineNumber: { left: state.leftLineNum, right: state.rightLineNum },
            type: 'unchanged',
            content: {
              left: leftLines[state.leftLineNum] || '',
              right: rightLines[state.rightLineNum] || '',
            },
          });
        }
      }
      leftIdx += text.length;
      rightIdx += text.length;
    } else if (isDiffDelete(diff)) {
      // Deleted content - advance left side only
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          state.leftLineNum++;
        }

        const isLastChunk = i === lines.length - 1;
        if (!isLastChunk || lines[i].length > 0) {
          diffLines.push({
            lineNumber: { left: state.leftLineNum },
            type: 'deleted',
            content: { left: leftLines[state.leftLineNum] || '' },
          });
        }
      }
      leftIdx += text.length;
    } else if (isDiffInsert(diff)) {
      // Inserted content - advance right side only
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          state.rightLineNum++;
        }

        const isLastChunk = i === lines.length - 1;
        if (!isLastChunk || lines[i].length > 0) {
          diffLines.push({
            lineNumber: { right: state.rightLineNum },
            type: 'added',
            content: { right: rightLines[state.rightLineNum] || '' },
          });
        }
      }
      rightIdx += text.length;
    }
  }

  // Compute character diffs for modified lines
  return computeModifiedLines(diffLines);
}

/**
 * Find modified lines (adjacent delete + insert) and compute char diffs
 */
function computeModifiedLines(lines: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];

    // Check if this is a delete followed by an insert
    if (
      current.type === 'deleted' &&
      i + 1 < lines.length &&
      lines[i + 1].type === 'added'
    ) {
      const deletedLine = current;
      const addedLine = lines[i + 1];

      // Compute character-level diff
      const leftContent = deletedLine.content.left || '';
      const rightContent = addedLine.content.right || '';
      const charDiffs = computeCharDiff(leftContent, rightContent);

      // Create modified line
      result.push({
        lineNumber: {
          left: deletedLine.lineNumber.left,
          right: addedLine.lineNumber.right,
        },
        type: 'modified',
        content: {
          left: leftContent,
          right: rightContent,
        },
        charDiffs,
      });

      i += 2; // Skip both lines
    } else {
      result.push(current);
      i++;
    }
  }

  return result;
}

/**
 * Compute character-level diff for a single line
 */
function computeCharDiff(left: string, right: string): CharDiff[] {
  const diffs = dmp.diff_main(left, right);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map((diff) => ({
    type: isDiffDelete(diff) ? 'delete' : isDiffInsert(diff) ? 'insert' : 'equal',
    value: diff[1],
  }));
}

/**
 * Group diff lines into hunks with context
 */
function groupIntoHunks(lines: DiffLine[], config: HunkConfig): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let unchangedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.type === 'unchanged') {
      unchangedCount++;

      // If we have a current hunk and gap is large enough, close it
      if (currentHunk && unchangedCount > config.contextLines + config.minGap) {
        // Include trailing context
        const endIdx = Math.max(0, i - unchangedCount + config.contextLines);
        currentHunk.endLine = {
          left: lines[endIdx].lineNumber.left || currentHunk.endLine.left,
          right: lines[endIdx].lineNumber.right || currentHunk.endLine.right,
        };
        hunks.push(currentHunk);
        currentHunk = null;
      }
    } else {
      // Changed line
      if (!currentHunk) {
        // Start new hunk with leading context
        const startIdx = Math.max(0, i - unchangedCount);
        currentHunk = {
          startLine: {
            left: lines[startIdx].lineNumber.left || 0,
            right: lines[startIdx].lineNumber.right || 0,
          },
          endLine: {
            left: line.lineNumber.left || 0,
            right: line.lineNumber.right || 0,
          },
          changeIds: [],
        };
      }

      unchangedCount = 0;

      // Update hunk end line
      currentHunk.endLine = {
        left: line.lineNumber.left || currentHunk.endLine.left,
        right: line.lineNumber.right || currentHunk.endLine.right,
      };

      // Add change ID if present
      if (line.changeId) {
        currentHunk.changeIds.push(line.changeId);
      }
    }
  }

  // Close final hunk if exists
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Calculate diff statistics
 */
function calculateStats(lines: DiffLine[]): DiffResult['stats'] {
  const stats = {
    additions: 0,
    deletions: 0,
    modifications: 0,
  };

  for (const line of lines) {
    if (line.type === 'added') {
      stats.additions++;
    } else if (line.type === 'deleted') {
      stats.deletions++;
    } else if (line.type === 'modified') {
      stats.modifications++;
    }
  }

  return stats;
}

/**
 * Get clean diff (no context lines, only changes)
 */
export function getCleanDiff(diffResult: DiffResult): DiffLine[] {
  return diffResult.lines.filter((line) => line.type !== 'unchanged');
}

/**
 * Get diff statistics summary
 */
export function getDiffSummary(diffResult: DiffResult): string {
  const { additions, deletions, modifications } = diffResult.stats;
  const total = additions + deletions + modifications;

  if (total === 0) return 'No changes';

  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  if (modifications > 0) parts.push(`~${modifications}`);

  return parts.join(' ');
}
