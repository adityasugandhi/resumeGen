import { describe, it, expect } from 'vitest';
import { computeDiff, getCleanDiff, getDiffSummary } from '../diff-engine';

describe('computeDiff', () => {
  it('detects no changes for identical text', () => {
    const result = computeDiff('hello world', 'hello world');
    const { additions, deletions, modifications } = result.stats;
    expect(additions + deletions + modifications).toBe(0);
  });

  it('detects additions', () => {
    const result = computeDiff('line1\nline2', 'line1\nline2\nline3');
    expect(result.stats.additions).toBeGreaterThan(0);
  });

  it('detects deletions', () => {
    const result = computeDiff('line1\nline2\nline3', 'line1\nline3');
    const totalChanges = result.stats.deletions + result.stats.modifications;
    expect(totalChanges).toBeGreaterThan(0);
  });

  it('detects modifications', () => {
    const result = computeDiff('old text here', 'new text here');
    const totalChanges =
      result.stats.additions + result.stats.deletions + result.stats.modifications;
    expect(totalChanges).toBeGreaterThan(0);
  });

  it('returns lines array', () => {
    const result = computeDiff('a\nb', 'a\nc');
    expect(Array.isArray(result.lines)).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('returns hunks array', () => {
    const result = computeDiff('a', 'b');
    expect(Array.isArray(result.hunks)).toBe(true);
  });
});

describe('getCleanDiff', () => {
  it('returns only changed lines', () => {
    const result = computeDiff('line1\nline2\nline3', 'line1\nchanged\nline3');
    const clean = getCleanDiff(result);
    expect(clean.every((line) => line.type !== 'unchanged')).toBe(true);
  });

  it('returns empty array when no changes', () => {
    const result = computeDiff('same', 'same');
    const clean = getCleanDiff(result);
    expect(clean.length).toBe(0);
  });
});

describe('getDiffSummary', () => {
  it('returns "No changes" for identical text', () => {
    const result = computeDiff('hello', 'hello');
    expect(getDiffSummary(result)).toBe('No changes');
  });

  it('returns formatted summary with additions', () => {
    const result = computeDiff('a', 'a\nb');
    const summary = getDiffSummary(result);
    expect(summary).toContain('+');
  });

  it('returns a non-empty string for changes', () => {
    const result = computeDiff('old', 'new');
    const summary = getDiffSummary(result);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).not.toBe('No changes');
  });
});
