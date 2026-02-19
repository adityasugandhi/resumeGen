import type { CareerPlatform, CompanyConfig } from './types';
import {
  getCompanyConfigFromDb,
  detectPlatformFromDb,
  getAllCompaniesFromDb,
} from '@/lib/db/queries/companies';

// ── Static fallback (used when DB is unreachable) ──────────────────────────

const STATIC_REGISTRY: readonly CompanyConfig[] = [
  { name: 'Stripe', platform: 'stripe', boardToken: 'stripe', careersUrl: 'https://stripe.com/jobs' },
  { name: 'Anthropic', platform: 'greenhouse', boardToken: 'anthropic', careersUrl: 'https://job-boards.greenhouse.io/anthropic' },
  { name: 'Figma', platform: 'greenhouse', boardToken: 'figma', careersUrl: 'https://boards.greenhouse.io/figma' },
  { name: 'Cloudflare', platform: 'cloudflare', boardToken: 'cloudflare', careersUrl: 'https://www.cloudflare.com/careers/jobs/' },
  { name: 'Datadog', platform: 'greenhouse', boardToken: 'datadog', careersUrl: 'https://careers.datadoghq.com' },
  { name: 'Scale AI', platform: 'greenhouse', boardToken: 'scaleai', careersUrl: 'https://job-boards.greenhouse.io/scaleai' },
  { name: 'Databricks', platform: 'greenhouse', boardToken: 'databricks', careersUrl: 'https://databricks.com/company/careers' },
  { name: 'Anduril', platform: 'greenhouse', boardToken: 'andurilindustries', careersUrl: 'https://boards.greenhouse.io/andurilindustries' },
  { name: 'Coinbase', platform: 'greenhouse', boardToken: 'coinbase', careersUrl: 'https://www.coinbase.com/careers' },
  { name: 'Instacart', platform: 'greenhouse', boardToken: 'instacart', careersUrl: 'https://instacart.careers' },
  { name: 'Brex', platform: 'greenhouse', boardToken: 'brex', careersUrl: 'https://www.brex.com/careers' },
  { name: 'Vercel', platform: 'greenhouse', boardToken: 'vercel', careersUrl: 'https://job-boards.greenhouse.io/vercel' },
  { name: 'Retool', platform: 'greenhouse', boardToken: 'retool', careersUrl: 'https://boards.greenhouse.io/retool' },
  { name: 'Gusto', platform: 'greenhouse', boardToken: 'gusto', careersUrl: 'https://job-boards.greenhouse.io/gusto' },
  { name: 'GlossGenius', platform: 'greenhouse', boardToken: 'glossgenius', careersUrl: 'https://job-boards.greenhouse.io/glossgenius' },
  { name: 'Spotify', platform: 'lever', boardToken: 'spotify', careersUrl: 'https://jobs.lever.co/spotify' },
  { name: 'Netflix', platform: 'lever', boardToken: 'netflix', careersUrl: 'https://jobs.lever.co/netflix' },
  { name: 'Palantir', platform: 'lever', boardToken: 'palantir', careersUrl: 'https://jobs.lever.co/palantir' },
  { name: 'Plaid', platform: 'lever', boardToken: 'plaid', careersUrl: 'https://jobs.lever.co/plaid' },
  { name: 'Notion', platform: 'ashby', boardToken: 'notion', careersUrl: 'https://jobs.ashbyhq.com/notion' },
  { name: 'Ramp', platform: 'ashby', boardToken: 'ramp', careersUrl: 'https://jobs.ashbyhq.com/ramp' },
  { name: 'Linear', platform: 'ashby', boardToken: 'linear', careersUrl: 'https://jobs.ashbyhq.com/linear' },
  { name: 'Sierra AI', platform: 'ashby', boardToken: 'sierra', careersUrl: 'https://jobs.ashbyhq.com/sierra' },
  { name: 'OpenAI', platform: 'ashby', boardToken: 'openai', careersUrl: 'https://jobs.ashbyhq.com/openai' },
  { name: 'Rippling', platform: 'unknown', boardToken: 'rippling', careersUrl: 'https://www.rippling.com/careers' },
] as const;

const byName = new Map<string, CompanyConfig>(
  STATIC_REGISTRY.map((c) => [c.name.toLowerCase(), c]),
);
const byToken = new Map<string, CompanyConfig>(
  STATIC_REGISTRY.map((c) => [c.boardToken.toLowerCase(), c]),
);

// ── Sync fallbacks (for code paths that can't await) ───────────────────────

function getCompanyConfigSync(companyName: string): CompanyConfig | undefined {
  const key = companyName.toLowerCase();
  return byName.get(key) ?? byToken.get(key);
}

// ── Primary async API (DB-backed) ──────────────────────────────────────────

export async function getCompanyConfig(companyName: string): Promise<CompanyConfig | undefined> {
  try {
    const result = await getCompanyConfigFromDb(companyName);
    if (result) return result;
  } catch {
    // DB unreachable — fall through to static
  }
  return getCompanyConfigSync(companyName);
}

export async function detectPlatform(companyName: string): Promise<CareerPlatform> {
  try {
    return await detectPlatformFromDb(companyName);
  } catch {
    return getCompanyConfigSync(companyName)?.platform ?? 'unknown';
  }
}

export async function getAllCompanies(): Promise<CompanyConfig[]> {
  try {
    const companies = await getAllCompaniesFromDb();
    if (companies.length > 0) return companies;
  } catch {
    // DB unreachable — fall through to static
  }
  return [...STATIC_REGISTRY];
}
