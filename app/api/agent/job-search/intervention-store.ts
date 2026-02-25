import type { InterventionResponse } from '@/lib/ai/agent/types';

interface PendingIntervention {
  resolve: (response: InterventionResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingInterventions = new Map<string, PendingIntervention>();

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Pauses the agent stream and waits for user input (or timeout).
 * Called from the SSE route when a tool fails and onIntervention fires.
 */
export function waitForIntervention(
  streamId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<InterventionResponse> {
  return new Promise<InterventionResponse>((resolve) => {
    const timer = setTimeout(() => {
      pendingInterventions.delete(streamId);
      resolve({ action: 'auto_fix' });
    }, timeoutMs);

    pendingInterventions.set(streamId, { resolve, timer });
  });
}

/**
 * Resolves a pending intervention with the user's chosen action.
 * Called from POST /api/agent/job-search/intervene.
 * Returns true if there was a pending intervention to resolve.
 */
export function resolveIntervention(
  streamId: string,
  response: InterventionResponse
): boolean {
  const pending = pendingInterventions.get(streamId);
  if (!pending) return false;

  clearTimeout(pending.timer);
  pendingInterventions.delete(streamId);
  pending.resolve(response);
  return true;
}

/**
 * Cancels a pending intervention (e.g. when the client disconnects).
 * Auto-resolves to auto_fix so the promise doesn't hang.
 */
export function cancelIntervention(streamId: string): void {
  const pending = pendingInterventions.get(streamId);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingInterventions.delete(streamId);
  pending.resolve({ action: 'auto_fix' });
}
