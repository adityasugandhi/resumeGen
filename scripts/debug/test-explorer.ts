/**
 * Test the CareerExplorerAgent against real companies.
 * Run: npx tsx scripts/debug/test-explorer.ts [company]
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { CareerExplorerAgent } from '../../lib/careers/explorer/career-explorer-agent';

const company = process.argv[2] || 'Apple';

async function main() {
  console.log(`\n=== Testing CareerExplorerAgent: ${company} ===\n`);

  const agent = new CareerExplorerAgent();
  const result = await agent.explore(company, {
    maxPages: 2,
    onEvent: (e) => {
      console.log(`  [event] ${e.type}:`, JSON.stringify(e).slice(0, 200));
    },
  });

  console.log('\n=== RESULT ===');
  console.log(`Company:       ${result.company}`);
  console.log(`Careers URL:   ${result.careersUrl}`);
  console.log(`Platform:      ${result.platform}`);
  console.log(`Board Token:   ${result.boardToken || '(none)'}`);
  console.log(`Pages Explored: ${result.pagesExplored}`);
  console.log(`Jobs Found:    ${result.totalFound}`);
  console.log(`Registered:    ${result.registeredInDb}`);

  if (result.jobs.length > 0) {
    console.log('\nTop jobs:');
    for (const job of result.jobs.slice(0, 10)) {
      console.log(`  - ${job.title} (${job.location}) [${job.team || 'N/A'}]`);
      console.log(`    ${job.url}`);
    }
    if (result.jobs.length > 10) {
      console.log(`  ... and ${result.jobs.length - 10} more`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
