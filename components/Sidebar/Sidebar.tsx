'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FolderPlus,
  Moon,
  Sun,
  FileText,
  Briefcase,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { useUIStore } from '@/store/uiStore';
import FolderTree from './FolderTree';
import QuickAccess from './QuickAccess';

export default function Sidebar() {
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const { isSidebarCollapsed, theme, showQuickAccess, toggleSidebar, toggleTheme } = useUIStore();
  const { createFile, createFolder } = useFileSystemStore();

  const handleCreateFile = () => {
    if (newItemName.trim()) {
      createFile(newItemName, null);
      setNewItemName('');
      setShowNewFileModal(false);
    }
  };

  const handleCreateFolder = () => {
    if (newItemName.trim()) {
      createFolder(newItemName, null);
      setNewItemName('');
      setShowNewFolderModal(false);
    }
  };

  if (isSidebarCollapsed) {
    return (
      <div className="w-12 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-4">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">LaTeX Editor</h2>
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => router.push('/')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded transition-colors",
              pathname === '/'
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
            )}
            title="Resume Editor"
          >
            <FileText className="w-4 h-4" />
            <span>Editor</span>
          </button>
          <button
            onClick={() => router.push('/jobs')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded transition-colors",
              pathname === '/jobs'
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
            )}
            title="Jobs Dashboard"
          >
            <Briefcase className="w-4 h-4" />
            <span>Jobs</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewFileModal(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            title="New file"
          >
            <FilePlus className="w-4 h-4" />
            <span>File</span>
          </button>
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            title="New folder"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Folder</span>
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Access */}
      {showQuickAccess && (
        <div className="border-b border-gray-200 dark:border-gray-800">
          <QuickAccess />
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <FolderTree />
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-80">
            <h3 className="text-lg font-semibold mb-4">New File</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              placeholder="resume.tex"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewFileModal(false);
                  setNewItemName('');
                }}
                className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-80">
            <h3 className="text-lg font-semibold mb-4">New Folder</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="folder-name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewItemName('');
                }}
                className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
