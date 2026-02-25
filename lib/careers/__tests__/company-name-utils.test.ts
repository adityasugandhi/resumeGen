import { describe, it, expect } from 'vitest';
import { normalizeCompanyName, companiesMatch, findMatchingCompany } from '../company-name-utils';

describe('normalizeCompanyName', () => {
  it('strips Inc.', () => {
    expect(normalizeCompanyName('Apple Inc.')).toBe('apple');
  });

  it('strips LLC', () => {
    expect(normalizeCompanyName('Stripe, LLC')).toBe('stripe');
  });

  it('strips Corp', () => {
    expect(normalizeCompanyName('Microsoft Corp.')).toBe('microsoft');
  });

  it('strips .com', () => {
    expect(normalizeCompanyName('Amazon.com')).toBe('amazon');
  });

  it('strips Technologies', () => {
    expect(normalizeCompanyName('Palantir Technologies')).toBe('palantir');
  });

  it('strips Platforms', () => {
    expect(normalizeCompanyName('Meta Platforms Inc.')).toBe('meta');
  });

  it('handles multiple suffixes', () => {
    expect(normalizeCompanyName('Tata Consultancy Services, Ltd.')).toBe('tata consultancy');
  });

  it('trims whitespace', () => {
    expect(normalizeCompanyName('  Google  ')).toBe('google');
  });
});

describe('companiesMatch', () => {
  it('matches exact names', () => {
    expect(companiesMatch('Apple', 'Apple')).toBe(true);
  });

  it('matches after normalization', () => {
    expect(companiesMatch('Apple Inc.', 'Apple')).toBe(true);
  });

  it('matches with .com suffix', () => {
    expect(companiesMatch('Amazon.com, Inc.', 'Amazon')).toBe(true);
  });

  it('matches with Platforms suffix', () => {
    expect(companiesMatch('Meta Platforms Inc.', 'Meta')).toBe(true);
  });

  it('matches substring containment', () => {
    expect(companiesMatch('Goldman Sachs Group', 'Goldman Sachs')).toBe(true);
  });

  it('rejects non-matching names', () => {
    expect(companiesMatch('Apple', 'Google')).toBe(false);
  });
});

describe('findMatchingCompany', () => {
  const registry = ['Apple', 'Google', 'Meta', 'Amazon', 'Goldman Sachs', 'Stripe'];

  it('finds exact match', () => {
    expect(findMatchingCompany('Apple', registry)).toBe('Apple');
  });

  it('finds after normalization', () => {
    expect(findMatchingCompany('Apple Inc.', registry)).toBe('Apple');
  });

  it('finds substring match', () => {
    expect(findMatchingCompany('Goldman Sachs Group Inc.', registry)).toBe('Goldman Sachs');
  });

  it('returns null for no match', () => {
    expect(findMatchingCompany('Netflix', registry)).toBeNull();
  });
});
