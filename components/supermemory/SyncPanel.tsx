'use client';

/**
 * SuperMemory Sync Panel Component
 *
 * UI for managing SuperMemory synchronization:
 * - Enable/disable SuperMemory features
 * - Manual sync button
 * - Auto-sync toggle
 * - Sync status and progress
 * - Privacy notice
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSupermemoryStore } from '@/store/supermemoryStore';

const USER_ID = 'default-user'; // TODO: Replace with actual user ID system

export default function SyncPanel() {
  const {
    isEnabled,
    isSyncing,
    lastSyncAt,
    syncError,
    autoSync,
    stats,
    enableSupermemory,
    disableSupermemory,
    setAutoSync,
    performFullSync,
    testConnection,
    clearError,
    isReady,
  } = useSupermemoryStore();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  // Test connection on mount if enabled
  useEffect(() => {
    if (isEnabled) {
      testConnection().then(setIsConnected);
    }
  }, [isEnabled, testConnection]);

  // Handle enable SuperMemory
  const handleEnable = async () => {
    setShowPrivacyNotice(true);
  };

  // Confirm and enable
  const confirmEnable = async () => {
    setShowPrivacyNotice(false);
    enableSupermemory();
    toast.success('SuperMemory enabled');

    // Test connection
    const connected = await testConnection();
    setIsConnected(connected);

    if (connected) {
      toast.success('Connected to SuperMemory successfully');
    } else {
      toast.error('Failed to connect to SuperMemory. Check your API key.');
    }
  };

  // Handle disable
  const handleDisable = () => {
    disableSupermemory();
    setIsConnected(null);
    toast.info('SuperMemory disabled');
  };

  // Handle manual sync
  const handleSync = async () => {
    if (!isReady()) {
      toast.error('SuperMemory is not ready. Please check your configuration.');
      return;
    }

    toast.info('Starting sync...');
    const result = await performFullSync(USER_ID);

    if (result.success) {
      toast.success(
        `Sync completed! ${result.operationsCompleted} items synced in ${result.duration}ms`
      );
    } else {
      toast.error(
        `Sync failed. ${result.operationsFailed} errors occurred.`
      );
    }
  };

  // Handle auto-sync toggle
  const handleAutoSyncToggle = () => {
    const newValue = !autoSync;
    setAutoSync(newValue);
    toast.info(`Auto-sync ${newValue ? 'enabled' : 'disabled'}`);
  };

  // Format last sync time
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SuperMemory Sync
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Sync your career data to SuperMemory for enhanced AI context
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected === true && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Connected
            </div>
          )}
          {isConnected === false && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Disconnected
            </div>
          )}
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            SuperMemory Features
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Enable to sync data to the cloud
          </p>
        </div>
        <button
          onClick={isEnabled ? handleDisable : handleEnable}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Error Display */}
      {syncError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Sync Error
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {syncError}
                </p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Sync Controls */}
      {isEnabled && (
        <div className="space-y-4">
          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Auto-sync
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Automatically sync new jobs and resume versions
              </p>
            </div>
            <button
              onClick={handleAutoSyncToggle}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${autoSync ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${autoSync ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {/* Manual Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing || !isReady()}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>

          {/* Last Sync Info */}
          <div className="text-center text-xs text-gray-600 dark:text-gray-400">
            Last synced: {formatLastSync(lastSyncAt)}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.jobs}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Jobs
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.resumeVersions}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Resumes
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalMemories}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice Modal */}
      {showPrivacyNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Privacy Notice
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                SuperMemory will store your career data (job postings, resumes, and optimization history) on their cloud servers for enhanced AI context and semantic search.
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                What gets synced:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Resume components (experiences, skills, projects)</li>
                <li>Scanned job postings</li>
                <li>Tailored resume versions</li>
                <li>Application outcomes (if tracked)</li>
              </ul>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                What doesn&apos;t get synced:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>LaTeX compilation files</li>
                <li>Local file system data</li>
                <li>UI preferences</li>
              </ul>
              <p className="text-xs mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <strong>Note:</strong> You can disable SuperMemory at any time. Your local data will remain intact.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrivacyNotice(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEnable}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                I Understand, Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
