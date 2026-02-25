/**
 * Phase 1 — Discovery Agent
 *
 * Sequential pipeline: memory recall → H1B scan → company discovery → registry listing.
 * Calls imported functions directly (no Claude conversation needed).
 */

import { generateQueryEmbedding } from '@/lib/indexer/index-manager';
import {
  searchPastSearches,
  searchJobMatches,
} from '@/lib/vector-db/career-memory';
import { getMarketIntelligence } from '@/lib/goinglobal/h1b-intelligence';
import { discoverAndRegisterCompanies } from '@/lib/careers/company-discovery';
import { getAllCompanies } from '@/lib/careers/company-registry';
import type { AgentStepEvent } from '../types';
import { companiesMatch, findMatchingCompany } from '@/lib/careers/company-name-utils';
import type { DiscoveryResult, TargetCompany } from './types';

export async function runDiscoveryPhase(
  jobTitle: string,
  location: string | undefined,
  targetCompany: string | undefined,
  onEvent?: (e: AgentStepEvent) => void,
): Promise<DiscoveryResult> {
  // 1. Memory recall
  let pastSearchCount = 0;
  let pastMatchCount = 0;

  try {
    onEvent?.({
      type: 'memory_recall',
      message: `Checking career memory for past "${jobTitle}" searches...`,
    });

    const queryVector = await generateQueryEmbedding(jobTitle);
    const [pastSearches, pastMatches] = await Promise.all([
      searchPastSearches(queryVector, 5),
      searchJobMatches(queryVector, 10),
    ]);

    pastSearchCount = pastSearches.length;
    pastMatchCount = pastMatches.length;

    onEvent?.({
      type: 'memory_recall',
      message: `Found ${pastSearchCount} past searches, ${pastMatchCount} past matches`,
      pastSearches: pastSearchCount,
      insights: pastMatchCount,
    });
  } catch (err) {
    console.warn('[discovery] Memory recall failed (non-fatal):', err);
  }

  // 2. H1B scan
  let h1bData = { totalPositions: 0, topCompanies: [] as Array<{ company: string; count: number; avgWage: number }> };

  try {
    onEvent?.({
      type: 'h1b_scan',
      message: `Scanning H1B sponsors for "${jobTitle}"...`,
      companies: [],
    });

    const result = await getMarketIntelligence(jobTitle, location);
    h1bData = {
      totalPositions: result.totalPositions,
      topCompanies: result.topCompanies,
    };

    onEvent?.({
      type: 'h1b_scan',
      message: `Found ${result.topCompanies.length} H1B sponsors (${result.totalPositions} total positions)`,
      companies: result.topCompanies,
    });
  } catch (err) {
    console.warn('[discovery] H1B scan failed (non-fatal):', err);
    onEvent?.({ type: 'error', message: `H1B scan failed: ${(err as Error).message}` });
  }

  // 3. Auto-discover and register companies from H1B results
  try {
    const companyNames = h1bData.topCompanies.map((c) => c.company);
    if (companyNames.length > 0) {
      const discoveryResults = await discoverAndRegisterCompanies(companyNames);
      const newlyRegistered = discoveryResults.filter((r) => r.status === 'registered');

      if (newlyRegistered.length > 0) {
        onEvent?.({
          type: 'companies_discovered',
          message: `Auto-discovered ${newlyRegistered.length} new companies`,
          companies: newlyRegistered.map((c) => ({
            name: c.company,
            platform: c.platform || 'unknown',
          })),
        });
      }
    }
  } catch (err) {
    console.warn('[discovery] Company discovery failed (non-fatal):', err);
  }

  // 4. List available companies from registry
  let registryCompanies: Array<{ name: string; platform: string }> = [];
  try {
    const allCompanies = await getAllCompanies();
    registryCompanies = allCompanies.map((c) => ({ name: c.name, platform: c.platform }));

    onEvent?.({
      type: 'registry_match',
      message: `${registryCompanies.length} companies in search registry`,
      matchedCompanies: registryCompanies.map((c) => c.name),
    });
  } catch (err) {
    console.warn('[discovery] Registry listing failed:', err);
  }

  // 5. Build target company list by cross-referencing H1B data with registry
  const registryNames = registryCompanies.map((c) => c.name);

  let companies: TargetCompany[];

  if (targetCompany) {
    // Single company mode — find it in registry using fuzzy match
    const matchedName = findMatchingCompany(targetCompany, registryNames);
    const companyConfig = matchedName
      ? registryCompanies.find((c) => c.name === matchedName)
      : undefined;
    const h1bInfo = h1bData.topCompanies.find((c) =>
      companiesMatch(c.company, targetCompany)
    );

    companies = companyConfig
      ? [{
          name: companyConfig.name,
          platform: companyConfig.platform,
          h1bPositions: h1bInfo?.count ?? 0,
          h1bAvgWage: h1bInfo?.avgWage ?? 0,
        }]
      : [];
  } else {
    // Multi-company mode — H1B companies that fuzzy-match the registry, sorted by H1B count
    companies = h1bData.topCompanies
      .map((c) => {
        const matchedName = findMatchingCompany(c.company, registryNames);
        if (!matchedName) return null;
        const regEntry = registryCompanies.find((r) => r.name === matchedName);
        return {
          name: regEntry?.name || c.company,
          platform: regEntry?.platform || 'unknown',
          h1bPositions: c.count,
          h1bAvgWage: c.avgWage,
        };
      })
      .filter((c): c is TargetCompany => c !== null)
      .sort((a, b) => b.h1bPositions - a.h1bPositions);

    // Fallback: if no H1B companies matched the registry, search all registry companies
    if (companies.length === 0 && registryCompanies.length > 0) {
      onEvent?.({
        type: 'error',
        message: `No H1B sponsors matched the registry — falling back to all ${registryCompanies.length} registry companies`,
      });

      companies = registryCompanies
        .filter((c) => c.platform !== 'unknown')
        .map((c) => {
          const h1bInfo = h1bData.topCompanies.find((h) =>
            companiesMatch(h.company, c.name)
          );
          return {
            name: c.name,
            platform: c.platform,
            h1bPositions: h1bInfo?.count ?? 0,
            h1bAvgWage: h1bInfo?.avgWage ?? 0,
          };
        });
    }
  }

  return {
    companies,
    h1bData,
    memoryInsights: {
      pastSearches: pastSearchCount,
      pastMatches: pastMatchCount,
    },
  };
}
