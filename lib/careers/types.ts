/**
 * Shared types for the career page scraping and job board integration API.
 *
 * Supported platforms:
 *  - Greenhouse (boards-api.greenhouse.io)
 *  - Lever (api.lever.co)
 *  - Ashby (api.ashbyhq.com)
 *  - Workday (*.wd1.myworkdayjobs.com)
 */

/** ATS platforms that the career module can interact with. */
export type CareerPlatform = 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'stripe' | 'cloudflare' | 'unknown';

/** Normalised representation of a single job posting regardless of source platform. */
export interface CareerJob {
  id: string;
  title: string;
  location: string;
  team: string;
  url: string;
  company: string;
  platform: CareerPlatform;
  updatedAt: number;
}

/** Parameters accepted by the career search endpoint / utility. */
export interface CareerSearchParams {
  company: string;
  platform?: CareerPlatform;
  query?: string;
  location?: string;
  team?: string;
  teams?: string[];
  officeLocations?: string[];
  remoteLocations?: string[];
  department?: string;
}

/** Result envelope returned after searching a company's job board. */
export interface CareerSearchResult {
  company: string;
  platform: CareerPlatform;
  jobs: CareerJob[];
  totalCount: number;
}

/** Static configuration that maps a company to its ATS board. */
export interface CompanyConfig {
  name: string;
  platform: CareerPlatform;
  boardToken: string;
  careersUrl: string;
}
