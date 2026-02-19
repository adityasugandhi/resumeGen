// lib/keywords barrel — re-exports public API from keyword modules

// ATS Scorer
export { calculateATSScore, compareATSScores, calculateKeywordDensity } from './ats-scorer';
export type { ATSScoreBreakdown, ATSScore, JobRequirement } from './ats-scorer';

// Keyword Extractor
export {
  stripLatex,
  extractMetrics,
  extractActionVerbs,
  extractHardSkills,
  extractSoftSkills,
  extractIndustryTerms,
  deduplicateKeywords,
  extractKeywords,
  compareKeywords,
  getTopKeywords,
} from './keyword-extractor';
export type { ExtractedKeyword, KeywordExtractionResult } from './keyword-extractor';

// Keyword Categories
export {
  ACTION_VERBS,
  HARD_SKILLS,
  SOFT_SKILLS,
  INDUSTRY_TERMS,
  KEYWORD_COLORS,
  KEYWORD_LABELS,
  getAllHardSkills,
  getKeywordsByCategory,
} from './keyword-categories';
export type { KeywordCategory } from './keyword-categories';
