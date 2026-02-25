import { describe, it, expect } from 'vitest';
import {
  tokenizeLatex,
  containsLatexCommand,
  isLatexComment,
  isInsideMathEnv,
  extractLatexCommand,
  getLatexSection,
  normalizeLatexWhitespace,
} from '../latex-tokenizer';

describe('tokenizeLatex', () => {
  it('tokenizes plain text', () => {
    const tokens = tokenizeLatex('hello world');
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => t.type === 'text')).toBe(true);
  });

  it('tokenizes LaTeX commands', () => {
    const tokens = tokenizeLatex('\\textbf{bold}');
    expect(tokens.some((t) => t.type === 'command' && t.value === '\\textbf')).toBe(true);
  });

  it('tokenizes environments', () => {
    const tokens = tokenizeLatex('\\begin{itemize}\\item hello\\end{itemize}');
    // \begin and \end are tokenized as command + group tokens
    expect(tokens.some((t) => t.type === 'command' && t.value === '\\begin')).toBe(true);
    expect(tokens.some((t) => t.type === 'group' && t.value === '{itemize}')).toBe(true);
    expect(tokens.some((t) => t.type === 'command' && t.value === '\\end')).toBe(true);
  });

  it('tokenizes inline math', () => {
    const tokens = tokenizeLatex('$x^2$');
    expect(tokens.some((t) => t.type === 'math')).toBe(true);
  });

  it('tokenizes comments', () => {
    const tokens = tokenizeLatex('% this is a comment');
    expect(tokens.some((t) => t.type === 'comment')).toBe(true);
  });

  it('tokenizes groups', () => {
    const tokens = tokenizeLatex('{grouped}');
    expect(tokens.some((t) => t.type === 'group')).toBe(true);
  });

  it('handles empty input', () => {
    const tokens = tokenizeLatex('');
    expect(tokens).toEqual([]);
  });

  it('preserves position information', () => {
    const tokens = tokenizeLatex('\\section');
    expect(tokens[0].position.start).toBe(0);
    expect(tokens[0].position.end).toBe(8);
  });
});

describe('containsLatexCommand', () => {
  it('returns true for lines with commands', () => {
    expect(containsLatexCommand('\\textbf{hello}')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsLatexCommand('hello world')).toBe(false);
  });
});

describe('isLatexComment', () => {
  it('returns true for comment lines', () => {
    expect(isLatexComment('% a comment')).toBe(true);
  });

  it('returns true for indented comments', () => {
    expect(isLatexComment('  % indented comment')).toBe(true);
  });

  it('returns false for non-comments', () => {
    expect(isLatexComment('hello')).toBe(false);
  });
});

describe('isInsideMathEnv', () => {
  it('returns true inside inline math', () => {
    expect(isInsideMathEnv('$x + y$', 3)).toBe(true);
  });

  it('returns false outside math', () => {
    expect(isInsideMathEnv('hello world', 5)).toBe(false);
  });
});

describe('extractLatexCommand', () => {
  it('extracts command name', () => {
    expect(extractLatexCommand('\\textbf{hello}')).toBe('textbf');
  });

  it('extracts starred commands', () => {
    expect(extractLatexCommand('\\section*{Title}')).toBe('section*');
  });

  it('returns null for no command', () => {
    expect(extractLatexCommand('hello')).toBeNull();
  });
});

describe('getLatexSection', () => {
  it('extracts section title', () => {
    expect(getLatexSection('\\section{Experience}')).toBe('Experience');
  });

  it('extracts subsection title', () => {
    expect(getLatexSection('\\subsection{Skills}')).toBe('Skills');
  });

  it('returns null for non-section lines', () => {
    expect(getLatexSection('hello world')).toBeNull();
  });
});

describe('normalizeLatexWhitespace', () => {
  it('normalizes CRLF to LF', () => {
    expect(normalizeLatexWhitespace('a\r\nb')).toBe('a\nb');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeLatexWhitespace('a   b')).toBe('a b');
  });

  it('limits consecutive newlines to two', () => {
    expect(normalizeLatexWhitespace('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims whitespace', () => {
    expect(normalizeLatexWhitespace('  hello  ')).toBe('hello');
  });
});
