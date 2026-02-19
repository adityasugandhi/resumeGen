// Shared types imported from the canonical definitions in types/index.ts
import type { KeywordCategory, ExtractedKeyword, ATSScore } from './index';

// Re-export so existing consumers of types/diff.ts don't break
export type { KeywordCategory, ExtractedKeyword, ATSScore };

// Change categorization for resume optimization
export type ChangeCategory =
  | 'grammar'
  | 'style'
  | 'keyword_optimization'
  | 'clarity'
  | 'impact'
  | 'latex_formatting'
  | 'quantification'
  | 'action_verb';

// Enhanced resume change with rich metadata
export interface EnhancedResumeChange {
  id: string;
  type: 'added' | 'modified' | 'deleted';
  section: string;
  originalContent?: string;
  newContent?: string;
  reasoning: string;
  category: ChangeCategory;
  confidence: number; // 0-100 AI confidence score
  keywords: ExtractedKeyword[];
  lineRange: { start: number; end: number };
}

// Character-level diff for inline highlighting
export interface CharDiff {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

// Line-level diff for side-by-side comparison
export interface DiffLine {
  lineNumber: { left?: number; right?: number };
  type: 'unchanged' | 'added' | 'deleted' | 'modified';
  content: { left?: string; right?: string };
  charDiffs?: CharDiff[]; // Only for modified lines
  changeId?: string; // Link to EnhancedResumeChange
}

// Grouped changes (hunk) with context lines
export interface DiffHunk {
  startLine: { left: number; right: number };
  endLine: { left: number; right: number };
  changeIds: string[]; // All changes in this hunk
}

// Complete diff result
export interface DiffResult {
  lines: DiffLine[];
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
  };
}

// Keyword analysis comparison
export interface KeywordAnalysis {
  original: {
    keywords: ExtractedKeyword[];
    byCategory: Record<KeywordCategory, ExtractedKeyword[]>;
  };
  optimized: {
    keywords: ExtractedKeyword[];
    byCategory: Record<KeywordCategory, ExtractedKeyword[]>;
  };
  added: ExtractedKeyword[];
  removed: ExtractedKeyword[];
  atsScore: {
    original: number;
    optimized: number;
    improvement: number;
  };
}

// View modes for diff editor
export type DiffViewMode = 'unified' | 'split' | 'overlay';

// PDF compilation state
export interface CompiledPDF {
  url: string;
  blob: Blob;
  compiledAt: number;
}

