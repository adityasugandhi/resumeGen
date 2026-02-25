const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';

export interface FlareSolveResult {
  url: string;
  status: number;
  html: string;
  cookies: { name: string; value: string; domain: string }[];
  userAgent: string;
}

/**
 * Fetch a URL through FlareSolverr, which uses a real browser to solve
 * Cloudflare/Google anti-bot challenges and returns rendered HTML.
 */
export async function flareSolve(url: string, timeoutMs = 60000): Promise<FlareSolveResult> {
  const response = await fetch(FLARESOLVERR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: 'request.get',
      url,
      maxTimeout: timeoutMs,
    }),
  });

  if (!response.ok) {
    throw new Error(`FlareSolverr HTTP error: ${response.status}`);
  }

  const data = await response.json() as {
    status: string;
    message: string;
    solution: {
      url: string;
      status: number;
      response: string;
      cookies: { name: string; value: string; domain: string }[];
      userAgent: string;
    };
  };

  if (data.status !== 'ok') {
    throw new Error(`FlareSolverr error: ${data.message}`);
  }

  return {
    url: data.solution.url,
    status: data.solution.status,
    html: data.solution.response,
    cookies: data.solution.cookies || [],
    userAgent: data.solution.userAgent,
  };
}

/**
 * Check if FlareSolverr is available at the configured URL.
 */
export async function isFlareSolverrAvailable(): Promise<boolean> {
  try {
    const baseUrl = FLARESOLVERR_URL.replace('/v1', '');
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
    const data = await res.json() as { msg?: string };
    return data.msg === 'FlareSolverr is ready!';
  } catch {
    return false;
  }
}

/**
 * Extract all links from HTML that match a given pattern.
 */
export function extractLinksFromHtml(html: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  // Match href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    if (pattern.test(match[1])) {
      matches.push(match[1]);
    }
  }
  return [...new Set(matches)];
}
