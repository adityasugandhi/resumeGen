/**
 * Simple token-bucket rate limiter for outbound API calls.
 * Each service gets its own bucket with configurable rate.
 */

interface RateLimiterOptions {
  /** Max requests per interval */
  maxRequests: number;
  /** Interval in milliseconds */
  intervalMs: number;
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxRequests;
    this.tokens = options.maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = options.maxRequests / options.intervalMs;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until a token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }
}

// Pre-configured buckets for each external service
const buckets = new Map<string, TokenBucket>();

function getBucket(service: string, defaults: RateLimiterOptions): TokenBucket {
  let bucket = buckets.get(service);
  if (!bucket) {
    bucket = new TokenBucket(defaults);
    buckets.set(service, bucket);
  }
  return bucket;
}

/** Rate-limited wrapper. Acquires a token before executing fn. */
export async function rateLimited<T>(
  service: 'brave' | 'perplexity' | 'groq' | 'anthropic',
  fn: () => Promise<T>
): Promise<T> {
  const configs: Record<string, RateLimiterOptions> = {
    brave: { maxRequests: 1, intervalMs: 1000 },        // 1 req/sec (free tier safe)
    perplexity: { maxRequests: 1, intervalMs: 2000 },    // 1 req/2sec
    groq: { maxRequests: 5, intervalMs: 1000 },          // 5 req/sec
    anthropic: { maxRequests: 2, intervalMs: 1000 },     // 2 req/sec
  };

  const bucket = getBucket(service, configs[service]);
  await bucket.acquire();
  return fn();
}
