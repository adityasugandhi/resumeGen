/**
 * Keyword extraction from LaTeX resume content
 * Uses NLP patterns and category matching to identify keywords
 */

import {
  ACTION_VERBS,
  SOFT_SKILLS,
  getAllHardSkills,
  INDUSTRY_TERMS,
  type KeywordCategory,
} from './keyword-categories';

export interface ExtractedKeyword {
  word: string;
  category: KeywordCategory;
  count: number;
  positions: number[]; // Character positions in text
  context?: string; // Surrounding text for context
  isNew?: boolean; // For comparison (optimized vs original)
}

export interface KeywordExtractionResult {
  keywords: ExtractedKeyword[];
  totalCount: number;
  byCategory: Record<KeywordCategory, ExtractedKeyword[]>;
  metrics: {
    actionVerbCount: number;
    hardSkillCount: number;
    softSkillCount: number;
    metricCount: number;
    industryTermCount: number;
  };
}

/**
 * Strip LaTeX commands while preserving text content
 */
export function stripLatex(text: string): string {
  let cleaned = text;

  // Remove comments
  cleaned = cleaned.replace(/%.*/g, '');

  // Remove common LaTeX commands but keep their content
  cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, '$1'); // Bold
  cleaned = cleaned.replace(/\\textit\{([^}]+)\}/g, '$1'); // Italic
  cleaned = cleaned.replace(/\\emph\{([^}]+)\}/g, '$1'); // Emphasis
  cleaned = cleaned.replace(/\\texttt\{([^}]+)\}/g, '$1'); // Monospace
  cleaned = cleaned.replace(/\\underline\{([^}]+)\}/g, '$1'); // Underline
  cleaned = cleaned.replace(/\\href\{[^}]+\}\{([^}]+)\}/g, '$1'); // Links
  cleaned = cleaned.replace(/\\url\{([^}]+)\}/g, '$1'); // URLs

  // Remove structural commands
  cleaned = cleaned.replace(/\\(documentclass|usepackage|begin|end|section|subsection|item)\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/\\(maketitle|newpage|clearpage|pagebreak)/g, '');

  // Remove custom resume commands (common patterns)
  cleaned = cleaned.replace(/\\resumeSubheading\{([^}]+)\}/g, '$1');
  cleaned = cleaned.replace(/\\resumeItem\{([^}]+)\}/g, '$1');
  cleaned = cleaned.replace(/\\resumeProjectHeading\{([^}]+)\}/g, '$1');

  // Remove remaining backslash commands
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, '');

  // Remove special characters
  cleaned = cleaned.replace(/[{}[\]]/g, ' ');
  cleaned = cleaned.replace(/\\[&%$#_]/g, '');

  // Clean up multiple spaces and newlines
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract metrics (numbers, percentages, dollar amounts, time durations)
 */
export function extractMetrics(text: string): ExtractedKeyword[] {
  const metrics: ExtractedKeyword[] = [];
  const plainText = stripLatex(text);

  const patterns = [
    {
      regex: /(\d+(?:\.\d+)?%)/g,
      type: 'percentage'
    },
    {
      regex: /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?[KMB]?)/gi,
      type: 'currency'
    },
    {
      regex: /(\d+(?:\.\d+)?[xX])/g,
      type: 'multiplier'
    },
    {
      regex: /(\d{1,3}(?:,\d{3})*[KMB]\+?)/gi,
      type: 'large_number'
    },
    {
      regex: /(\d+\s*(?:years?|months?|weeks?|days?|hours?))/gi,
      type: 'duration'
    },
    {
      regex: /(\d+\+?\s*(?:users?|customers?|clients?|employees?|members?|projects?|features?|applications?))/gi,
      type: 'count'
    },
  ];

  patterns.forEach(({ regex, type }) => {
    let match;
    while ((match = regex.exec(plainText)) !== null) {
      const word = match[0].trim();
      const position = match.index;

      // Get context (20 chars before and after)
      const contextStart = Math.max(0, position - 20);
      const contextEnd = Math.min(plainText.length, position + word.length + 20);
      const context = plainText.slice(contextStart, contextEnd).trim();

      // Find or create keyword entry
      const existing = metrics.find(k => k.word.toLowerCase() === word.toLowerCase());
      if (existing) {
        existing.count++;
        existing.positions.push(position);
      } else {
        metrics.push({
          word,
          category: 'metric',
          count: 1,
          positions: [position],
          context,
        });
      }
    }
  });

  return metrics;
}

/**
 * Extract action verbs from text
 */
export function extractActionVerbs(text: string): ExtractedKeyword[] {
  const plainText = stripLatex(text).toLowerCase();
  const keywords: ExtractedKeyword[] = [];

  ACTION_VERBS.forEach(verb => {
    // Match word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${verb}(?:ed|ing|s)?\\b`, 'gi');
    let match;

    while ((match = regex.exec(plainText)) !== null) {
      const word = match[0];
      const position = match.index;

      // Get context
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(plainText.length, position + word.length + 30);
      const context = plainText.slice(contextStart, contextEnd).trim();

      const existing = keywords.find(k => k.word.toLowerCase() === verb);
      if (existing) {
        existing.count++;
        existing.positions.push(position);
      } else {
        keywords.push({
          word: verb,
          category: 'action_verb',
          count: 1,
          positions: [position],
          context,
        });
      }
    }
  });

  return keywords;
}

/**
 * Extract hard skills (technologies, programming languages, tools)
 */
export function extractHardSkills(text: string): ExtractedKeyword[] {
  const plainText = stripLatex(text);
  const keywords: ExtractedKeyword[] = [];
  const allSkills = getAllHardSkills();

  allSkills.forEach(skill => {
    // Case-insensitive search but preserve original casing
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let match;

    while ((match = regex.exec(plainText)) !== null) {
      const word = match[0];
      const position = match.index;

      // Get context
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(plainText.length, position + word.length + 30);
      const context = plainText.slice(contextStart, contextEnd).trim();

      const existing = keywords.find(k => k.word.toLowerCase() === skill.toLowerCase());
      if (existing) {
        existing.count++;
        existing.positions.push(position);
      } else {
        keywords.push({
          word: skill,
          category: 'hard_skill',
          count: 1,
          positions: [position],
          context,
        });
      }
    }
  });

  return keywords;
}

/**
 * Extract soft skills from text
 */
export function extractSoftSkills(text: string): ExtractedKeyword[] {
  const plainText = stripLatex(text).toLowerCase();
  const keywords: ExtractedKeyword[] = [];

  SOFT_SKILLS.forEach(skill => {
    const regex = new RegExp(`\\b${skill}\\b`, 'gi');
    let match;

    while ((match = regex.exec(plainText)) !== null) {
      const word = match[0];
      const position = match.index;

      // Get context
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(plainText.length, position + word.length + 30);
      const context = plainText.slice(contextStart, contextEnd).trim();

      const existing = keywords.find(k => k.word.toLowerCase() === skill);
      if (existing) {
        existing.count++;
        existing.positions.push(position);
      } else {
        keywords.push({
          word: skill,
          category: 'soft_skill',
          count: 1,
          positions: [position],
          context,
        });
      }
    }
  });

  return keywords;
}

/**
 * Extract industry terms from text
 */
export function extractIndustryTerms(text: string): ExtractedKeyword[] {
  const plainText = stripLatex(text);
  const keywords: ExtractedKeyword[] = [];
  const allTerms = Object.values(INDUSTRY_TERMS).flat();

  allTerms.forEach(term => {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let match;

    while ((match = regex.exec(plainText)) !== null) {
      const word = match[0];
      const position = match.index;

      // Get context
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(plainText.length, position + word.length + 30);
      const context = plainText.slice(contextStart, contextEnd).trim();

      const existing = keywords.find(k => k.word.toLowerCase() === term.toLowerCase());
      if (existing) {
        existing.count++;
        existing.positions.push(position);
      } else {
        keywords.push({
          word: term,
          category: 'industry_term',
          count: 1,
          positions: [position],
          context,
        });
      }
    }
  });

  return keywords;
}

/**
 * Deduplicate keywords (case-insensitive matching)
 */
export function deduplicateKeywords(keywords: ExtractedKeyword[]): ExtractedKeyword[] {
  const seen = new Map<string, ExtractedKeyword>();

  keywords.forEach(keyword => {
    const key = keyword.word.toLowerCase();
    const existing = seen.get(key);

    if (existing) {
      existing.count += keyword.count;
      existing.positions.push(...keyword.positions);
    } else {
      seen.set(key, { ...keyword });
    }
  });

  return Array.from(seen.values());
}

/**
 * Main extraction function - extracts all keywords from resume text
 */
export function extractKeywords(text: string): KeywordExtractionResult {
  const actionVerbs = extractActionVerbs(text);
  const hardSkills = extractHardSkills(text);
  const softSkills = extractSoftSkills(text);
  const metrics = extractMetrics(text);
  const industryTerms = extractIndustryTerms(text);

  const allKeywords = deduplicateKeywords([
    ...actionVerbs,
    ...hardSkills,
    ...softSkills,
    ...metrics,
    ...industryTerms,
  ]);

  const byCategory: Record<KeywordCategory, ExtractedKeyword[]> = {
    action_verb: allKeywords.filter(k => k.category === 'action_verb'),
    hard_skill: allKeywords.filter(k => k.category === 'hard_skill'),
    soft_skill: allKeywords.filter(k => k.category === 'soft_skill'),
    metric: allKeywords.filter(k => k.category === 'metric'),
    industry_term: allKeywords.filter(k => k.category === 'industry_term'),
    technology: allKeywords.filter(k => k.category === 'technology'),
  };

  return {
    keywords: allKeywords,
    totalCount: allKeywords.reduce((sum, k) => sum + k.count, 0),
    byCategory,
    metrics: {
      actionVerbCount: byCategory.action_verb.length,
      hardSkillCount: byCategory.hard_skill.length,
      softSkillCount: byCategory.soft_skill.length,
      metricCount: byCategory.metric.length,
      industryTermCount: byCategory.industry_term.length,
    },
  };
}

/**
 * Compare two resumes and identify new/added keywords
 */
export function compareKeywords(
  original: KeywordExtractionResult,
  optimized: KeywordExtractionResult
): {
  added: ExtractedKeyword[];
  removed: ExtractedKeyword[];
  common: ExtractedKeyword[];
  improvement: {
    actionVerbs: number;
    hardSkills: number;
    softSkills: number;
    metrics: number;
    industryTerms: number;
  };
} {
  const originalWords = new Set(original.keywords.map(k => k.word.toLowerCase()));
  const optimizedWords = new Set(optimized.keywords.map(k => k.word.toLowerCase()));

  const added = optimized.keywords
    .filter(k => !originalWords.has(k.word.toLowerCase()))
    .map(k => ({ ...k, isNew: true }));

  const removed = original.keywords
    .filter(k => !optimizedWords.has(k.word.toLowerCase()));

  const common = optimized.keywords
    .filter(k => originalWords.has(k.word.toLowerCase()));

  const improvement = {
    actionVerbs: optimized.metrics.actionVerbCount - original.metrics.actionVerbCount,
    hardSkills: optimized.metrics.hardSkillCount - original.metrics.hardSkillCount,
    softSkills: optimized.metrics.softSkillCount - original.metrics.softSkillCount,
    metrics: optimized.metrics.metricCount - original.metrics.metricCount,
    industryTerms: optimized.metrics.industryTermCount - original.metrics.industryTermCount,
  };

  return {
    added,
    removed,
    common,
    improvement,
  };
}

/**
 * Get top N keywords by count
 */
export function getTopKeywords(
  keywords: ExtractedKeyword[],
  n: number = 10
): ExtractedKeyword[] {
  return [...keywords]
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
