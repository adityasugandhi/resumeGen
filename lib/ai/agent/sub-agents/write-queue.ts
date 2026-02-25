/**
 * Concurrency primitives for parallel sub-agent execution.
 *
 * - WriteQueue: async mutex ensuring single-writer access to LanceDB
 * - Semaphore: bounded concurrency limiter for HTTP/compute resources
 */

export class WriteQueue {
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }> = [];
  private running = false;

  /**
   * Enqueue an async operation to run exclusively (no concurrent writes).
   * Returns the operation's result once it completes.
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }

    this.running = false;
  }
}

export class Semaphore {
  private current = 0;
  private waiting: Array<() => void> = [];

  constructor(private max: number) {}

  /**
   * Run an async function with bounded concurrency.
   * Waits if the semaphore is at capacity.
   */
  async run<T>(fn: () => Promise<T>, timeoutMs: number = 300_000): Promise<T> {
    await this.acquire();
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Semaphore task timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    this.current--;
    if (this.waiting.length > 0) {
      this.current++;
      const next = this.waiting.shift()!;
      next();
    }
  }

  /** Current number of active slots. */
  get activeCount(): number {
    return this.current;
  }

  /** Number of tasks waiting for a slot. */
  get waitingCount(): number {
    return this.waiting.length;
  }
}

/** Singleton write queue for LanceDB career memory writes. */
export const lanceWriteQueue = new WriteQueue();
