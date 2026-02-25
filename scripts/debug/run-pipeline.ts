/**
 * Pipeline: Discover 20 H1B-sponsoring companies → search their job boards for engineering roles.
 * Run: npx tsx scripts/debug/run-pipeline.ts
 */

// Load .env.local (Next.js doesn't do this for standalone scripts)
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { getMarketIntelligence } from '../../lib/goinglobal/h1b-intelligence';
import { getAllCompanies } from '../../lib/careers/company-registry';
import { searchJobs } from '../../lib/careers/career-search';
import { discoverAndRegisterCompanies } from '../../lib/careers/company-discovery';

interface CompanyRoles {
  company: string;
  platform: string;
  totalJobs: number;
  engineeringRoles: { title: string; location: string; team: string; url: string }[];
}

const ENGINEERING_KEYWORDS = [
  'software', 'engineer', 'developer', 'frontend', 'backend',
  'full stack', 'fullstack', 'full-stack', 'devops', 'sre',
  'infrastructure', 'platform', 'data engineer', 'ml engineer',
  'machine learning', 'ai engineer', 'systems engineer', 'cloud',
  'mobile engineer', 'ios', 'android', 'security engineer',
];

async function main() {
  console.log('='.repeat(70));
  console.log('PIPELINE: H1B Sponsor Discovery → Job Board Search');
  console.log('='.repeat(70));

  // --- Step 1: Scan H1B sponsors ---
  console.log('\n[Step 1] Scanning H1B sponsors...\n');

  const queries = [
    { title: 'Software Engineer', location: undefined },
    { title: 'Full Stack Engineer', location: undefined },
    { title: 'Backend Engineer', location: undefined },
  ];

  const h1bResults = await Promise.all(
    queries.map(q => getMarketIntelligence(q.title, q.location).catch(err => {
      console.warn(`  H1B scan failed for "${q.title}":`, (err as Error).message);
      return { topCompanies: [] as { company: string; positions: number; avgWage: number }[], totalPositions: 0, avgWage: 0 };
    }))
  );

  // Deduplicate companies across all queries
  const companyMap = new Map<string, { positions: number; avgWage: number }>();
  for (const result of h1bResults) {
    for (const c of (result.topCompanies || [])) {
      const name = c.company;
      const existing = companyMap.get(name);
      const positions = 'positions' in c ? c.positions : ('count' in c ? c.count : 0);
      if (existing) {
        existing.positions += positions || 0;
      } else {
        companyMap.set(name, { positions: positions || 0, avgWage: c.avgWage || 0 });
      }
    }
  }

  // Sort by positions and take top 30
  const topSponsors = [...companyMap.entries()]
    .sort((a, b) => b[1].positions - a[1].positions)
    .slice(0, 30);

  console.log(`  Found ${companyMap.size} unique sponsors.`);
  if (topSponsors.length > 0) {
    console.log('  Top 10 by positions:');
    for (const [name, data] of topSponsors.slice(0, 10)) {
      console.log(`    ${name}: ${data.positions} positions, $${data.avgWage.toLocaleString()} avg`);
    }
  }

  // --- Step 2: Cross-reference with registry + auto-discover ---
  console.log('\n[Step 2] Cross-referencing with company registry...\n');

  const existingCompanies = await getAllCompanies();
  const existingNames = new Set(existingCompanies.map(c => c.name.toLowerCase()));
  console.log(`  Registry has ${existingCompanies.length} companies`);

  // Auto-discover new companies from H1B results
  const newCompanyNames = topSponsors
    .map(([name]) => name)
    .filter(name => !existingNames.has(name.toLowerCase()));

  let undetectableNames: string[] = [];

  if (newCompanyNames.length > 0) {
    console.log(`  Attempting to discover ${newCompanyNames.length} new companies...`);
    try {
      const discoveries = await discoverAndRegisterCompanies(newCompanyNames);
      const registered = discoveries.filter(d => d.status === 'registered');
      const undetectable = discoveries.filter(d => d.status === 'undetectable');
      undetectableNames = undetectable.map(u => u.company);
      console.log(`  Registered: ${registered.length} new companies`);
      for (const r of registered) {
        console.log(`    + ${r.company} (${r.platform})`);
      }
      if (undetectable.length > 0) {
        console.log(`  Undetectable ATS: ${undetectable.length} (${undetectable.slice(0, 5).map(u => u.company).join(', ')}...)`);
      }
    } catch (err) {
      console.warn(`  Discovery failed:`, (err as Error).message);
    }
  }

  // --- Step 2.5: Explore undetectable companies via browser ---
  if (undetectableNames.length > 0) {
    console.log(`\n[Step 2.5] Exploring ${undetectableNames.length} undetectable companies via browser agent (sequential)...\n`);

    const { CareerExplorerAgent } = await import('../../lib/careers/explorer/career-explorer-agent');
    let browserRegistered = 0;
    const PER_COMPANY_TIMEOUT = 60_000; // 60s per company

    // Run sequentially to avoid CDP connection conflicts with parallel browsers
    for (const name of undetectableNames) {
      console.log(`    Exploring ${name}...`);
      try {
        const result = await Promise.race([
          new CareerExplorerAgent().explore(name, { maxPages: 3 }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 60s')), PER_COMPANY_TIMEOUT)
          ),
        ]);

        if (result.registeredInDb) {
          console.log(`    + ${result.company} (${result.platform}) — ${result.totalFound} jobs found`);
          browserRegistered++;
        } else if (result.jobs.length > 0) {
          console.log(`    ~ ${result.company} — ${result.totalFound} jobs found (not registered)`);
        } else {
          console.log(`    - ${result.company} — no jobs found`);
        }
      } catch (err) {
        console.warn(`    - ${name}: ${(err as Error).message}`);
      }
    }

    console.log(`  Browser-registered: ${browserRegistered} additional companies`);
  }

  // Refresh and take up to 20
  const allCompanies = await getAllCompanies();
  const searchableCompanies = allCompanies.slice(0, 20);

  console.log(`\n  Will search ${searchableCompanies.length} companies:\n`);
  for (const c of searchableCompanies) {
    console.log(`    ${c.name.padEnd(25)} (${c.platform})`);
  }

  // --- Step 3: Search all company job boards in parallel ---
  console.log(`\n[Step 3] Searching ${searchableCompanies.length} job boards in parallel...\n`);

  const searchResults = await Promise.allSettled(
    searchableCompanies.map(async (company): Promise<CompanyRoles> => {
      const result = await searchJobs({ company: company.name });
      const engineeringJobs = result.jobs.filter(job => {
        const title = job.title.toLowerCase();
        const team = (job.team || '').toLowerCase();
        return ENGINEERING_KEYWORDS.some(kw => title.includes(kw) || team.includes(kw));
      });
      return {
        company: company.name,
        platform: result.platform,
        totalJobs: result.totalCount,
        engineeringRoles: engineeringJobs.map(j => ({
          title: j.title, location: j.location, team: j.team, url: j.url,
        })),
      };
    })
  );

  // --- Step 4: Report ---
  console.log('='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));

  let totalEngRoles = 0;
  let totalJobs = 0;
  const successResults: CompanyRoles[] = [];
  const failures: { company: string; error: string }[] = [];

  for (let i = 0; i < searchResults.length; i++) {
    const r = searchResults[i];
    const companyName = searchableCompanies[i].name;
    if (r.status === 'fulfilled') {
      successResults.push(r.value);
      totalEngRoles += r.value.engineeringRoles.length;
      totalJobs += r.value.totalJobs;
    } else {
      failures.push({ company: companyName, error: (r.reason as Error).message });
    }
  }

  successResults.sort((a, b) => b.engineeringRoles.length - a.engineeringRoles.length);

  for (const result of successResults) {
    console.log(`\n${result.company} (${result.platform}) — ${result.engineeringRoles.length} eng roles / ${result.totalJobs} total`);
    console.log('-'.repeat(60));

    if (result.engineeringRoles.length === 0) {
      console.log('  No engineering roles found');
      continue;
    }

    // Group by team
    const byTeam = new Map<string, typeof result.engineeringRoles>();
    for (const role of result.engineeringRoles) {
      const team = role.team || 'General';
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team)!.push(role);
    }

    for (const [team, roles] of byTeam) {
      if (byTeam.size > 1) console.log(`  [${team}]`);
      for (const role of roles.slice(0, 5)) {
        const loc = role.location ? ` (${role.location})` : '';
        console.log(`  - ${role.title}${loc}`);
        console.log(`    ${role.url}`);
      }
      if (roles.length > 5) {
        console.log(`  ... and ${roles.length - 5} more in ${team}`);
      }
    }
  }

  if (failures.length > 0) {
    console.log('\n--- Failed Searches ---');
    for (const f of failures) {
      console.log(`  ${f.company}: ${f.error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${successResults.length} companies searched, ${totalEngRoles} engineering roles found, ${totalJobs} total jobs`);
  console.log(`Failed: ${failures.length} companies`);
  console.log('='.repeat(70));
}

main().catch(console.error);
