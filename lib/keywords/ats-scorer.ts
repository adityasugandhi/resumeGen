/**
 * ATS (Applicant Tracking System) compatibility scoring
 * Evaluates resume based on keyword presence, density, and job requirement matching
 */

import type { ExtractedKeyword, KeywordExtractionResult } from './keyword-extractor';
import { extractKeywords, compareKeywords } from './keyword-extractor';
import type { KeywordCategory } from './keyword-categories';

export interface ATSScoreBreakdown {
  hardSkills: number; // 0-100
  softSkills: number; // 0-100
  actionVerbs: number; // 0-100
  metrics: number; // 0-100
  industryTerms: number; // 0-100
}

export interface ATSScore {
  overall: number; // 0-100
  breakdown: ATSScoreBreakdown;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  passingScore: boolean; // >= 70 is considered passing
}

export interface JobRequirement {
  text: string;
  category: KeywordCategory;
  priority: 'must_have' | 'nice_to_have';
}

/**
 * Calculate ATS score based on resume keywords and job requirements
 */
export function calculateATSScore(
  resumeText: string,
  jobRequirements: string[] = []
): ATSScore {
  const extraction = extractKeywords(resumeText);

  // If job requirements provided, calculate match score
  if (jobRequirements.length > 0) {
    return calculateMatchScore(extraction, jobRequirements);
  }

  // Otherwise, calculate general ATS score
  return calculateGeneralScore(extraction);
}

/**
 * Calculate general ATS score without specific job requirements
 * Based on best practices for resume keyword density
 */
function calculateGeneralScore(extraction: KeywordExtractionResult): ATSScore {
  const { metrics, byCategory } = extraction;

  // Score components (0-100 each)
  const hardSkillScore = Math.min(100, (metrics.hardSkillCount / 10) * 100); // 10+ hard skills = 100
  const softSkillScore = Math.min(100, (metrics.softSkillCount / 5) * 100); // 5+ soft skills = 100
  const actionVerbScore = Math.min(100, (metrics.actionVerbCount / 8) * 100); // 8+ action verbs = 100
  const metricScore = Math.min(100, (metrics.metricCount / 6) * 100); // 6+ metrics = 100
  const industryTermScore = Math.min(100, (metrics.industryTermCount / 8) * 100); // 8+ industry terms = 100

  const breakdown: ATSScoreBreakdown = {
    hardSkills: Math.round(hardSkillScore),
    softSkills: Math.round(softSkillScore),
    actionVerbs: Math.round(actionVerbScore),
    metrics: Math.round(metricScore),
    industryTerms: Math.round(industryTermScore),
  };

  // Weighted average (hard skills and action verbs weighted higher)
  const overall = Math.round(
    hardSkillScore * 0.3 +
    actionVerbScore * 0.25 +
    metricScore * 0.2 +
    industryTermScore * 0.15 +
    softSkillScore * 0.1
  );

  const suggestions = generateGeneralSuggestions(breakdown, byCategory);

  return {
    overall,
    breakdown,
    matchedKeywords: extraction.keywords.map(k => k.word),
    missingKeywords: [],
    suggestions,
    grade: getGrade(overall),
    passingScore: overall >= 70,
  };
}

/**
 * Calculate match score against specific job requirements
 */
function calculateMatchScore(
  extraction: KeywordExtractionResult,
  jobRequirements: string[]
): ATSScore {
  const resumeKeywords = new Set(
    extraction.keywords.map(k => k.word.toLowerCase())
  );

  // Categorize job requirements
  const hardSkillReqs = jobRequirements.filter(req =>
    extraction.byCategory.hard_skill.some(k =>
      req.toLowerCase().includes(k.word.toLowerCase())
    )
  );

  const actionVerbReqs = jobRequirements.filter(req =>
    extraction.byCategory.action_verb.some(k =>
      req.toLowerCase().includes(k.word.toLowerCase())
    )
  );

  // Calculate matches
  const matchedRequirements = jobRequirements.filter(req => {
    const reqLower = req.toLowerCase();
    return Array.from(resumeKeywords).some(keyword =>
      reqLower.includes(keyword) || keyword.includes(reqLower)
    );
  });

  const missingRequirements = jobRequirements.filter(req => {
    const reqLower = req.toLowerCase();
    return !Array.from(resumeKeywords).some(keyword =>
      reqLower.includes(keyword) || keyword.includes(reqLower)
    );
  });

  // Score breakdown
  const matchRate = jobRequirements.length > 0
    ? (matchedRequirements.length / jobRequirements.length) * 100
    : 0;

  const breakdown: ATSScoreBreakdown = {
    hardSkills: calculateCategoryMatch(extraction.byCategory.hard_skill, hardSkillReqs),
    softSkills: Math.min(100, (extraction.metrics.softSkillCount / 3) * 100),
    actionVerbs: Math.min(100, (extraction.metrics.actionVerbCount / 6) * 100),
    metrics: Math.min(100, (extraction.metrics.metricCount / 5) * 100),
    industryTerms: Math.min(100, (extraction.metrics.industryTermCount / 5) * 100),
  };

  // Overall score emphasizes job requirement matching
  const overall = Math.round(
    matchRate * 0.5 + // 50% weight on direct requirement matching
    breakdown.hardSkills * 0.2 +
    breakdown.actionVerbs * 0.15 +
    breakdown.metrics * 0.1 +
    breakdown.industryTerms * 0.05
  );

  const suggestions = generateMatchSuggestions(
    matchedRequirements,
    missingRequirements,
    breakdown
  );

  return {
    overall,
    breakdown,
    matchedKeywords: matchedRequirements,
    missingKeywords: missingRequirements,
    suggestions,
    grade: getGrade(overall),
    passingScore: overall >= 70,
  };
}

/**
 * Calculate match percentage for a specific category
 */
function calculateCategoryMatch(
  extractedKeywords: ExtractedKeyword[],
  requirements: string[]
): number {
  if (requirements.length === 0) return 100;

  const matched = requirements.filter(req => {
    const reqLower = req.toLowerCase();
    return extractedKeywords.some(k =>
      reqLower.includes(k.word.toLowerCase()) ||
      k.word.toLowerCase().includes(reqLower)
    );
  });

  return Math.round((matched.length / requirements.length) * 100);
}

/**
 * Generate suggestions for general score improvement
 */
function generateGeneralSuggestions(
  breakdown: ATSScoreBreakdown,
  byCategory: Record<KeywordCategory, ExtractedKeyword[]>
): string[] {
  const suggestions: string[] = [];

  if (breakdown.hardSkills < 70) {
    suggestions.push(
      `Add more technical skills (currently ${byCategory.hard_skill.length}). Aim for 10+ hard skills to improve ATS compatibility.`
    );
  }

  if (breakdown.actionVerbs < 70) {
    suggestions.push(
      `Use stronger action verbs (currently ${byCategory.action_verb.length}). Start bullet points with impactful verbs like "architected," "spearheaded," or "optimized."`
    );
  }

  if (breakdown.metrics < 70) {
    suggestions.push(
      `Add more quantifiable achievements (currently ${byCategory.metric.length}). Include percentages, dollar amounts, time savings, or user counts.`
    );
  }

  if (breakdown.industryTerms < 70) {
    suggestions.push(
      `Include more industry-specific terminology (currently ${byCategory.industry_term.length}). Use terms like "agile," "microservices," "CI/CD," or "scalability."`
    );
  }

  if (breakdown.softSkills < 70) {
    suggestions.push(
      `Incorporate soft skills naturally (currently ${byCategory.soft_skill.length}). Mention leadership, collaboration, or problem-solving in context.`
    );
  }

  // Positive feedback for high scores
  if (breakdown.hardSkills >= 80 && breakdown.actionVerbs >= 80) {
    suggestions.push(
      `Excellent keyword density! Your resume has strong technical skills and action verbs.`
    );
  }

  if (breakdown.metrics >= 80) {
    suggestions.push(
      `Great use of metrics and quantifiable achievements!`
    );
  }

  return suggestions;
}

/**
 * Generate suggestions for job-specific match improvement
 */
function generateMatchSuggestions(
  matched: string[],
  missing: string[],
  breakdown: ATSScoreBreakdown
): string[] {
  const suggestions: string[] = [];

  if (missing.length > 0) {
    const topMissing = missing.slice(0, 3);
    suggestions.push(
      `Missing key requirements: ${topMissing.map(m => `"${m}"`).join(', ')}. Consider adding relevant experience or skills.`
    );
  }

  if (matched.length > 0) {
    suggestions.push(
      `Strong matches (${matched.length}/${matched.length + missing.length}): ${matched.slice(0, 3).map(m => `"${m}"`).join(', ')}`
    );
  }

  if (breakdown.metrics < 70) {
    suggestions.push(
      `Quantify your achievements with specific numbers, percentages, or dollar amounts to strengthen your application.`
    );
  }

  if (breakdown.actionVerbs < 70) {
    suggestions.push(
      `Use more powerful action verbs at the start of bullet points to demonstrate impact.`
    );
  }

  return suggestions;
}

/**
 * Convert numeric score to letter grade
 */
function getGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Compare ATS scores before and after optimization
 */
export function compareATSScores(
  originalText: string,
  optimizedText: string,
  jobRequirements: string[] = []
): {
  original: ATSScore;
  optimized: ATSScore;
  improvement: {
    overall: number;
    hardSkills: number;
    softSkills: number;
    actionVerbs: number;
    metrics: number;
    industryTerms: number;
  };
  newKeywords: ExtractedKeyword[];
  summary: string;
} {
  const original = calculateATSScore(originalText, jobRequirements);
  const optimized = calculateATSScore(optimizedText, jobRequirements);

  const originalExtraction = extractKeywords(originalText);
  const optimizedExtraction = extractKeywords(optimizedText);
  const comparison = compareKeywords(originalExtraction, optimizedExtraction);

  const improvement = {
    overall: optimized.overall - original.overall,
    hardSkills: optimized.breakdown.hardSkills - original.breakdown.hardSkills,
    softSkills: optimized.breakdown.softSkills - original.breakdown.softSkills,
    actionVerbs: optimized.breakdown.actionVerbs - original.breakdown.actionVerbs,
    metrics: optimized.breakdown.metrics - original.breakdown.metrics,
    industryTerms: optimized.breakdown.industryTerms - original.breakdown.industryTerms,
  };

  const summary = generateImprovementSummary(original, optimized, improvement);

  return {
    original,
    optimized,
    improvement,
    newKeywords: comparison.added,
    summary,
  };
}

/**
 * Generate human-readable summary of improvements
 */
function generateImprovementSummary(
  original: ATSScore,
  optimized: ATSScore,
  improvement: ReturnType<typeof compareATSScores>['improvement']
): string {
  const parts: string[] = [];

  parts.push(`ATS score improved from ${original.overall}% (${original.grade}) to ${optimized.overall}% (${optimized.grade})`);

  if (improvement.overall > 0) {
    parts.push(`+${improvement.overall} points overall`);
  }

  const significantImprovements: string[] = [];
  if (improvement.hardSkills >= 10) significantImprovements.push('hard skills');
  if (improvement.actionVerbs >= 10) significantImprovements.push('action verbs');
  if (improvement.metrics >= 10) significantImprovements.push('metrics');
  if (improvement.industryTerms >= 10) significantImprovements.push('industry terms');

  if (significantImprovements.length > 0) {
    parts.push(`Significant improvements in: ${significantImprovements.join(', ')}`);
  }

  if (!original.passingScore && optimized.passingScore) {
    parts.push('Now meets ATS passing threshold (70%)!');
  }

  return parts.join('. ');
}

/**
 * Get keyword density score (keywords per 100 words)
 */
export function calculateKeywordDensity(
  text: string,
  keywords: ExtractedKeyword[]
): {
  density: number;
  wordCount: number;
  keywordCount: number;
  ideal: boolean;
} {
  const words = text.trim().split(/\s+/).length;
  const keywordCount = keywords.reduce((sum, k) => sum + k.count, 0);
  const density = (keywordCount / words) * 100;

  // Ideal density is 2-4% for ATS
  const ideal = density >= 2 && density <= 4;

  return {
    density: Math.round(density * 100) / 100,
    wordCount: words,
    keywordCount,
    ideal,
  };
}
