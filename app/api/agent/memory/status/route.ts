import { NextResponse } from 'next/server';
import { getMemoryStats } from '@/lib/vector-db/career-memory';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const stats = await getMemoryStats();
    return NextResponse.json(stats);
  } catch (error) {
    const err = error as Error;
    console.error('[memory/status] Error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
