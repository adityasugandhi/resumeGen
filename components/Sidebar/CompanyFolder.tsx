'use client';

import React from 'react';
import { ChevronRight, ChevronDown, File, Pin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanyStore } from '@/store/companyStore';
import { useEditorStore } from '@/store/editorStore';
import { Company, FileNode } from '@/types';
import CompanyLogo from './CompanyLogo';

interface CompanyFolderProps {
  company: Company;
  files: FileNode[];
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
}

export default function CompanyFolder({
  company,
  files,
  onContextMenu,
}: CompanyFolderProps) {
  const { currentFileId, setCurrentFile, setContent } = useEditorStore();
  const { expandedCompanies, toggleCompanyExpanded } = useCompanyStore();

  const isExpanded = expandedCompanies.has(company.id);
  const fileCount = files.length;

  const handleFolderClick = () => {
    toggleCompanyExpanded(company.id);
  };

  const handleFileClick = (file: FileNode) => {
    setCurrentFile(file.id);
    setContent(file.content || '');
  };

  return (
    <div>
      {/* Company folder header */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors group'
        )}
        onClick={handleFolderClick}
      >
        <span className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </span>

        <CompanyLogo
          name={company.name}
          logoUrl={company.logoUrl}
          size="md"
        />

        <span className="flex-1 text-sm font-medium truncate">{company.name}</span>

        <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
          {fileCount}
        </span>
      </div>

      {/* Files within company */}
      {isExpanded && (
        <div>
          {files.map((file) => {
            const isActive = currentFileId === file.id;
            const isPinned = file.isPinned;

            return (
              <div
                key={file.id}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors group',
                  isActive && 'bg-blue-100 dark:bg-blue-900/30'
                )}
                style={{ paddingLeft: '40px' }}
                onClick={() => handleFileClick(file)}
                onContextMenu={(e) => onContextMenu(e, file.id)}
              >
                <File className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                {file.matchScore !== undefined && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
                    file.matchScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    file.matchScore >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  )}>
                    {file.matchScore}%
                  </span>
                )}
                {file.jobUrl && (
                  <a
                    href={file.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    title="Open job posting"
                  >
                    <ExternalLink className="w-3 h-3 text-blue-500" />
                  </a>
                )}
                {isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
