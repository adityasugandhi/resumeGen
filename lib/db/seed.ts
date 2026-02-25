import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { companies } from './schema';
import { STATIC_REGISTRY } from '@/lib/careers/company-registry';

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log(`Seeding ${STATIC_REGISTRY.length} companies...`);

  for (const company of STATIC_REGISTRY) {
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
