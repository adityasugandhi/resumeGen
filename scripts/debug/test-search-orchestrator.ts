/**
 * Test script for the search orchestrator against previously failing companies.
 *
 * Usage: npx tsx scripts/debug/test-search-orchestrator.ts
 */

import fs from 'fs';
import path from 'path';

// Load .env.local manually (no dotenv dependency)
const envPath = path.resolve(__dirname, '..', '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

import { findCareersUrl, type CareersUrlResult } from '../../lib/careers/explorer/search-orchestrator';

interface TestCase {
  name: string;
  expectedPattern: RegExp;
}

const companies: TestCase[] = [
  { name: 'Ernst & Young', expectedPattern: /ey\.com|eyglobal/i },
  { name: 'Tata Consultancy Services', expectedPattern: /tcs\.com|tata/i },
  { name: 'Apple', expectedPattern: /apple\.com/i },
  { name: 'Ford', expectedPattern: /ford\.com/i },
  { name: 'Goldman Sachs', expectedPattern: /goldmansachs\.com/i },
];

interface TestResult {
  company: string;
  result: CareersUrlResult;
  matchesExpected: boolean;
  durationMs: number;
}

async function main() {
  console.log('='.repeat(70));
  console.log('  Search Orchestrator Test — Previously Failing Companies');
  console.log('='.repeat(70));
  console.log();

  // Verify API keys
  const braveKey = process.env.BRAVE_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  console.log(`BRAVE_API_KEY:      ${braveKey ? 'set (' + braveKey.slice(0, 6) + '...)' : 'MISSING'}`);
  console.log(`PERPLEXITY_API_KEY: ${perplexityKey ? 'set (' + perplexityKey.slice(0, 6) + '...)' : 'MISSING'}`);
  console.log();

  const results: TestResult[] = [];

  for (const tc of companies) {
    console.log('-'.repeat(70));
    console.log(`Testing: ${tc.name}`);
    console.log('-'.repeat(70));

    const start = Date.now();
    const result = await findCareersUrl(tc.name);
    const durationMs = Date.now() - start;

    const matchesExpected = result.url !== '' && tc.expectedPattern.test(result.url);

    results.push({ company: tc.name, result, matchesExpected, durationMs });

    console.log(`  URL:        ${result.url || '(none)'}`);
    console.log(`  Source:     ${result.source}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Duration:   ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`  Expected:   ${matchesExpected ? 'PASS' : 'FAIL'} (pattern: ${tc.expectedPattern})`);
    console.log();
  }

  // Summary
  console.log('='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log();

  const passed = results.filter(r => r.matchesExpected).length;
  const failed = results.filter(r => !r.matchesExpected).length;
  const totalTime = results.reduce((s, r) => s + r.durationMs, 0);

  for (const r of results) {
    const status = r.matchesExpected ? 'PASS' : 'FAIL';
    const icon = r.matchesExpected ? '[+]' : '[-]';
    console.log(
      `  ${icon} ${status}  ${r.company.padEnd(30)} ${(r.result.url || '(none)').padEnd(50)} ${r.result.source.padEnd(14)} ${(r.durationMs / 1000).toFixed(1)}s`
    );
  }

  console.log();
  console.log(`  Total: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
