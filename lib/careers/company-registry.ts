import type { CareerPlatform, CompanyConfig } from './types';

/**
 * Static registry that maps well-known tech companies to their ATS platform,
 * board token, and public careers URL.
 *
 * Board tokens were verified against each platform's public API as of
 * February 2025. If a company migrates platforms the token may need updating.
 *
 * Greenhouse API : https://boards-api.greenhouse.io/v1/boards/{token}/jobs
 * Lever API      : https://api.lever.co/v0/postings/{token}
 * Ashby API      : https://api.ashbyhq.com/posting-api/job-board/{token}
 */

const COMPANY_REGISTRY: readonly CompanyConfig[] = [
  // ── Greenhouse ──────────────────────────────────────────────────────────
  {
    name: 'Stripe',
    platform: 'stripe',
    boardToken: 'stripe',
    careersUrl: 'https://stripe.com/jobs',
  },
  {
    name: 'Anthropic',
    platform: 'greenhouse',
    boardToken: 'anthropic',
    careersUrl: 'https://job-boards.greenhouse.io/anthropic',
  },
  {
    name: 'Figma',
    platform: 'greenhouse',
    boardToken: 'figma',
    careersUrl: 'https://boards.greenhouse.io/figma',
  },
  {
    name: 'Cloudflare',
    platform: 'cloudflare',
    boardToken: 'cloudflare',
    careersUrl: 'https://www.cloudflare.com/careers/jobs/',
  },
  {
    name: 'Datadog',
    platform: 'greenhouse',
    boardToken: 'datadog',
    careersUrl: 'https://careers.datadoghq.com',
  },
  {
    name: 'Scale AI',
    platform: 'greenhouse',
    boardToken: 'scaleai',
    careersUrl: 'https://job-boards.greenhouse.io/scaleai',
  },
  {
    name: 'Databricks',
    platform: 'greenhouse',
    boardToken: 'databricks',
    careersUrl: 'https://databricks.com/company/careers',
  },
  {
    name: 'Anduril',
    platform: 'greenhouse',
    boardToken: 'andurilindustries',
    careersUrl: 'https://boards.greenhouse.io/andurilindustries',
  },
  {
    name: 'Coinbase',
    platform: 'greenhouse',
    boardToken: 'coinbase',
    careersUrl: 'https://www.coinbase.com/careers',
  },
  {
    name: 'Instacart',
    platform: 'greenhouse',
    boardToken: 'instacart',
    careersUrl: 'https://instacart.careers',
  },
  {
    name: 'Brex',
    platform: 'greenhouse',
    boardToken: 'brex',
    careersUrl: 'https://www.brex.com/careers',
  },
  {
    name: 'Vercel',
    platform: 'greenhouse',
    boardToken: 'vercel',
    careersUrl: 'https://job-boards.greenhouse.io/vercel',
  },
  {
    name: 'Retool',
    platform: 'greenhouse',
    boardToken: 'retool',
    careersUrl: 'https://boards.greenhouse.io/retool',
  },
  {
    name: 'Gusto',
    platform: 'greenhouse',
    boardToken: 'gusto',
    careersUrl: 'https://job-boards.greenhouse.io/gusto',
  },

  // ── Lever ───────────────────────────────────────────────────────────────
  {
    name: 'Spotify',
    platform: 'lever',
    boardToken: 'spotify',
    careersUrl: 'https://jobs.lever.co/spotify',
  },
  {
    name: 'Netflix',
    platform: 'lever',
    boardToken: 'netflix',
    careersUrl: 'https://jobs.lever.co/netflix',
  },
  {
    name: 'Palantir',
    platform: 'lever',
    boardToken: 'palantir',
    careersUrl: 'https://jobs.lever.co/palantir',
  },
  {
    name: 'Plaid',
    platform: 'lever',
    boardToken: 'plaid',
    careersUrl: 'https://jobs.lever.co/plaid',
  },

  // ── Ashby ───────────────────────────────────────────────────────────────
  {
    name: 'Notion',
    platform: 'ashby',
    boardToken: 'notion',
    careersUrl: 'https://jobs.ashbyhq.com/notion',
  },
  {
    name: 'Ramp',
    platform: 'ashby',
    boardToken: 'ramp',
    careersUrl: 'https://jobs.ashbyhq.com/ramp',
  },
  {
    name: 'Linear',
    platform: 'ashby',
    boardToken: 'linear',
    careersUrl: 'https://jobs.ashbyhq.com/linear',
  },
  {
    name: 'Sierra AI',
    platform: 'ashby',
    boardToken: 'sierra',
    careersUrl: 'https://jobs.ashbyhq.com/sierra',
  },
  {
    name: 'OpenAI',
    platform: 'ashby',
    boardToken: 'openai',
    careersUrl: 'https://jobs.ashbyhq.com/openai',
  },

  // ── Other / Custom ─────────────────────────────────────────────────────
  {
    name: 'Rippling',
    platform: 'unknown',
    boardToken: 'rippling',
    careersUrl: 'https://www.rippling.com/careers',
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup indexes (built once at module load)
// ---------------------------------------------------------------------------

/** Case-insensitive map from company name to config. */
const byName = new Map<string, CompanyConfig>(
  COMPANY_REGISTRY.map((c) => [c.name.toLowerCase(), c]),
);

/** Case-insensitive map from board token to config. */
const byToken = new Map<string, CompanyConfig>(
  COMPANY_REGISTRY.map((c) => [c.boardToken.toLowerCase(), c]),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the full company configuration for a given company name.
 *
 * The lookup is case-insensitive and also falls back to matching by
 * board token so callers can pass either `"Stripe"` or `"stripe"`.
 */
export function getCompanyConfig(companyName: string): CompanyConfig | undefined {
  const key = companyName.toLowerCase();
  return byName.get(key) ?? byToken.get(key);
}

/**
 * Detect the ATS platform for a company by name.
 *
 * Returns `'unknown'` when the company is not in the registry.
 */
export function detectPlatform(companyName: string): CareerPlatform {
  return getCompanyConfig(companyName)?.platform ?? 'unknown';
}

/**
 * Return every company configuration in the registry.
 */
export function getAllCompanies(): CompanyConfig[] {
  return [...COMPANY_REGISTRY];
}
