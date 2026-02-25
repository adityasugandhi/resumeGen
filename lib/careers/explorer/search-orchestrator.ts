/**
 * Multi-engine career URL search orchestrator.
 *
 * Priority chain:
 *  1. URL pattern probing (free, instant, no API)
 *  2. Brave Search API (programmatic, 2000 req/mo free)
 *  3. Perplexity Sonar API (AI-synthesized search)
 *  4. FlareSolverr Google (heaviest, handles anti-bot)
 */

import { flareSolve, isFlareSolverrAvailable, extractLinksFromHtml } from './flaresolverr-client';
import { rateLimited } from '@/lib/rate-limiter';
import { getCompanyConfig } from '@/lib/careers/company-registry';

// ---------- in-memory TTL cache ----------

interface CacheEntry {
  result: CareersUrlResult;
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function clearUrlCache(): void {
  urlCache.clear();
}

export interface CareersUrlResult {
  url: string;
  source: 'url_probe' | 'brave' | 'perplexity' | 'flaresolverr' | 'none';
  confidence: 'high' | 'medium' | 'low';
}

// ---------- slug helpers ----------

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slugifyDash(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

/** Short brand slug for companies with long names (e.g. "Ernst & Young" → "ey") */
function brandSlug(name: string): string | null {
  const map: Record<string, string> = {
    'ernst & young': 'ey',
    'ernst and young': 'ey',
    'tata consultancy services': 'tcs',
    'international business machines': 'ibm',
    'hewlett packard enterprise': 'hpe',
    'hewlett-packard': 'hp',
    'jpmorgan chase': 'jpmorganchase',
    'jp morgan': 'jpmorganchase',
    'bank of america': 'bankofamerica',
    'general electric': 'ge',
    'general motors': 'gm',
    'johnson & johnson': 'jnj',
    'procter & gamble': 'pg',
    'goldman sachs': 'goldmansachs',
    'morgan stanley': 'morganstanley',
    'pure storage': 'purestorage',
    'hims & hers': 'forhims',
    'hims and hers': 'forhims',
  };
  return map[name.toLowerCase()] ?? null;
}

// ---------- validation ----------

const CAREER_URL_SIGNALS = [
  'career', 'careers', 'jobs', 'openings', 'positions',
  'greenhouse', 'lever', 'ashby', 'workday', 'icims',
  'taleo', 'smartrecruiters', 'jobvite',
];

async function validateCareersUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!res.ok) return false;

    const finalUrl = res.url.toLowerCase();
    // Check URL itself for career signals
    if (CAREER_URL_SIGNALS.some(s => finalUrl.includes(s))) return true;

    // Check first 5KB of body for signals
    const text = await res.text();
    const snippet = text.slice(0, 5000).toLowerCase();
    return CAREER_URL_SIGNALS.some(s => snippet.includes(s));
  } catch {
    return false;
  }
}

// ---------- ATS board validation ----------

/** Check if a URL is a known ATS board that returns 200 for any slug */
function isAtsBoardUrl(url: string): boolean {
  return /(?:boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)\//.test(url);
}

/** Validate an ATS board URL actually has job listings (not just a generic 200) */
async function validateAtsBoard(url: string): Promise<boolean> {
  try {
    // Greenhouse: check their API endpoint
    const ghMatch = url.match(/boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/);
    if (ghMatch) {
      const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${ghMatch[1]}/jobs?content=false`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const data = await res.json() as { jobs?: unknown[] };
      return Array.isArray(data.jobs) && data.jobs.length > 0;
    }

    // Lever: check their API
    const leverMatch = url.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/);
    if (leverMatch) {
      const apiUrl = `https://api.lever.co/v0/postings/${leverMatch[1]}?limit=1`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const data = await res.json() as unknown[];
      return Array.isArray(data) && data.length > 0;
    }

    // Ashby: check their API
    const ashbyMatch = url.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/);
    if (ashbyMatch) {
      const res = await fetch('https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationName: 'ApiJobBoardWithTeams',
          variables: { organizationHostedJobsPageName: ashbyMatch[1] },
          query: 'query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { jobs { id } } } }',
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;
      const data = await res.json() as { data?: { jobBoard?: { teams?: { jobs?: unknown[] }[] } } };
      const teams = data.data?.jobBoard?.teams ?? [];
      return teams.some(t => (t.jobs?.length ?? 0) > 0);
    }

    return false;
  } catch {
    return false;
  }
}

// ---------- 1. URL pattern probing ----------

async function probeUrlPatterns(companyName: string): Promise<string | null> {
  const slug = slugify(companyName);
  const dash = slugifyDash(companyName);
  const brand = brandSlug(companyName);

  const allSlugs = [slug, dash, ...(brand ? [brand] : [])];

  // Build candidate URLs — deduplicated
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const s of allSlugs) {
    const urls = [
      `https://jobs.${s}.com`,
      `https://careers.${s}.com`,
      `https://www.${s}.com/careers`,
      `https://${s}.com/careers`,
      `https://www.${s}.com/jobs`,
      `https://${s}.com/jobs`,
      `https://www.${s}.com/en/careers`,
      `https://boards.greenhouse.io/${s}`,
      `https://jobs.lever.co/${s}`,
      `https://jobs.ashbyhq.com/${s}`,
    ];
    for (const u of urls) {
      if (!seen.has(u)) { seen.add(u); candidates.push(u); }
    }
  }

  // Fire HEAD requests in parallel batches of 6 for speed
  const BATCH = 6;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async url => {
        // ATS boards (Ashby, Lever, Greenhouse) return 200 for ANY slug.
        // We must validate them with their API instead of trusting HEAD.
        if (isAtsBoardUrl(url)) {
          const valid = await validateAtsBoard(url);
          if (valid) return url;
          throw new Error('invalid ats board');
        }

        const res = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return res.url; // follow redirects
        throw new Error('not ok');
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') return r.value;
    }
  }

  return null;
}

// ---------- 2. Brave Search API ----------

async function searchBrave(companyName: string): Promise<string | null> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return null;

  const slug = slugify(companyName);
  const brand = brandSlug(companyName) ?? slug;
  const query = `"${companyName}" careers jobs site:${brand}.com OR site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:myworkdayjobs.com`;

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
    const res = await rateLimited('brave', () =>
      fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(10000),
      })
    );

    if (!res.ok) {
      console.warn(`[search-orchestrator] Brave returned ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      web?: { results?: { url: string; title: string; description: string }[] };
    };

    const results = data.web?.results ?? [];
    const lowerCompany = companyName.toLowerCase();
    const lowerBrand = brand.toLowerCase();

    // Score results
    for (const r of results) {
      const u = r.url.toLowerCase();
      const isCareer = CAREER_URL_SIGNALS.some(s => u.includes(s));
      const isCompany = u.includes(lowerCompany.replace(/\s+/g, '')) || u.includes(lowerBrand);
      if (isCareer && isCompany) return r.url;
    }

    // Second pass: any career-related URL
    for (const r of results) {
      const u = r.url.toLowerCase();
      if (CAREER_URL_SIGNALS.some(s => u.includes(s))) return r.url;
    }

    return null;
  } catch (err) {
    console.warn(`[search-orchestrator] Brave search failed:`, (err as Error).message);
    return null;
  }
}

// ---------- 3. Perplexity Sonar ----------

async function searchPerplexity(companyName: string): Promise<string | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await rateLimited('perplexity', () =>
      fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant. Return ONLY the URL, nothing else. No markdown, no explanation.',
            },
            {
              role: 'user',
              content: `What is the exact careers/jobs page URL for ${companyName}? I need the page where they list open software engineering positions. Return only the URL.`,
            },
          ],
          max_tokens: 200,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(15000),
      })
    );

    if (!res.ok) {
      console.warn(`[search-orchestrator] Perplexity returned ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    // Extract URL from response
    const urlMatch = content.match(/https?:\/\/[^\s"<>]+/);
    if (!urlMatch) return null;

    const candidateUrl = urlMatch[0].replace(/[.)]+$/, ''); // strip trailing punctuation
    // Validate the returned URL actually works
    const valid = await validateCareersUrl(candidateUrl);
    return valid ? candidateUrl : null;
  } catch (err) {
    console.warn(`[search-orchestrator] Perplexity search failed:`, (err as Error).message);
    return null;
  }
}

// ---------- 4. FlareSolverr Google ----------

async function searchFlareSolverr(companyName: string): Promise<string | null> {
  const available = await isFlareSolverrAvailable();
  if (!available) return null;

  const slug = slugify(companyName);
  const brand = brandSlug(companyName) ?? slug;

  try {
    const searchQuery = encodeURIComponent(
      `${companyName} careers software engineer jobs site:${brand}.com OR site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:myworkdayjobs.com`
    );
    const result = await flareSolve(`https://www.google.com/search?q=${searchQuery}`, 30000);

    const careersPatterns = [
      /careers/i, /jobs/i, /greenhouse\.io/i, /lever\.co/i,
      /ashbyhq\.com/i, /myworkdayjobs\.com/i, /icims\.com/i,
    ];

    const links = extractLinksFromHtml(result.html, /https?:\/\//);

    // Score links
    for (const link of links) {
      if (link.includes('google.com') || link.includes('gstatic.com')) continue;
      const isCareerLink = careersPatterns.some(p => p.test(link));
      const isCompanyLink = link.toLowerCase().includes(brand);
      if (isCareerLink && isCompanyLink) return link;
      if (isCareerLink) return link;
    }

    // Fallback: first company-related link
    return links.find(l =>
      !l.includes('google.com') && !l.includes('gstatic.com') &&
      l.toLowerCase().includes(brand)
    ) ?? null;
  } catch (err) {
    console.warn(`[search-orchestrator] FlareSolverr search failed:`, (err as Error).message);
    return null;
  }
}

// ---------- main orchestrator ----------

export async function findCareersUrl(companyName: string): Promise<CareersUrlResult> {
  const none: CareersUrlResult = { url: '', source: 'none', confidence: 'low' };
  const cacheKey = companyName.toLowerCase().trim();

  // 0a. Check in-memory cache
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[search-orchestrator] Cache hit for "${companyName}": ${cached.result.url}`);
    return cached.result;
  }

  // 0b. Check company registry — skip all probing for known companies
  const registryConfig = await getCompanyConfig(companyName);
  if (registryConfig && registryConfig.careersUrl) {
    const result: CareersUrlResult = {
      url: registryConfig.careersUrl,
      source: 'url_probe',
      confidence: 'high',
    };
    urlCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[search-orchestrator] Registry hit for "${companyName}": ${result.url}`);
    return result;
  }

  // 1. URL probing — fastest
  console.log(`[search-orchestrator] Probing URL patterns for "${companyName}"…`);
  const probed = await probeUrlPatterns(companyName);
  if (probed) {
    const result: CareersUrlResult = { url: probed, source: 'url_probe', confidence: 'high' };
    urlCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[search-orchestrator] ✓ Found via URL probe: ${probed}`);
    return result;
  }

  // 2. Brave Search — fast, programmatic
  console.log(`[search-orchestrator] Trying Brave Search…`);
  const braved = await searchBrave(companyName);
  if (braved) {
    const result: CareersUrlResult = { url: braved, source: 'brave', confidence: 'high' };
    urlCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[search-orchestrator] ✓ Found via Brave: ${braved}`);
    return result;
  }

  // 3. Perplexity — AI-synthesized
  console.log(`[search-orchestrator] Trying Perplexity Sonar…`);
  const perplexed = await searchPerplexity(companyName);
  if (perplexed) {
    const result: CareersUrlResult = { url: perplexed, source: 'perplexity', confidence: 'medium' };
    urlCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[search-orchestrator] ✓ Found via Perplexity: ${perplexed}`);
    return result;
  }

  // 4. FlareSolverr — heaviest
  console.log(`[search-orchestrator] Trying FlareSolverr Google search…`);
  const flared = await searchFlareSolverr(companyName);
  if (flared) {
    const result: CareersUrlResult = { url: flared, source: 'flaresolverr', confidence: 'medium' };
    urlCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[search-orchestrator] ✓ Found via FlareSolverr: ${flared}`);
    return result;
  }

  console.log(`[search-orchestrator] ✗ No careers URL found for "${companyName}"`);
  return none;
}
