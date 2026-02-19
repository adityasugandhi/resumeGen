import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { companies } from './schema';
import type { CompanyConfig, CareerPlatform } from '@/lib/careers/types';

const COMPANY_REGISTRY: CompanyConfig[] = [
  // Greenhouse
  { name: 'Stripe', platform: 'stripe', boardToken: 'stripe', careersUrl: 'https://stripe.com/jobs' },
  { name: 'Anthropic', platform: 'greenhouse', boardToken: 'anthropic', careersUrl: 'https://job-boards.greenhouse.io/anthropic' },
  { name: 'Figma', platform: 'greenhouse', boardToken: 'figma', careersUrl: 'https://boards.greenhouse.io/figma' },
  { name: 'Cloudflare', platform: 'cloudflare', boardToken: 'cloudflare', careersUrl: 'https://www.cloudflare.com/careers/jobs/' },
  { name: 'Datadog', platform: 'greenhouse', boardToken: 'datadog', careersUrl: 'https://careers.datadoghq.com' },
  { name: 'Scale AI', platform: 'greenhouse', boardToken: 'scaleai', careersUrl: 'https://job-boards.greenhouse.io/scaleai' },
  { name: 'Databricks', platform: 'greenhouse', boardToken: 'databricks', careersUrl: 'https://databricks.com/company/careers' },
  { name: 'Anduril', platform: 'greenhouse', boardToken: 'andurilindustries', careersUrl: 'https://boards.greenhouse.io/andurilindustries' },
  { name: 'Coinbase', platform: 'greenhouse', boardToken: 'coinbase', careersUrl: 'https://www.coinbase.com/careers' },
  { name: 'Instacart', platform: 'greenhouse', boardToken: 'instacart', careersUrl: 'https://instacart.careers' },
  { name: 'Brex', platform: 'greenhouse', boardToken: 'brex', careersUrl: 'https://www.brex.com/careers' },
  { name: 'Vercel', platform: 'greenhouse', boardToken: 'vercel', careersUrl: 'https://job-boards.greenhouse.io/vercel' },
  { name: 'Retool', platform: 'greenhouse', boardToken: 'retool', careersUrl: 'https://boards.greenhouse.io/retool' },
  { name: 'Gusto', platform: 'greenhouse', boardToken: 'gusto', careersUrl: 'https://job-boards.greenhouse.io/gusto' },
  { name: 'GlossGenius', platform: 'greenhouse', boardToken: 'glossgenius', careersUrl: 'https://job-boards.greenhouse.io/glossgenius' },
  // Lever
  { name: 'Spotify', platform: 'lever', boardToken: 'spotify', careersUrl: 'https://jobs.lever.co/spotify' },
  { name: 'Netflix', platform: 'lever', boardToken: 'netflix', careersUrl: 'https://jobs.lever.co/netflix' },
  { name: 'Palantir', platform: 'lever', boardToken: 'palantir', careersUrl: 'https://jobs.lever.co/palantir' },
  { name: 'Plaid', platform: 'lever', boardToken: 'plaid', careersUrl: 'https://jobs.lever.co/plaid' },
  // Ashby
  { name: 'Notion', platform: 'ashby', boardToken: 'notion', careersUrl: 'https://jobs.ashbyhq.com/notion' },
  { name: 'Ramp', platform: 'ashby', boardToken: 'ramp', careersUrl: 'https://jobs.ashbyhq.com/ramp' },
  { name: 'Linear', platform: 'ashby', boardToken: 'linear', careersUrl: 'https://jobs.ashbyhq.com/linear' },
  { name: 'Sierra AI', platform: 'ashby', boardToken: 'sierra', careersUrl: 'https://jobs.ashbyhq.com/sierra' },
  { name: 'OpenAI', platform: 'ashby', boardToken: 'openai', careersUrl: 'https://jobs.ashbyhq.com/openai' },
  // Other
  { name: 'Rippling', platform: 'unknown', boardToken: 'rippling', careersUrl: 'https://www.rippling.com/careers' },
];

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log(`Seeding ${COMPANY_REGISTRY.length} companies...`);

  for (const company of COMPANY_REGISTRY) {
    await db
      .insert(companies)
      .values({
        name: company.name,
        platform: company.platform as typeof companies.$inferInsert.platform,
        boardToken: company.boardToken,
        careersUrl: company.careersUrl,
      })
      .onConflictDoNothing({ target: companies.name });
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
