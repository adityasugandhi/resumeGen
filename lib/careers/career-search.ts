import { CareerSearchParams, CareerSearchResult, CareerJob } from './types';
import { getCompanyConfig, getAllCompanies } from './company-registry';
import { listGreenhouseJobs } from './providers/greenhouse';
import { listLeverJobs } from './providers/lever';
import { listAshbyJobs } from './providers/ashby';
import { listStripeNativeJobs } from './providers/stripe';
import { listCloudflareJobs } from './providers/cloudflare';

export async function searchJobs(params: CareerSearchParams): Promise<CareerSearchResult> {
  const config = await getCompanyConfig(params.company);

  if (!config) {
    return {
      company: params.company,
      platform: 'unknown',
      jobs: [],
      totalCount: 0,
      error: `Company "${params.company}" not in registry. Use register_company to add it.`,
    };
  }

  const platform = params.platform || config.platform;
  let jobs: CareerJob[] = [];
  let error: string | undefined;

  try {
    switch (platform) {
      case 'greenhouse':
        jobs = await listGreenhouseJobs(config.boardToken, config.name, params.query, params.location);
        break;
      case 'lever':
        jobs = await listLeverJobs(config.boardToken, params.query, params.location);
        break;
      case 'ashby':
        jobs = await listAshbyJobs(config.boardToken, config.name, params.query, params.location);
        break;
      case 'stripe':
        jobs = await listStripeNativeJobs(
          params.query,
          params.teams,
          params.officeLocations,
          params.remoteLocations,
          params.location,
        );
        break;
      case 'cloudflare':
        jobs = await listCloudflareJobs(params.query, params.location, params.department);
        break;
      case 'custom':
      case 'workday':
      case 'icims': {
        const BROWSER_TIMEOUT = 120_000; // 2 minutes
        const { CareerExplorerAgent } = await import('./explorer/career-explorer-agent');
        const explorer = new CareerExplorerAgent();
        const result = await Promise.race([
          explorer.explore(params.company, {
            maxPages: 5,
            careersUrl: config.careersUrl,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Browser exploration timed out after 2m')), BROWSER_TIMEOUT)
          ),
        ]);
        jobs = result.jobs;
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CAREERS] Error fetching jobs for ${params.company}:`, message);
    error = `Failed to fetch jobs: ${message}`;
  }

  // Filter by team if specified
  if (params.team) {
    const team = params.team.toLowerCase();
    jobs = jobs.filter((j) => j.team.toLowerCase().includes(team));
  }

  return {
    company: config.name,
    platform,
    jobs,
    totalCount: jobs.length,
    ...(error && { error }),
  };
}

export async function searchMultipleCompanies(
  companies: string[],
  query?: string,
  location?: string
): Promise<CareerSearchResult[]> {
  const results = await Promise.allSettled(
    companies.map((company) =>
      searchJobs({ company, query, location })
    )
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      company: companies[i],
      platform: 'unknown' as const,
      jobs: [],
      totalCount: 0,
      error: `Search failed: ${(r.reason as Error).message}`,
    };
  });
}

export { getAllCompanies };
