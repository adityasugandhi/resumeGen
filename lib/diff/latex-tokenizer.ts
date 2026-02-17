/**
 * LaTeX-aware tokenizer for smart diffing
 * Preserves LaTeX structures during diff computation
 */

import DiffMatchPatch from 'diff-match-patch';
import type { DiffResult } from '@/types/diff';
import type { LaTeXToken, LaTeXTokenType } from './diff-types';
import { computeDiff } from './diff-engine';

const dmp = new DiffMatchPatch();

/**
 * Tokenize LaTeX content preserving structure
 */
export function tokenizeLatex(content: string): LaTeXToken[] {
  const tokens: LaTeXToken[] = [];
  let position = 0;

  while (position < content.length) {
    const remaining = content.slice(position);

    // Match LaTeX commands
    const commandMatch = remaining.match(/^\\[a-zA-Z]+\*?/);
    if (commandMatch) {
      const value = commandMatch[0];
      tokens.push({
        type: 'command',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match environment begin/end
    const beginMatch = remaining.match(/^\\begin\{([^}]+)\}/);
    if (beginMatch) {
      const value = beginMatch[0];
      tokens.push({
        type: 'environment',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    const endMatch = remaining.match(/^\\end\{([^}]+)\}/);
    if (endMatch) {
      const value = endMatch[0];
      tokens.push({
        type: 'environment',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match inline math
    const inlineMathMatch = remaining.match(/^\$([^$]+)\$/);
    if (inlineMathMatch) {
      const value = inlineMathMatch[0];
      tokens.push({
        type: 'math',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match display math
    const displayMathMatch = remaining.match(/^\$\$([^$]+)\$\$/);
    if (displayMathMatch) {
      const value = displayMathMatch[0];
      tokens.push({
        type: 'math',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match comments
    const commentMatch = remaining.match(/^%[^\n]*/);
    if (commentMatch) {
      const value = commentMatch[0];
      tokens.push({
        type: 'comment',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match groups
    const groupMatch = remaining.match(/^\{[^}]*\}/);
    if (groupMatch) {
      const value = groupMatch[0];
      tokens.push({
        type: 'group',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match whitespace
    const whitespaceMatch = remaining.match(/^[ \t]+/);
    if (whitespaceMatch) {
      const value = whitespaceMatch[0];
      tokens.push({
        type: 'whitespace',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Match newlines
    if (remaining.startsWith('\n')) {
      tokens.push({
        type: 'newline',
        value: '\n',
        position: { start: position, end: position + 1 },
      });
      position++;
      continue;
    }

    // Match regular text (everything else until next special char)
    const textMatch = remaining.match(/^[^\\$%{}\n]+/);
    if (textMatch) {
      const value = textMatch[0];
      tokens.push({
        type: 'text',
        value,
        position: { start: position, end: position + value.length },
      });
      position += value.length;
      continue;
    }

    // Single character fallback
    tokens.push({
      type: 'text',
      value: remaining[0],
      position: { start: position, end: position + 1 },
    });
    position++;
  }

  return tokens;
}

/**
 * Compute diff with LaTeX awareness
 * Treats LaTeX structures as atomic units
 */
export function diffLatexAware(original: string, modified: string): DiffResult {
  // Tokenize both versions
  const originalTokens = tokenizeLatex(original);
  const modifiedTokens = tokenizeLatex(modified);

  // Convert tokens to string representation for diffing
  const originalTokenString = tokensToString(originalTokens);
  const modifiedTokenString = tokensToString(modifiedTokens);

  // Compute standard diff
  const result = computeDiff(originalTokenString, modifiedTokenString);

  // Map back to original content
  return result;
}

/**
 * Convert tokens to a string representation for diffing
 * Uses special delimiters to preserve token boundaries
 */
function tokensToString(tokens: LaTeXToken[]): string {
  return tokens.map((token) => token.value).join('');
}

/**
 * Check if a line contains a LaTeX command
 */
export function containsLatexCommand(line: string): boolean {
  return /\\[a-zA-Z]+/.test(line);
}

/**
 * Check if a line is a LaTeX comment
 */
export function isLatexComment(line: string): boolean {
  return line.trim().startsWith('%');
}

/**
 * Check if content is inside a math environment
 */
export function isInsideMathEnv(content: string, position: number): boolean {
  const before = content.slice(0, position);

  // Count $ symbols before position
  const dollarCount = (before.match(/\$/g) || []).length;

  // Odd count means inside inline math
  if (dollarCount % 2 === 1) return true;

  // Check for display math
  if (before.includes('$$') && !content.slice(position).includes('$$')) {
    return true;
  }

  // Check for math environments
  const beginMath = before.match(/\\begin\{(equation|align|math)\}/g) || [];
  const endMath = before.match(/\\end\{(equation|align|math)\}/g) || [];

  return beginMath.length > endMath.length;
}

/**
 * Extract LaTeX command from text
 */
export function extractLatexCommand(text: string): string | null {
  const match = text.match(/\\([a-zA-Z]+\*?)/);
  return match ? match[1] : null;
}

/**
 * Get LaTeX section from line
 */
export function getLatexSection(line: string): string | null {
  // Match common section commands
  const sectionMatch = line.match(/\\(section|subsection|subsubsection)\{([^}]+)\}/);
  if (sectionMatch) {
    return sectionMatch[2];
  }

  // Match resume-specific sections
  const resumeMatch = line.match(/\\resumeSubheading/);
  if (resumeMatch) {
    return 'Experience';
  }

  const skillsMatch = line.match(/\\resumeItemsStart|\\resumeSkills/);
  if (skillsMatch) {
    return 'Skills';
  }

  const educationMatch = line.match(/\\education|\\resumeEducation/);
  if (educationMatch) {
    return 'Education';
  }

  return null;
}

/**
 * Normalize LaTeX whitespace for comparison
 */
export function normalizeLatexWhitespace(content: string): string {
  return content
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
}

/**
 * Smart line splitting that preserves LaTeX structures
 */
export function splitLatexLines(content: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let braceDepth = 0;
  let inEnvironment = false;

  for (const char of content) {
    currentLine += char;

    // Track brace depth
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;

    // Track environment state
    if (currentLine.includes('\\begin{')) inEnvironment = true;
    if (currentLine.includes('\\end{')) inEnvironment = false;

    // Split on newline only if not inside braces or environment
    if (char === '\n' && braceDepth === 0 && !inEnvironment) {
      lines.push(currentLine);
      currentLine = '';
    }
  }

  // Add remaining content
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
