// lib/careers barrel — re-exports public API from career modules

// Types
export type {
  CareerPlatform,
  CareerJob,
  CareerSearchParams,
  CareerSearchResult,
  CompanyConfig,
} from './types';

// Career Search
export { searchJobs, searchMultipleCompanies } from './career-search';

// Company Registry
export { getCompanyConfig, detectPlatform, getAllCompanies } from './company-registry';
