import { detectATS, parseAtsUrl } from './ats-detector';
import { getCompanyConfig } from './company-registry';
import { createCompany, updateCompany } from '@/lib/db/queries/companies';
import type { CareerPlatform } from './types';

export type DiscoveryStatus = 'existing' | 'registered' | 'undetectable';

export interface DiscoveryResult {
  company: string;
  status: DiscoveryStatus;
  platform?: CareerPlatform;
  boardToken?: string;
  jobs?: import('./types').CareerJob[];
}

/**
 * Batch-discover and register companies from H1B results.
 * Processes in batches of 5 to avoid rate limiting on ATS API probes.
 */
export async function discoverAndRegisterCompanies(
  companyNames: string[]
): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < companyNames.length; i += BATCH_SIZE) {
    const batch = companyNames.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(discoverSingle));
    results.push(...batchResults);
  }

  return results;
}

async function discoverSingle(companyName: string): Promise<DiscoveryResult> {
  // 1. Check if already in registry
  try {
    const existing = await getCompanyConfig(companyName);
    if (existing) {
      return { company: companyName, status: 'existing', platform: existing.platform, boardToken: existing.boardToken };
    }
  } catch {
    // DB might be down, continue with detection anyway
  }

  // 2. Auto-detect ATS platform
  const detection = await detectATS(companyName);

  if (detection) {
    // 3. Register in DB as active
    try {
      await createCompany({
        name: companyName,
        platform: detection.platform,
        boardToken: detection.boardToken,
        careersUrl: detection.careersUrl,
      });
    } catch (err) {
      // Might be a duplicate — try update instead
      console.warn(`[discovery] createCompany failed for ${companyName}, trying update:`, err);
      try {
        await updateCompany(companyName, {
          platform: detection.platform,
          boardToken: detection.boardToken,
          careersUrl: detection.careersUrl,
          isActive: true,
        });
      } catch {
        // Best effort
      }
    }
    return {
      company: companyName,
      status: 'registered',
      platform: detection.platform,
      boardToken: detection.boardToken,
    };
  }

  // 3. Browser-based exploration fallback
  try {
    const { CareerExplorerAgent } = await import('./explorer/career-explorer-agent');
    const explorer = new CareerExplorerAgent();
    const result = await explorer.explore(companyName, { maxPages: 3 });

    if (result.registeredInDb || result.jobs.length > 0) {
      return {
        company: companyName,
        status: 'registered',
        platform: result.platform,
        boardToken: result.boardToken,
        jobs: result.jobs,
      };
    }
  } catch (browserErr) {
    console.warn(`[discovery] Browser exploration failed for ${companyName}:`, (browserErr as Error).message);
  }

  // 4. Undetectable — store as inactive with unknown platform
  try {
    await createCompany({
      name: companyName,
      platform: 'unknown',
      boardToken: companyName.toLowerCase().replace(/\s+/g, ''),
      careersUrl: '',
    });
    // Mark inactive since we can't search it
    await updateCompany(companyName, { isActive: false });
  } catch {
    // Best effort — might already exist
  }

  return { company: companyName, status: 'undetectable' };
}

/**
 * Register a company from a known careers URL (agent fallback).
 * Parses the URL to extract platform/token, then creates or updates the DB record.
 */
export async function registerCompanyFromUrl(
  name: string,
  careersUrl: string
): Promise<DiscoveryResult> {
  const parsed = parseAtsUrl(careersUrl);

  if (!parsed) {
    return { company: name, status: 'undetectable' };
  }

  try {
    // Try create first
    await createCompany({
      name,
      platform: parsed.platform,
      boardToken: parsed.boardToken,
      careersUrl: parsed.careersUrl,
    });
  } catch {
    // Update if already exists
    try {
      await updateCompany(name, {
        platform: parsed.platform,
        boardToken: parsed.boardToken,
        careersUrl: parsed.careersUrl,
        isActive: true,
      });
    } catch {
      // Best effort
    }
  }

  return {
    company: name,
    status: 'registered',
    platform: parsed.platform,
    boardToken: parsed.boardToken,
  };
}
