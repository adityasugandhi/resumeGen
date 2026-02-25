'use client';

import { useRef, useState, useCallback } from 'react';
import type { AgentSearchRequest, AgentStepEvent, AgentSearchResponse, InterventionAction } from '@/lib/ai/agent/types';

interface UseAgentStreamOptions {
  onStep?: (event: AgentStepEvent) => void;
  onResult?: (result: AgentSearchResponse) => void;
  onError?: (error: string) => void;
  onIntervention?: (streamId: string, tool: string, error: string) => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (request: AgentSearchRequest) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);

    try {
      const res = await fetch('/api/agent/job-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop()!; // keep trailing partial

        for (const msg of messages) {
          if (!msg.trim()) continue;

          const lines = msg.split('\n');
          let eventType = '';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              data = line.slice(6);
            }
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (eventType === 'step') {
              const stepEvent = parsed as AgentStepEvent;
              options.onStep?.(stepEvent);

              // Check if intervention is required
              if (
                stepEvent.type === 'intervention_required' &&
                'streamId' in stepEvent
              ) {
                const ie = stepEvent as { streamId: string; tool: string; error: string };
                options.onIntervention?.(ie.streamId, ie.tool, ie.error);
              }
            } else if (eventType === 'result') {
              options.onResult?.(parsed as AgentSearchResponse);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      options.onError?.((err as Error).message);
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [options]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const respond = useCallback(async (
    streamId: string,
    action: InterventionAction,
    prompt?: string
  ): Promise<void> => {
    try {
      const res = await fetch('/api/agent/job-search/intervene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, action, prompt }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Intervention failed' }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
    } catch (error) {
      console.error('[useAgentStream] Intervention response failed:', error);
    }
  }, []);

  return { start, cancel, respond, isRunning };
}