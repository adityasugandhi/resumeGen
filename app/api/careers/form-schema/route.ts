import { NextRequest, NextResponse } from 'next/server';
import { getProfileFromEnv } from '@/lib/careers/auto-apply/applicant-profile';
import { JobApplicationEngine } from '@/lib/careers/auto-apply/engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const company = searchParams.get('company');

  if (!jobId || !company) {
    return NextResponse.json(
      { error: 'Missing required parameters: jobId, company' },
      { status: 400 }
    );
  }

  try {
    const profile = getProfileFromEnv();
    const engine = new JobApplicationEngine(profile);
    const schema = await engine.getFormSchema(jobId, company);

    return NextResponse.json(schema);
  } catch (error) {
    console.error('[CAREERS API] Form schema error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
