import { NextRequest, NextResponse } from 'next/server';
import { searchJobs, searchMultipleCompanies } from '@/lib/careers/career-search';

// In-memory rate limiter (same pattern as lib/goinglobal/rate-limiter.ts)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const MAX_REQUESTS = 20;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_REQUESTS;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const company = searchParams.get('company');
  const companies = searchParams.get('companies');
  const query = searchParams.get('query') || undefined;
  const location = searchParams.get('location') || undefined;
  const team = searchParams.get('team') || undefined;
  const teams = searchParams.get('teams')?.split(',').map((t) => t.trim()).filter(Boolean);
  const officeLocations = searchParams.get('officeLocations')?.split(',').map((l) => l.trim()).filter(Boolean);
  const remoteLocations = searchParams.get('remoteLocations')?.split(',').map((l) => l.trim()).filter(Boolean);
  const department = searchParams.get('department') || undefined;

  try {
    if (companies) {
      // Multi-company search: ?companies=stripe,anthropic,figma
      const companyList = companies.split(',').map((c) => c.trim()).filter(Boolean);
      if (companyList.length === 0) {
        return NextResponse.json({ error: 'No companies specified' }, { status: 400 });
      }
      if (companyList.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 companies per request' }, { status: 400 });
      }
      const results = await searchMultipleCompanies(companyList, query, location);
      return NextResponse.json({ results, totalCompanies: results.length });
    }

    if (!company) {
      return NextResponse.json(
        { error: 'Missing required parameter: company or companies' },
        { status: 400 }
      );
    }

    const result = await searchJobs({ company, query, location, team, teams, officeLocations, remoteLocations, department });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CAREERS API] Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
