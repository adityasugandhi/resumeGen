'use client';

/**
 * Settings Page
 *
 * User settings and preferences including:
 * - SuperMemory sync configuration
 * - Theme settings (future)
 * - Editor preferences (future)
 */

import SyncPanel from '@/components/supermemory/SyncPanel';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your preferences and integrations
          </p>
        </div>

        {/* SuperMemory Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <SyncPanel />
        </div>

        {/* Placeholder for future settings sections */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 opacity-50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Editor Preferences
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Coming soon: Customize your LaTeX editor settings
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 opacity-50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Theme Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Coming soon: Additional theme customization options
          </p>
        </div>
      </div>
    </div>
  );
}
