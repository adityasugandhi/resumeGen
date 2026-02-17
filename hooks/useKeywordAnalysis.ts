/**
 * useKeywordAnalysis hook - React hook for keyword extraction and ATS scoring
 * Provides real-time keyword analysis for resume optimization
 */

import { useState, useEffect, useMemo } from 'react';
import type { ATSScore, KeywordExtractionResult } from '@/types';
import { extractKeywords, compareKeywords } from '@/lib/keywords/keyword-extractor';
import { calculateATSScore, compareATSScores } from '@/lib/keywords/ats-scorer';

interface UseKeywordAnalysisOptions {
  /**
   * Resume text to analyze
   */
  resumeText: string;

  /**
   * Optional job requirements for targeted scoring
   */
  jobRequirements?: string[];

  /**
   * Optional original resume text for comparison
   */
  originalResumeText?: string;

  /**
   * Enable auto-analysis on text change (debounced)
   */
  autoAnalyze?: boolean;

  /**
   * Debounce delay in milliseconds (default: 500ms)
   */
  debounceMs?: number;
}

interface UseKeywordAnalysisResult {
  /**
   * Current ATS score
   */
  atsScore: ATSScore | null;

  /**
   * Original ATS score (if originalResumeText provided)
   */
  originalAtsScore: ATSScore | null;

  /**
   * Keyword extraction result
   */
  keywords: KeywordExtractionResult | null;

  /**
   * Original keyword extraction result (if originalResumeText provided)
   */
  originalKeywords: KeywordExtractionResult | null;

  /**
   * Number of new keywords added (comparison mode)
   */
  newKeywordsCount: number;

  /**
   * Overall improvement score (comparison mode)
   */
  improvement: number;

  /**
   * Loading state
   */
  isAnalyzing: boolean;

  /**
   * Error state
   */
  error: string | null;

  /**
   * Manually trigger analysis
   */
  analyze: () => void;

  /**
   * Reset analysis state
   */
  reset: () => void;
}

/**
 * Hook for keyword analysis and ATS scoring
 * Automatically analyzes resume text and provides keyword insights
 */
export function useKeywordAnalysis({
  resumeText,
  jobRequirements = [],
  originalResumeText,
  autoAnalyze = true,
  debounceMs = 500,
}: UseKeywordAnalysisOptions): UseKeywordAnalysisResult {
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [originalAtsScore, setOriginalAtsScore] = useState<ATSScore | null>(null);
  const [keywords, setKeywords] = useState<KeywordExtractionResult | null>(null);
  const [originalKeywords, setOriginalKeywords] = useState<KeywordExtractionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate derived values
  const newKeywordsCount = useMemo(() => {
    if (!keywords || !originalKeywords) return 0;
    const comparison = compareKeywords(originalKeywords, keywords);
    return comparison.added.length;
  }, [keywords, originalKeywords]);

  const improvement = useMemo(() => {
    if (!atsScore || !originalAtsScore) return 0;
    return atsScore.overall - originalAtsScore.overall;
  }, [atsScore, originalAtsScore]);

  /**
   * Main analysis function
   */
  const analyze = async () => {
    if (!resumeText.trim()) {
      setError('Resume text is empty');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Extract keywords from current resume
      const currentKeywords = extractKeywords(resumeText);
      setKeywords(currentKeywords);

      // Calculate ATS score
      const currentScore = calculateATSScore(resumeText, jobRequirements);
      setAtsScore(currentScore);

      // If original resume provided, analyze it too
      if (originalResumeText && originalResumeText.trim()) {
        const origKeywords = extractKeywords(originalResumeText);
        setOriginalKeywords(origKeywords);

        const origScore = calculateATSScore(originalResumeText, jobRequirements);
        setOriginalAtsScore(origScore);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      console.error('Keyword analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Reset analysis state
   */
  const reset = () => {
    setAtsScore(null);
    setOriginalAtsScore(null);
    setKeywords(null);
    setOriginalKeywords(null);
    setError(null);
  };

  /**
   * Auto-analyze with debouncing
   */
  useEffect(() => {
    if (!autoAnalyze) return;

    const timer = setTimeout(() => {
      analyze();
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeText, originalResumeText, autoAnalyze, debounceMs]);

  /**
   * Re-analyze when job requirements change
   */
  useEffect(() => {
    if (!autoAnalyze || !keywords) return;

    // Only recalculate scores, don't re-extract keywords
    const currentScore = calculateATSScore(resumeText, jobRequirements);
    setAtsScore(currentScore);

    if (originalResumeText && originalKeywords) {
      const origScore = calculateATSScore(originalResumeText, jobRequirements);
      setOriginalAtsScore(origScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobRequirements]);

  return {
    atsScore,
    originalAtsScore,
    keywords,
    originalKeywords,
    newKeywordsCount,
    improvement,
    isAnalyzing,
    error,
    analyze,
    reset,
  };
}

/**
 * Simplified hook for basic keyword extraction only
 */
export function useKeywordExtraction(text: string) {
  const [keywords, setKeywords] = useState<KeywordExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    if (!text.trim()) {
      setKeywords(null);
      return;
    }

    setIsExtracting(true);

    // Debounce extraction
    const timer = setTimeout(() => {
      try {
        const result = extractKeywords(text);
        setKeywords(result);
      } catch (err) {
        console.error('Keyword extraction error:', err);
        setKeywords(null);
      } finally {
        setIsExtracting(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [text]);

  return {
    keywords,
    isExtracting,
  };
}

/**
 * Simplified hook for ATS scoring only
 */
export function useATSScore(resumeText: string, jobRequirements: string[] = []) {
  const [score, setScore] = useState<ATSScore | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (!resumeText.trim()) {
      setScore(null);
      return;
    }

    setIsCalculating(true);

    // Debounce scoring
    const timer = setTimeout(() => {
      try {
        const result = calculateATSScore(resumeText, jobRequirements);
        setScore(result);
      } catch (err) {
        console.error('ATS scoring error:', err);
        setScore(null);
      } finally {
        setIsCalculating(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [resumeText, jobRequirements]);

  return {
    score,
    isCalculating,
  };
}
