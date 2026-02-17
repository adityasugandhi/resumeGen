import { CareerSearchParams, CareerSearchResult, CareerJob } from './types';
import { getCompanyConfig, getAllCompanies } from './company-registry';
import { listGreenhouseJobs } from './providers/greenhouse';
import { listLeverJobs } from './providers/lever';
import { listAshbyJobs } from './providers/ashby';
import { listStripeNativeJobs } from './providers/stripe';
import { listCloudflareJobs } from './providers/cloudflare';

export async function searchJobs(params: CareerSearchParams): Promise<CareerSearchResult> {
  const config = getCompanyConfig(params.company);

  if (!config) {
    return {
      company: params.company,
      platform: 'unknown',
      jobs: [],
      totalCount: 0,
    };
  }

  const platform = params.platform || config.platform;
  let jobs: CareerJob[] = [];

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
      default:
        break;
    }
  } catch (error) {
    console.error(`[CAREERS] Error fetching jobs for ${params.company}:`, error);
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

  return results
    .filter((r): r is PromiseFulfilledResult<CareerSearchResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export { getAllCompanies };
