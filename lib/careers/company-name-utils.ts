/**
 * Company name normalization and fuzzy matching utilities.
 * Used to cross-reference H1B sponsor names with the company registry.
 */

const SUFFIXES = [
  /,?\s*inc\.?$/i,
  /,?\s*llc\.?$/i,
  /,?\s*ltd\.?$/i,
  /,?\s*corp\.?$/i,
  /,?\s*corporation$/i,
  /,?\s*co\.?$/i,
  /,?\s*company$/i,
  /,?\s*technologies$/i,
  /,?\s*technology$/i,
  /,?\s*systems$/i,
  /,?\s*solutions$/i,
  /,?\s*services$/i,
  /,?\s*group$/i,
  /,?\s*holdings$/i,
  /,?\s*platforms$/i,
  /,?\s*international$/i,
  /\.com$/i,
];

/**
 * Normalize a company name for comparison by stripping legal suffixes,
 * extra whitespace, and converting to lowercase.
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name.trim();
  for (const suffix of SUFFIXES) {
    normalized = normalized.replace(suffix, '');
  }
  return normalized.trim().toLowerCase();
}

/**
 * Check if two company names match using fuzzy comparison.
 * Tries exact normalized match first, then substring containment.
 */
export function companiesMatch(a: string, b: string): boolean {
  const normA = normalizeCompanyName(a);
  const normB = normalizeCompanyName(b);

  // Exact match after normalization
  if (normA === normB) return true;

  // One contains the other (handles "Goldman Sachs Group" vs "Goldman Sachs")
  if (normA.includes(normB) || normB.includes(normA)) return true;

  return false;
}

/**
 * Find the best matching company from a list.
 * Returns the matched name or null if no match found.
 */
export function findMatchingCompany(
  target: string,
  candidates: string[]
): string | null {
  const normTarget = normalizeCompanyName(target);

  // First pass: exact normalized match
  for (const candidate of candidates) {
    if (normalizeCompanyName(candidate) === normTarget) return candidate;
  }

  // Second pass: substring containment
  for (const candidate of candidates) {
    const normCandidate = normalizeCompanyName(candidate);
    if (normTarget.includes(normCandidate) || normCandidate.includes(normTarget)) {
      return candidate;
    }
  }

  return null;
}
