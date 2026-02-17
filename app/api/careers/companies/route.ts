import { NextResponse } from 'next/server';
import { getAllCompanies } from '@/lib/careers/company-registry';

export async function GET() {
  const companies = getAllCompanies();
  return NextResponse.json({
    companies: companies.map((c) => ({
      name: c.name,
      platform: c.platform,
      careersUrl: c.careersUrl,
    })),
    totalCount: companies.length,
  });
}
