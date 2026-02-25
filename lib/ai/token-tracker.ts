/**
 * Token usage and cost tracking for all AI API calls.
 * Singleton — call TokenTracker.getInstance() to access.
 */

export type TokenSource =
  | 'optimizer'      // resume-optimizer.ts — Claude Sonnet
  | 'agent'          // job-search-agent.ts — Claude Sonnet
  | 'browser_agent'  // ai-browser-agent.ts — Claude Sonnet
  | 'code_agent'     // code-agent.ts — Claude Sonnet
  | 'web_search'     // tools.ts — Perplexity Sonar
  | 'job_parser'     // job-parser.ts — Groq
  | 'explorer'       // career-explorer-agent.ts — OpenRouter
  ;

interface TokenRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  source: TokenSource;
  runId: string;
  timestamp: number;
}

// Pricing per 1M tokens (input/output)
const PRICING: Record<string, { input: number; output: number }> = {
  // Claude Sonnet via Bedrock
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { input: 3.0, output: 15.0 },
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 3.0, output: 15.0 },
  // Claude Sonnet direct
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  // Groq (free tier)
  'llama3-groq-70b-8192-tool-use-preview': { input: 0, output: 0 },
  'llama-3.3-70b-versatile': { input: 0, output: 0 },
  // OpenRouter (Llama 3.3 70B via DeepInfra/Novita)
  'meta-llama/llama-3.3-70b-instruct': { input: 0.12, output: 0.30 },
  // Perplexity Sonar
  'sonar': { input: 1.0, output: 1.0 },
  'sonar-pro': { input: 3.0, output: 15.0 },
  // Default fallback
  'default': { input: 3.0, output: 15.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || PRICING['default'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export class TokenTracker {
  private static instance: TokenTracker;
  private records: TokenRecord[] = [];
  private listeners: Set<(record: TokenRecord) => void> = new Set();

  private constructor() {}

  static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  /**
   * Record a token usage event.
   */
  record(
    model: string,
    inputTokens: number,
    outputTokens: number,
    source: TokenSource,
    runId: string
  ): TokenRecord {
    const cost = calculateCost(model, inputTokens, outputTokens);
    const record: TokenRecord = {
      model,
      inputTokens,
      outputTokens,
      cost,
      source,
      runId,
      timestamp: Date.now(),
    };
    this.records.push(record);

    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(record); } catch { /* ignore */ }
    }

    return record;
  }

  /**
   * Get usage for a specific run, aggregated by source.
   */
  getRunUsage(runId: string): {
    bySource: Record<string, { inputTokens: number; outputTokens: number; cost: number; calls: number }>;
    totalInput: number;
    totalOutput: number;
    totalCost: number;
    totalCalls: number;
  } {
    const bySource: Record<string, { inputTokens: number; outputTokens: number; cost: number; calls: number }> = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    let totalCalls = 0;

    for (const r of this.records) {
      if (r.runId !== runId) continue;
      if (!bySource[r.source]) {
        bySource[r.source] = { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 };
      }
      bySource[r.source].inputTokens += r.inputTokens;
      bySource[r.source].outputTokens += r.outputTokens;
      bySource[r.source].cost += r.cost;
      bySource[r.source].calls++;
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalCost += r.cost;
      totalCalls++;
    }

    return { bySource, totalInput, totalOutput, totalCost, totalCalls };
  }

  /**
   * Get total cost across all runs in this session.
   */
  getTotalCost(): number {
    return this.records.reduce((sum, r) => sum + r.cost, 0);
  }

  /**
   * Subscribe to new token records.
   */
  onRecord(listener: (record: TokenRecord) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Reset all records (for testing).
   */
  reset(): void {
    this.records = [];
  }
}
