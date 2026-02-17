'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  Pin,
  PinOff,
  Building2,
  FolderKanban,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanyStore } from '@/store/companyStore';
import { useEditorStore } from '@/store/editorStore';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { FileSystemNode, FolderNode, FileNode } from '@/types';
import AssignCompanyModal from './AssignCompanyModal';
import CompanyFolder from './CompanyFolder';

export default function FolderTree() {
  const { nodes, rootIds, toggleFolder, deleteNode, renameNode, togglePin, getFilesByCompany, getUngroupedFiles } = useFileSystemStore();
  const { currentFileId, setCurrentFile, setContent } = useEditorStore();
  const { companies, getAllCompaniesArray, groupByCompany, setGroupByCompany, initializeFromStorage: initCompanies } = useCompanyStore();

  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [assignCompanyFile, setAssignCompanyFile] = useState<FileNode | null>(null);
  const [ungroupedExpanded, setUngroupedExpanded] = useState(true);

  // Initialize companies on mount
  useEffect(() => {
    initCompanies();
  }, [initCompanies]);

  // Get all companies and their files
  const companiesWithFiles = useMemo(() => {
    const allCompanies = getAllCompaniesArray();
    return allCompanies
      .map((company) => ({
        company,
        files: getFilesByCompany(company.id),
      }))
      .filter(({ files }) => files.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllCompaniesArray, getFilesByCompany, companies, nodes]);

  // Get ungrouped files
  const ungroupedFiles = useMemo(() => {
    return getUngroupedFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUngroupedFiles, nodes]);

  const handleNodeClick = (node: FileSystemNode) => {
    if (node.type === 'folder') {
      toggleFolder(node.id);
    } else {
      setCurrentFile(node.id);
      setContent((node as FileNode).content || '');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
  };

  const handleRename = (nodeId: string) => {
    const node = nodes[nodeId];
    if (node) {
      setRenamingId(nodeId);
      setRenamingValue(node.name);
      setContextMenu(null);
    }
  };

  const handleRenameSubmit = () => {
    if (renamingId && renamingValue.trim()) {
      renameNode(renamingId, renamingValue);
      setRenamingId(null);
      setRenamingValue('');
    }
  };

  const handleDelete = (nodeId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteNode(nodeId);
      setContextMenu(null);
    }
  };

  const handleTogglePin = (nodeId: string) => {
    togglePin(nodeId);
    setContextMenu(null);
  };

  const handleAssignCompany = (nodeId: string) => {
    const node = nodes[nodeId];
    if (node?.type === 'file') {
      setAssignCompanyFile(node as FileNode);
      setContextMenu(null);
    }
  };

  const renderNode = (nodeId: string, depth: number = 0): React.ReactNode => {
    const node = nodes[nodeId];
    if (!node) return null;

    const isFolder = node.type === 'folder';
    const isExpanded = isFolder && (node as FolderNode).isExpanded;
    const isActive = node.type === 'file' && currentFileId === node.id;
    const isPinned = node.type === 'file' && (node as FileNode).isPinned;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors group',
            isActive && 'bg-blue-100 dark:bg-blue-900/30',
            `pl-${depth * 4 + 2}`
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
        >
          {isFolder && (
            <span className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          )}

          <span className="flex-shrink-0">
            {isFolder ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 text-blue-500" />
              )
            ) : (
              <File className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </span>

          {renamingId === node.id ? (
            <input
              type="text"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenamingId(null);
                  setRenamingValue('');
                }
              }}
              className="flex-1 px-1 py-0 text-sm bg-white dark:bg-gray-900 border border-blue-500 rounded"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm truncate">{node.name}</span>
          )}

          {isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
        </div>

        {isFolder && isExpanded && (
          <div>
            {(node as FolderNode).children.map((childId) => renderNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render grouped view (by company)
  const renderGroupedView = () => {
    return (
      <div className="py-2">
        {/* Company folders */}
        {companiesWithFiles.map(({ company, files }) => (
          <CompanyFolder
            key={company.id}
            company={company}
            files={files}
            onContextMenu={handleContextMenu}
          />
        ))}

        {/* Ungrouped files section */}
        {ungroupedFiles.length > 0 && (
          <div>
            <div
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => setUngroupedExpanded(!ungroupedExpanded)}
            >
              <span className="flex-shrink-0">
                {ungroupedExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </span>
              <Folder className="w-4 h-4 text-gray-500" />
              <span className="flex-1 text-sm text-gray-600 dark:text-gray-400">Ungrouped</span>
              <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {ungroupedFiles.length}
              </span>
            </div>
            {ungroupedExpanded && (
              <div>
                {ungroupedFiles.map((file) => {
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
                      onClick={() => {
                        setCurrentFile(file.id);
                        setContent(file.content || '');
                      }}
                      onContextMenu={(e) => handleContextMenu(e, file.id)}
                    >
                      <File className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-sm truncate">{file.name}</span>
                      {isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {companiesWithFiles.length === 0 && ungroupedFiles.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No files yet. Create a new file to get started.
          </div>
        )}
      </div>
    );
  };

  // Render ungrouped view (original tree structure)
  const renderUngroupedView = () => {
    return (
      <div className="py-2">
        {rootIds.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No files yet. Create a new file to get started.
          </div>
        ) : (
          rootIds.map((id) => renderNode(id))
        )}
      </div>
    );
  };

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setGroupByCompany(true)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
            groupByCompany
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
          )}
          title="Group by company"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Companies</span>
        </button>
        <button
          onClick={() => setGroupByCompany(false)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
            !groupByCompany
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
          )}
          title="Show all files"
        >
          <List className="w-3.5 h-3.5" />
          <span>All Files</span>
        </button>
      </div>

      {/* File tree */}
      {groupByCompany ? renderGroupedView() : renderUngroupedView()}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleRename(contextMenu.nodeId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Rename
            </button>
            {nodes[contextMenu.nodeId]?.type === 'file' && (
              <>
                <button
                  onClick={() => handleTogglePin(contextMenu.nodeId)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  {(nodes[contextMenu.nodeId] as FileNode).isPinned ? (
                    <>
                      <PinOff className="w-4 h-4" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="w-4 h-4" />
                      Pin
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleAssignCompany(contextMenu.nodeId)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Assign to Company
                </button>
              </>
            )}
            <button
              onClick={() => handleDelete(contextMenu.nodeId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Assign Company Modal */}
      {assignCompanyFile && (
        <AssignCompanyModal
          file={assignCompanyFile}
          onClose={() => setAssignCompanyFile(null)}
        />
      )}
    </div>
  );
}
