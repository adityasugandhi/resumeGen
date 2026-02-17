import { NextResponse } from 'next/server';
import { indexExistingResumes } from '@/lib/ai/agent/memory-indexer';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        const result = await indexExistingResumes((progress) => {
          sendEvent('progress', progress);
        });

        sendEvent('result', {
          success: true,
          ...result,
        });
      } catch (error) {
        const err = error as Error;
        console.error('[memory/init] Indexing error:', err);
        sendEvent('error', { message: err.message });
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
