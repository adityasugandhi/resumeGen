/**
 * Internal diff computation types
 * Maps diff-match-patch output to our domain types
 */

import { Diff } from 'diff-match-patch';

// diff-match-patch operation types
export const DIFF_DELETE = -1;
export const DIFF_INSERT = 1;
export const DIFF_EQUAL = 0;

// Type guard for diff operations
export function isDiffDelete(diff: Diff): boolean {
  return diff[0] === DIFF_DELETE;
}

export function isDiffInsert(diff: Diff): boolean {
  return diff[0] === DIFF_INSERT;
}

export function isDiffEqual(diff: Diff): boolean {
  return diff[0] === DIFF_EQUAL;
}

// LaTeX token types for smart diffing
export type LaTeXTokenType =
  | 'command' // \command
  | 'environment' // \begin{env}...\end{env}
  | 'math' // $...$, $$...$$
  | 'comment' // %...
  | 'text' // Regular text
  | 'group' // {...}
  | 'whitespace'
  | 'newline';

export interface LaTeXToken {
  type: LaTeXTokenType;
  value: string;
  position: { start: number; end: number };
  nesting?: number; // Depth for groups/environments
}

// Line classification for diff display
export type LineType = 'unchanged' | 'added' | 'deleted' | 'modified';

// Hunk configuration
export interface HunkConfig {
  contextLines: number; // Lines before/after change
  minGap: number; // Min lines between hunks to keep separate
}

export const DEFAULT_HUNK_CONFIG: HunkConfig = {
  contextLines: 3,
  minGap: 5,
};

// Internal line tracking during diff computation
export interface LineDiffState {
  leftLineNum: number;
  rightLineNum: number;
  currentHunk: {
    startLine: { left: number; right: number };
    endLine: { left: number; right: number };
    changeIds: string[];
  } | null;
}
