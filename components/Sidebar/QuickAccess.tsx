'use client';

import React from 'react';
import { File, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/store/editorStore';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { FileNode } from '@/types';

export default function QuickAccess() {
  const { getPinnedFiles } = useFileSystemStore();
  const { currentFileId, setCurrentFile, setContent } = useEditorStore();

  const pinnedFiles = getPinnedFiles();

  const handleFileClick = (file: FileNode) => {
    setCurrentFile(file.id);
    setContent(file.content || '');
  };

  if (pinnedFiles.length === 0) {
    return null;
  }

  return (
    <div className="p-2">
      <div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
        <Pin className="w-3 h-3" />
        <span>Quick Access</span>
      </div>
      <div className="mt-1">
        {pinnedFiles.map((file) => (
          <div
            key={file.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors rounded',
              currentFileId === file.id && 'bg-blue-100 dark:bg-blue-900/30'
            )}
            onClick={() => handleFileClick(file)}
          >
            <File className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-sm truncate">{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
