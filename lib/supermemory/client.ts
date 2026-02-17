/**
 * SuperMemory Client Singleton
 *
 * Provides a configured SuperMemory client instance with:
 * - Error handling and retry logic
 * - Environment-based configuration
 * - Singleton pattern for consistent usage
 */

import Supermemory from 'supermemory';
import { SuperMemoryAPIError } from './types';

// ============================================
// Configuration
// ============================================

const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY || process.env.NEXT_PUBLIC_SUPERMEMORY_API_KEY;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000; // 30 seconds

// ============================================
// Client Singleton
// ============================================

class SuperMemoryClient {
  private static instance: SuperMemoryClient;
  private client: Supermemory | null = null;
  private isEnabled: boolean = false;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SuperMemoryClient {
    if (!SuperMemoryClient.instance) {
      SuperMemoryClient.instance = new SuperMemoryClient();
    }
    return SuperMemoryClient.instance;
  }

  /**
   * Initialize SuperMemory client
   */
  private initialize(): void {
    if (!SUPERMEMORY_API_KEY || SUPERMEMORY_API_KEY === 'your_api_key_here') {
      console.warn(
        '[SuperMemory] API key not configured. Memory features will be disabled. ' +
        'Add SUPERMEMORY_API_KEY to your .env.local file.'
      );
      this.isEnabled = false;
      return;
    }

    try {
      this.client = new Supermemory({
        apiKey: SUPERMEMORY_API_KEY,
        maxRetries: MAX_RETRIES,
        timeout: TIMEOUT_MS,
      });
      this.isEnabled = true;
    } catch (error) {
      console.error('[SuperMemory] Failed to initialize client:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Check if SuperMemory is enabled and configured
   */
  public isReady(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Get the SuperMemory client instance
   * @throws {SuperMemoryAPIError} if client is not initialized
   */
  public getClient(): Supermemory {
    if (!this.isReady() || !this.client) {
      throw new SuperMemoryAPIError(
        'SuperMemory is not configured. Please add SUPERMEMORY_API_KEY to your environment variables.',
        503
      );
    }
    return this.client;
  }

  /**
   * Test the connection to SuperMemory API
   */
  public async testConnection(): Promise<boolean> {
    if (!this.isReady() || !this.client) {
      return false;
    }

    try {
      // Simple test: try to search (empty results OK)
      await this.client.search.documents({
        q: 'test',
        containerTags: ['test-connection'],
      });
      return true;
    } catch (error) {
      console.error('[SuperMemory] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Handle SuperMemory API errors with detailed logging
   */
  public handleError(error: unknown, context: string): never {
    if (error instanceof Supermemory.APIError) {
      console.error(`[SuperMemory] API Error in ${context}:`, {
        status: error.status,
        name: error.name,
        message: error.message,
        headers: error.headers,
      });

      // Map specific HTTP status codes to user-friendly messages
      const message = this.getErrorMessage(error.status || 500);

      throw new SuperMemoryAPIError(
        message,
        error.status || 500,
        { originalError: error.message, context }
      );
    }

    // Unknown error
    console.error(`[SuperMemory] Unexpected error in ${context}:`, error);
    throw new SuperMemoryAPIError(
      'An unexpected error occurred while communicating with SuperMemory',
      500,
      { originalError: error, context }
    );
  }

  /**
   * Get user-friendly error message based on HTTP status code
   */
  private getErrorMessage(status: number): string {
    switch (status) {
      case 401:
        return 'Invalid SuperMemory API key. Please check your configuration.';
      case 403:
        return 'Access forbidden. Please verify your SuperMemory subscription.';
      case 429:
        return 'Rate limit exceeded. Please try again in a few minutes.';
      case 500:
        return 'SuperMemory service is currently unavailable. Please try again later.';
      case 503:
        return 'SuperMemory service is temporarily unavailable. Please try again later.';
      default:
        return `SuperMemory API error (${status}). Please try again.`;
    }
  }

  /**
   * Reset client (useful for testing or re-initialization)
   */
  public reset(): void {
    this.client = null;
    this.isEnabled = false;
    this.initialize();
  }
}

// ============================================
// Exports
// ============================================

/**
 * Get the singleton SuperMemory client instance
 */
export const getSupermemoryClient = (): SuperMemoryClient => {
  return SuperMemoryClient.getInstance();
};

/**
 * Check if SuperMemory features are enabled
 */
export const isSupermemoryEnabled = (): boolean => {
  return getSupermemoryClient().isReady();
};

/**
 * Export client instance for direct usage
 */
export const supermemoryClient = getSupermemoryClient();
