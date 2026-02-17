import { NextRequest, NextResponse } from 'next/server';
import { getProfileFromEnv } from '@/lib/careers/auto-apply/applicant-profile';
import { JobApplicationEngine } from '@/lib/careers/auto-apply/engine';

// Rate limit: 1 application per 30 seconds per IP
const applyRateLimit = new Map<string, number>();

function checkApplyRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = applyRateLimit.get(ip);
  if (last && now - last < 30_000) return false;
  applyRateLimit.set(ip, now);
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  if (!checkApplyRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit: 1 application per 30 seconds' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { jobId, company, coverLetter, answers, dryRun } = body;

    if (!jobId || !company) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, company' },
        { status: 400 }
      );
    }

    const profile = getProfileFromEnv();
    const engine = new JobApplicationEngine(profile);
    const result = await engine.apply(jobId, company, {
      coverLetter,
      answers,
      dryRun: dryRun || false,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (error) {
    console.error('[CAREERS API] Apply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
