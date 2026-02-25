import { NextRequest, NextResponse } from 'next/server';
import { resolveIntervention } from '../intervention-store';
import type { InterventionAction } from '@/lib/ai/agent/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { streamId: string; action: InterventionAction; prompt?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.streamId || !body.action) {
    return NextResponse.json(
      { error: 'Missing required fields: streamId and action' },
      { status: 400 }
    );
  }

  const resolved = resolveIntervention(body.streamId, {
    action: body.action,
    prompt: body.prompt,
  });

  if (!resolved) {
    return NextResponse.json(
      { error: 'No pending intervention found for this stream ID' },
      { status: 404 }
    );
  }

  return NextResponse.json({ resolved: true });
}