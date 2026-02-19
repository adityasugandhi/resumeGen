import { eq, ilike } from 'drizzle-orm';
import { db } from '../index';
import { companies } from '../schema';
import type { CompanyConfig, CareerPlatform } from '@/lib/careers/types';

function toCompanyConfig(row: typeof companies.$inferSelect): CompanyConfig {
  return {
    name: row.name,
    platform: row.platform,
    boardToken: row.boardToken,
    careersUrl: row.careersUrl,
  };
}

export async function getCompanyConfigFromDb(
  companyName: string
): Promise<CompanyConfig | undefined> {
  const key = companyName.toLowerCase();

  // Try by name first (case-insensitive)
  const byName = await db
    .select()
    .from(companies)
    .where(ilike(companies.name, key))
    .limit(1);

  if (byName.length > 0) return toCompanyConfig(byName[0]);

  // Fallback: try by board token
  const byToken = await db
    .select()
    .from(companies)
    .where(ilike(companies.boardToken, key))
    .limit(1);

  if (byToken.length > 0) return toCompanyConfig(byToken[0]);

  return undefined;
}

export async function detectPlatformFromDb(
  companyName: string
): Promise<CareerPlatform> {
  const config = await getCompanyConfigFromDb(companyName);
  return config?.platform ?? 'unknown';
}

export async function getAllCompaniesFromDb(): Promise<CompanyConfig[]> {
  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.isActive, true));

  return rows.map(toCompanyConfig);
}

export async function createCompany(
  config: CompanyConfig
): Promise<typeof companies.$inferSelect> {
  const [row] = await db
    .insert(companies)
    .values({
      name: config.name,
      platform: config.platform,
      boardToken: config.boardToken,
      careersUrl: config.careersUrl,
    })
    .returning();
  return row;
}

export async function updateCompany(
  name: string,
  updates: Partial<Pick<CompanyConfig, 'platform' | 'boardToken' | 'careersUrl'>> & { isActive?: boolean }
): Promise<typeof companies.$inferSelect | undefined> {
  const [row] = await db
    .update(companies)
    .set({ ...updates, updatedAt: new Date() })
    .where(ilike(companies.name, name))
    .returning();
  return row;
}

export async function deleteCompany(name: string): Promise<boolean> {
  const result = await db
    .delete(companies)
    .where(ilike(companies.name, name))
    .returning();
  return result.length > 0;
}
