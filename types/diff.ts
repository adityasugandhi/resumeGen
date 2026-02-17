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

// Keyword classification for ATS optimization
export type KeywordCategory =
  | 'hard_skill'
  | 'soft_skill'
  | 'action_verb'
  | 'industry_term'
  | 'metric'
  | 'technology';

// Extracted keyword with metadata
export interface ExtractedKeyword {
  word: string;
  category: KeywordCategory;
  isNew: boolean;
  frequency: number;
}

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

// ATS score calculation
export interface ATSScore {
  score: number; // 0-100
  breakdown: {
    keywordDensity: number;
    formatCompliance: number;
    sectionCompleteness: number;
    quantificationLevel: number;
  };
  recommendations: string[];
}
