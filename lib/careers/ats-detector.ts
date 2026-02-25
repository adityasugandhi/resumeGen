import type { CareerPlatform } from './types';

export interface AtsDetectionResult {
  platform: CareerPlatform;
  boardToken: string;
  careersUrl: string;
}

/**
 * Generate board-token candidates from a company name.
 * e.g. "Scale AI" → ["scaleai", "scale-ai", "scale_ai", "scale"]
 */
function generateTokenCandidates(companyName: string): string[] {
  const words = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  const candidates = new Set<string>();
  candidates.add(words.join(''));       // scaleai
  candidates.add(words.join('-'));      // scale-ai
  candidates.add(words.join('_'));      // scale_ai
  if (words.length > 1) {
    candidates.add(words[0]);           // scale (first word only)
  }

  return [...candidates];
}

/**
 * Probe a single URL and return true if the response indicates a valid board.
 */
async function probeUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return false;
    const text = await res.text();
    // A valid board returns non-empty JSON (Greenhouse/Lever return arrays, Ashby returns an object)
    return text.length > 2 && (text.startsWith('[') || text.startsWith('{'));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

interface PlatformProbe {
  platform: CareerPlatform;
  urlTemplate: (token: string) => string;
  careersUrlTemplate: (token: string) => string;
}

const PLATFORM_PROBES: PlatformProbe[] = [
  {
    platform: 'greenhouse',
    urlTemplate: (t) => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`,
    careersUrlTemplate: (t) => `https://boards.greenhouse.io/${t}`,
  },
  {
    platform: 'lever',
    urlTemplate: (t) => `https://api.lever.co/v0/postings/${t}`,
    careersUrlTemplate: (t) => `https://jobs.lever.co/${t}`,
  },
  {
    platform: 'ashby',
    urlTemplate: (t) => `https://api.ashbyhq.com/posting-api/job-board/${t}`,
    careersUrlTemplate: (t) => `https://jobs.ashbyhq.com/${t}`,
  },
];

/**
 * Auto-detect which ATS platform a company uses by probing known API endpoints.
 * Returns the first match or null if no supported ATS is found.
 */
export async function detectATS(companyName: string): Promise<AtsDetectionResult | null> {
  const tokens = generateTokenCandidates(companyName);
  if (tokens.length === 0) return null;

  // For each token, probe all platforms in parallel
  for (const token of tokens) {
    const results = await Promise.all(
      PLATFORM_PROBES.map(async (probe) => {
        const url = probe.urlTemplate(token);
        const found = await probeUrl(url);
        return found ? { platform: probe.platform, token, probe } : null;
      })
    );

    const match = results.find((r) => r !== null);
    if (match) {
      return {
        platform: match.platform,
        boardToken: match.token,
        careersUrl: match.probe.careersUrlTemplate(match.token),
      };
    }
  }

  return null;
}

/**
 * Parse a known careers URL to extract platform and board token.
 * e.g. "https://boards.greenhouse.io/acme" → { platform: 'greenhouse', boardToken: 'acme', careersUrl: '...' }
 */
export function parseAtsUrl(url: string): AtsDetectionResult | null {
  const patterns: { regex: RegExp; platform: CareerPlatform; careersUrl: (token: string) => string }[] = [
    {
      regex: /boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?([a-zA-Z0-9_-]+)/,
      platform: 'greenhouse',
      careersUrl: (t) => `https://boards.greenhouse.io/${t}`,
    },
    {
      regex: /job-boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/,
      platform: 'greenhouse',
      careersUrl: (t) => `https://boards.greenhouse.io/${t}`,
    },
    {
      regex: /jobs\.lever\.co\/([a-zA-Z0-9_-]+)/,
      platform: 'lever',
      careersUrl: (t) => `https://jobs.lever.co/${t}`,
    },
    {
      regex: /api\.lever\.co\/v0\/postings\/([a-zA-Z0-9_-]+)/,
      platform: 'lever',
      careersUrl: (t) => `https://jobs.lever.co/${t}`,
    },
    {
      regex: /jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/,
      platform: 'ashby',
      careersUrl: (t) => `https://jobs.ashbyhq.com/${t}`,
    },
    {
      regex: /api\.ashbyhq\.com\/posting-api\/job-board\/([a-zA-Z0-9_-]+)/,
      platform: 'ashby',
      careersUrl: (t) => `https://jobs.ashbyhq.com/${t}`,
    },
  ];

  for (const { regex, platform, careersUrl } of patterns) {
    const match = url.match(regex);
    if (match) {
      const token = match[1];
      return { platform, boardToken: token, careersUrl: careersUrl(token) };
    }
  }

  return null;
}
