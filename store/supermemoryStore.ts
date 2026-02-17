/**
 * SuperMemory Zustand Store
 *
 * Manages SuperMemory sync state and operations:
 * - Sync status and progress
 * - Memory statistics
 * - Error handling
 * - User preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { memoryService } from '@/lib/supermemory/service';
import { syncAll, syncJob, syncResumeVersion } from '@/lib/supermemory/sync';
import type { SyncStatus, SyncResult } from '@/lib/supermemory/types';
import type { JobPosting, ResumeVersion } from '@/lib/indexeddb';

interface SupermemoryStore {
  // State
  isEnabled: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  autoSync: boolean; // Auto-sync new items
  stats: {
    totalMemories: number;
    resumeComponents: number;
    jobs: number;
    resumeVersions: number;
    coverLetters: number;
    outcomes: number;
  };

  // Actions
  enableSupermemory: () => void;
  disableSupermemory: () => void;
  setAutoSync: (enabled: boolean) => void;
  performFullSync: (userId: string) => Promise<SyncResult>;
  syncSingleJob: (userId: string, job: JobPosting) => Promise<boolean>;
  syncSingleVersion: (userId: string, version: ResumeVersion) => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  updateStats: () => void;
  clearError: () => void;
  reset: () => void;

  // Getters
  getSyncStatus: () => SyncStatus;
  isReady: () => boolean;
}

export const useSupermemoryStore = create<SupermemoryStore>()(
  persist(
    (set, get) => ({
      // Initial State
      isEnabled: false,
      isSyncing: false,
      lastSyncAt: null,
      syncError: null,
      autoSync: false,
      stats: {
        totalMemories: 0,
        resumeComponents: 0,
        jobs: 0,
        resumeVersions: 0,
        coverLetters: 0,
        outcomes: 0,
      },

      // Actions
      enableSupermemory: () => {
        console.log('[SupermemoryStore] Enabling SuperMemory features');
        set({ isEnabled: true, syncError: null });
      },

      disableSupermemory: () => {
        console.log('[SupermemoryStore] Disabling SuperMemory features');
        set({ isEnabled: false, autoSync: false });
      },

      setAutoSync: (enabled) => {
        console.log(`[SupermemoryStore] Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
        set({ autoSync: enabled });
      },

      performFullSync: async (userId: string) => {
        if (!memoryService.isEnabled()) {
          console.warn('[SupermemoryStore] SuperMemory not enabled, skipping sync');
          return {
            success: false,
            operationsCompleted: 0,
            operationsFailed: 0,
            errors: [],
            duration: 0,
          };
        }

        console.log('[SupermemoryStore] Starting full sync...');
        set({ isSyncing: true, syncError: null });

        try {
          const result = await syncAll(userId);

          if (result.success) {
            console.log('[SupermemoryStore] Sync completed successfully');
            set({
              isSyncing: false,
              lastSyncAt: Date.now(),
              syncError: null,
            });
            get().updateStats();
          } else {
            const errorMsg = `Sync completed with ${result.operationsFailed} errors`;
            console.error('[SupermemoryStore]', errorMsg);
            set({
              isSyncing: false,
              lastSyncAt: Date.now(),
              syncError: errorMsg,
            });
          }

          return result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
          console.error('[SupermemoryStore] Sync failed:', errorMsg);
          set({
            isSyncing: false,
            syncError: errorMsg,
          });
          return {
            success: false,
            operationsCompleted: 0,
            operationsFailed: 1,
            errors: [{ operation: {} as any, error: errorMsg }],
            duration: 0,
          };
        }
      },

      syncSingleJob: async (userId: string, job: JobPosting) => {
        if (!get().autoSync || !memoryService.isEnabled()) {
          return false;
        }

        try {
          const success = await syncJob(userId, job);
          if (success) {
            set((state) => ({
              stats: {
                ...state.stats,
                jobs: state.stats.jobs + 1,
                totalMemories: state.stats.totalMemories + 1,
              },
            }));
          }
          return success;
        } catch (error) {
          console.error('[SupermemoryStore] Failed to sync job:', error);
          return false;
        }
      },

      syncSingleVersion: async (userId: string, version: ResumeVersion) => {
        if (!get().autoSync || !memoryService.isEnabled()) {
          return false;
        }

        try {
          const success = await syncResumeVersion(userId, version);
          if (success) {
            set((state) => ({
              stats: {
                ...state.stats,
                resumeVersions: state.stats.resumeVersions + 1,
                totalMemories: state.stats.totalMemories + 1,
              },
            }));
          }
          return success;
        } catch (error) {
          console.error('[SupermemoryStore] Failed to sync resume version:', error);
          return false;
        }
      },

      testConnection: async () => {
        try {
          console.log('[SupermemoryStore] Testing connection...');
          const isConnected = await memoryService.testConnection();
          if (isConnected) {
            console.log('[SupermemoryStore] Connection test successful');
            set({ syncError: null });
          } else {
            console.error('[SupermemoryStore] Connection test failed');
            set({ syncError: 'Failed to connect to SuperMemory' });
          }
          return isConnected;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Connection test failed';
          console.error('[SupermemoryStore]', errorMsg);
          set({ syncError: errorMsg });
          return false;
        }
      },

      updateStats: () => {
        // This would ideally query SuperMemory for actual counts
        // For now, we'll increment based on sync operations
        console.log('[SupermemoryStore] Stats updated');
      },

      clearError: () => {
        set({ syncError: null });
      },

      reset: () => {
        console.log('[SupermemoryStore] Resetting store');
        set({
          isEnabled: false,
          isSyncing: false,
          lastSyncAt: null,
          syncError: null,
          autoSync: false,
          stats: {
            totalMemories: 0,
            resumeComponents: 0,
            jobs: 0,
            resumeVersions: 0,
            coverLetters: 0,
            outcomes: 0,
          },
        });
      },

      // Getters
      getSyncStatus: () => {
        const state = get();
        return {
          isEnabled: state.isEnabled,
          isSyncing: state.isSyncing,
          lastSyncAt: state.lastSyncAt || undefined,
          syncError: state.syncError || undefined,
          stats: state.stats,
        };
      },

      isReady: () => {
        return get().isEnabled && memoryService.isEnabled();
      },
    }),
    {
      name: 'supermemory-store',
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        autoSync: state.autoSync,
        lastSyncAt: state.lastSyncAt,
        stats: state.stats,
      }),
    }
  )
);
