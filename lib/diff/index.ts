// lib/diff barrel — re-exports public API from diff modules

// Diff Types
export {
  DIFF_DELETE,
  DIFF_INSERT,
  DIFF_EQUAL,
  DEFAULT_HUNK_CONFIG,
  isDiffDelete,
  isDiffInsert,
  isDiffEqual,
} from './diff-types';
export type {
  LaTeXTokenType,
  LaTeXToken,
  LineType,
  HunkConfig,
  LineDiffState,
} from './diff-types';

// Diff Engine
export { computeDiff, getCleanDiff, getDiffSummary } from './diff-engine';

// LaTeX Tokenizer
export {
  tokenizeLatex,
  diffLatexAware,
  containsLatexCommand,
  isLatexComment,
  isInsideMathEnv,
  extractLatexCommand,
  getLatexSection,
  normalizeLatexWhitespace,
  splitLatexLines,
} from './latex-tokenizer';
