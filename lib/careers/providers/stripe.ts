import * as cheerio from 'cheerio';
import { CareerJob } from '@/lib/careers/types';

interface StripeResponse {
  viewContext: {
    query: string;
    pagination: {
      total: number;
      limit: number;
      skip: number;
    };
  };
  html: string;
}

/**
 * Fetch jobs from Stripe's native job search API.
 *
 * Stripe exposes a public JSON endpoint at stripe.com/jobs/search that returns
 * HTML table rows. We parse those with cheerio to extract structured job data.
 */
export async function listStripeNativeJobs(
  query?: string,
  teams?: string[],
  officeLocations?: string[],
  remoteLocations?: string[],
  location?: string,
): Promise<CareerJob[]> {
  const allJobs: CareerJob[] = [];
  let skip = 0;
  const limit = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = buildUrl({ query, teams, officeLocations, remoteLocations, limit, skip });
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ResumeApp/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Stripe jobs API error: ${response.status}`);
    }

    const data: StripeResponse = await response.json();
    const jobs = parseJobsHtml(data.html);
    allJobs.push(...jobs);

    const total = data.viewContext?.pagination?.total ?? 0;
    skip += limit;

    if (skip >= total || jobs.length === 0) break;
  }

  // Client-side location filter for the generic `location` param
  if (location) {
    const loc = location.toLowerCase();
    return allJobs.filter((j) => j.location.toLowerCase().includes(loc));
  }

  return allJobs;
}

function buildUrl(params: {
  query?: string;
  teams?: string[];
  officeLocations?: string[];
  remoteLocations?: string[];
  limit: number;
  skip: number;
}): string {
  const url = new URL('https://stripe.com/jobs/search');
  url.searchParams.set('view_type', 'list');
  url.searchParams.set('limit', String(params.limit));

  if (params.skip > 0) {
    url.searchParams.set('skip', String(params.skip));
  }
  if (params.query) {
    url.searchParams.set('query', params.query);
  }
  for (const team of params.teams ?? []) {
    url.searchParams.append('teams', team);
  }
  for (const office of params.officeLocations ?? []) {
    url.searchParams.append('office_locations', office);
  }
  for (const remote of params.remoteLocations ?? []) {
    url.searchParams.append('remote_locations', remote);
  }

  return url.toString();
}

function parseJobsHtml(html: string): CareerJob[] {
  const $ = cheerio.load(html);
  const jobs: CareerJob[] = [];

  // Stripe renders jobs as table rows with links inside
  $('tr').each((_i, row) => {
    const $row = $(row);
    const $link = $row.find('a').first();

    const title = $link.text().trim();
    const href = $link.attr('href') ?? '';

    if (!title || !href) return;

    // Extract team and location from additional cells/spans
    const cells = $row.find('td');
    const team = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const location = cells.length > 2 ? $(cells[2]).text().trim() : '';

    // Build the full URL and extract an ID from the path
    const fullUrl = href.startsWith('http') ? href : `https://stripe.com${href}`;
    const id = href.split('/').filter(Boolean).pop() || href;

    jobs.push({
      id,
      title,
      location,
      team,
      url: fullUrl,
      company: 'Stripe',
      platform: 'stripe',
      updatedAt: Date.now(),
    });
  });

  return jobs;
}
