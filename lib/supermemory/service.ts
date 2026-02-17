/**
 * SuperMemory Service Layer
 *
 * Provides high-level abstraction for SuperMemory operations:
 * - Add, search, update, delete memories
 * - Type-safe interfaces for different memory types
 * - Error handling and logging
 * - Graceful degradation when SuperMemory is disabled
 */

import { supermemoryClient } from './client';
import type {
  AddMemoryRequest,
  AddMemoryResponse,
  SearchMemoryResponse,
  SearchMemoryResult,
  MemoryType,
  MemoryMetadata,
  ResumeComponentMetadata,
  JobPostingMetadata,
  ResumeVersionMetadata,
} from './types';

// ============================================
// Service Class
// ============================================

export class MemoryService {
  /**
   * Add a memory to SuperMemory
   */
  async add<T extends MemoryMetadata>(
    userId: string,
    content: string,
    metadata: T,
    additionalTags: string[] = []
  ): Promise<AddMemoryResponse> {
    if (!supermemoryClient.isReady()) {
      console.warn('[MemoryService] SuperMemory not enabled, skipping add operation');
      return { id: '', success: false, message: 'SuperMemory is not configured' };
    }

    try {
      const client = supermemoryClient.getClient();

      const containerTags = [
        metadata.type,
        ...additionalTags,
      ];

      const request: AddMemoryRequest = {
        content,
        userId,
        containerTags,
        metadata: metadata as unknown as Record<string, string | number | boolean | string[]>,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.memories.add(request as any);

      return {
        id: response.id,
        success: true,
      };
    } catch (error) {
      return supermemoryClient.handleError(error, 'MemoryService.add');
    }
  }

  /**
   * Search memories by query and optional filters
   */
  async search<T extends MemoryMetadata = MemoryMetadata>(
    userId: string,
    query: string,
    memoryType?: MemoryType,
    _limit: number = 10
  ): Promise<SearchMemoryResponse<T>> {
    if (!supermemoryClient.isReady()) {
      console.warn('[MemoryService] SuperMemory not enabled, returning empty results');
      return { results: [], total: 0, query };
    }

    try {
      const client = supermemoryClient.getClient();

      // Build container tags (include userId and memoryType)
      const containerTags = [userId];
      if (memoryType) {
        containerTags.push(memoryType);
      }

      const response = await client.search.documents({
        q: query,
        containerTags,
      });

      interface SuperMemorySearchResult {
        id?: string;
        content?: string;
        metadata?: Record<string, unknown>;
        score?: number;
        containerTags?: string[];
      }

      // Map results to our type (SuperMemory results have different structure)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedResults: SearchMemoryResult<T>[] = (response.results || []).map((result: any) => ({
        id: result.id || '',
        content: result.content || '',
        metadata: (result.metadata || {}) as T,
        score: result.score || 0,
        containerTags: result.containerTags || [],
      }));

      return {
        results: mappedResults,
        total: mappedResults.length,
        query,
      };
    } catch (error) {
      return supermemoryClient.handleError(error, 'MemoryService.search');
    }
  }

  /**
   * Update an existing memory
   */
  async update(
    id: string,
    updates: {
      content?: string;
      metadata?: Record<string, unknown>;
      containerTags?: string[];
    }
  ): Promise<boolean> {
    if (!supermemoryClient.isReady()) {
      console.warn('[MemoryService] SuperMemory not enabled, skipping update operation');
      return false;
    }

    try {
      const client = supermemoryClient.getClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.memories.update(id, updates as any);

      return true;
    } catch (error) {
      return supermemoryClient.handleError(error, 'MemoryService.update');
    }
  }

  /**
   * Delete a memory
   */
  async delete(id: string): Promise<boolean> {
    if (!supermemoryClient.isReady()) {
      console.warn('[MemoryService] SuperMemory not enabled, skipping delete operation');
      return false;
    }

    try {
      const client = supermemoryClient.getClient();

      await client.memories.delete(id);

      return true;
    } catch (error) {
      return supermemoryClient.handleError(error, 'MemoryService.delete');
    }
  }

  /**
   * Batch delete memories by custom IDs or filter
   */
  async batchDelete(ids: string[]): Promise<{ success: number; failed: number }> {
    if (!supermemoryClient.isReady()) {
      console.warn('[MemoryService] SuperMemory not enabled, skipping batch delete');
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    const promises = ids.map(async (id) => {
      try {
        await this.delete(id);
        success++;
      } catch (error) {
        console.error(`[MemoryService] Failed to delete memory ${id}:`, error);
        failed++;
      }
    });

    await Promise.allSettled(promises);

    return { success, failed };
  }

  /**
   * Test SuperMemory connection
   */
  async testConnection(): Promise<boolean> {
    return await supermemoryClient.testConnection();
  }

  /**
   * Check if SuperMemory is enabled
   */
  isEnabled(): boolean {
    return supermemoryClient.isReady();
  }
}

// ============================================
// Type-Specific Helper Functions
// ============================================

export class ResumeComponentService {
  constructor(private memoryService: MemoryService) {}

  async add(
    userId: string,
    content: string,
    metadata: Omit<ResumeComponentMetadata, 'type' | 'userId' | 'createdAt'>
  ): Promise<AddMemoryResponse> {
    const fullMetadata: ResumeComponentMetadata = {
      ...metadata,
      type: 'resume_component',
      userId,
      createdAt: Date.now(),
    };

    return await this.memoryService.add(
      userId,
      content,
      fullMetadata,
      [metadata.componentType, ...(metadata.technologies || [])]
    );
  }

  async search(
    userId: string,
    query: string,
    componentType?: string,
    limit: number = 10
  ): Promise<SearchMemoryResponse<ResumeComponentMetadata>> {
    return await this.memoryService.search<ResumeComponentMetadata>(
      userId,
      query,
      'resume_component',
      limit
    );
  }
}

export class JobPostingService {
  constructor(private memoryService: MemoryService) {}

  async add(
    userId: string,
    content: string,
    metadata: Omit<JobPostingMetadata, 'type' | 'userId' | 'createdAt'>
  ): Promise<AddMemoryResponse> {
    const fullMetadata: JobPostingMetadata = {
      ...metadata,
      type: 'job_posting',
      userId,
      createdAt: Date.now(),
    };

    return await this.memoryService.add(
      userId,
      content,
      fullMetadata,
      [metadata.company.toLowerCase(), metadata.location || '', ...(metadata.technologies || [])]
    );
  }

  async search(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<SearchMemoryResponse<JobPostingMetadata>> {
    return await this.memoryService.search<JobPostingMetadata>(
      userId,
      query,
      'job_posting',
      limit
    );
  }

  async findByCompany(
    userId: string,
    company: string,
    limit: number = 10
  ): Promise<SearchMemoryResponse<JobPostingMetadata>> {
    return await this.search(userId, company, limit);
  }
}

export class ResumeVersionService {
  constructor(private memoryService: MemoryService) {}

  async add(
    userId: string,
    content: string,
    metadata: Omit<ResumeVersionMetadata, 'type' | 'userId' | 'createdAt'>
  ): Promise<AddMemoryResponse> {
    const fullMetadata: ResumeVersionMetadata = {
      ...metadata,
      type: 'resume_version',
      userId,
      createdAt: Date.now(),
    };

    return await this.memoryService.add(
      userId,
      content,
      fullMetadata,
      ['optimized', metadata.company || '']
    );
  }

  async search(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<SearchMemoryResponse<ResumeVersionMetadata>> {
    return await this.memoryService.search<ResumeVersionMetadata>(
      userId,
      query,
      'resume_version',
      limit
    );
  }
}

// ============================================
// Singleton Export
// ============================================

export const memoryService = new MemoryService();
export const resumeComponentService = new ResumeComponentService(memoryService);
export const jobPostingService = new JobPostingService(memoryService);
export const resumeVersionService = new ResumeVersionService(memoryService);
