import { NextRequest, NextResponse } from 'next/server';
import { runJobSearchAgent } from '@/lib/ai/agent/job-search-agent';
import type { AgentSearchRequest, AgentStepEvent } from '@/lib/ai/agent/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 5;

  const requests = rateLimitMap.get(ip) || [];
  const recentRequests = requests.filter((t) => now - t < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Maximum 5 requests per minute.' }, { status: 429 });
  }

  let body: AgentSearchRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.jobTitle) {
    return NextResponse.json(
      { error: 'Missing required field: jobTitle' },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const onEvent = (stepEvent: AgentStepEvent) => {
          sendEvent('step', stepEvent);
        };

        // Resume data is now auto-loaded from disk inside runJobSearchAgent
        const results = await runJobSearchAgent(body.jobTitle, body.location, {
          maxJobs: body.maxJobs ?? 5,
          matchThreshold: body.matchThreshold ?? 60,
          onEvent,
        });

        sendEvent('result', results);
      } catch (error) {
        const err = error as Error;
        console.error('[agent] Agent execution error:', err);
        sendEvent('step', { type: 'error', message: err.message });
        sendEvent('result', {
          jobTitle: body.jobTitle,
          totalH1bSponsors: 0,
          companiesSearched: 0,
          jobsAnalyzed: 0,
          results: [],
          error: err.message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
