'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Building2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanyStore, extractCompanyFromFilename } from '@/store/companyStore';
import { useFileSystemStore } from '@/store/fileSystemStore';
import { FileNode } from '@/types';
import CompanyLogo from './CompanyLogo';

interface AssignCompanyModalProps {
  file: FileNode;
  onClose: () => void;
}

export default function AssignCompanyModal({
  file,
  onClose,
}: AssignCompanyModalProps) {
  const { getAllCompaniesArray, addCompany, getCompanyById } = useCompanyStore();
  const { updateFileCompany } = useFileSystemStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const allCompanies = getAllCompaniesArray();

  // Try to extract company name from filename as suggestion
  const suggestedCompany = useMemo(() => {
    return extractCompanyFromFilename(file.name);
  }, [file.name]);

  // Set search query to suggested company on mount
  useEffect(() => {
    if (suggestedCompany && !file.companyId) {
      setSearchQuery(suggestedCompany);
    }
  }, [suggestedCompany, file.companyId]);

  // Filter companies by search query
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) {
      return allCompanies;
    }
    const query = searchQuery.toLowerCase();
    return allCompanies.filter((company) =>
      company.name.toLowerCase().includes(query)
    );
  }, [allCompanies, searchQuery]);

  // Check if we should show "Create new" option
  const showCreateOption = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const exactMatch = allCompanies.some(
      (company) => company.name.toLowerCase() === searchQuery.toLowerCase().trim()
    );
    return !exactMatch;
  }, [allCompanies, searchQuery]);

  const handleSelectCompany = async (companyId: string) => {
    const company = getCompanyById(companyId);
    if (company) {
      updateFileCompany(file.id, company.id, company.name);
      onClose();
    }
  };

  const handleCreateAndAssign = async () => {
    const name = searchQuery.trim();
    if (!name) return;

    setIsLoading(true);
    try {
      const company = await addCompany(name);
      updateFileCompany(file.id, company.id, company.name);
      onClose();
    } catch (error) {
      console.error('Failed to create company:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCompany = () => {
    updateFileCompany(file.id, undefined, undefined);
    onClose();
  };

  const currentCompany = file.companyId ? getCompanyById(file.companyId) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Assign to Company</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File info */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">File:</p>
          <p className="text-sm font-medium truncate">{file.name}</p>
          {currentCompany && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Current:</p>
              <div className="flex items-center gap-1.5">
                <CompanyLogo
                  name={currentCompany.name}
                  logoUrl={currentCompany.logoUrl}
                  size="sm"
                />
                <span className="text-sm font-medium">{currentCompany.name}</span>
              </div>
              <button
                onClick={handleRemoveCompany}
                className="ml-auto text-xs text-red-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or create company..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {suggestedCompany && !file.companyId && (
            <p className="mt-2 text-xs text-gray-500">
              💡 Suggested from filename: <span className="font-medium">{suggestedCompany}</span>
            </p>
          )}
        </div>

        {/* Company list */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Create new company option */}
          {showCreateOption && (
            <button
              onClick={handleCreateAndAssign}
              disabled={isLoading}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30',
                'border border-blue-200 dark:border-blue-800 mb-2'
              )}
            >
              <div className="w-6 h-6 rounded-sm bg-blue-500 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Create &quot;{searchQuery.trim()}&quot;
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  New company
                </p>
              </div>
            </button>
          )}

          {/* Existing companies */}
          {filteredCompanies.length > 0 ? (
            <div className="space-y-1">
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany(company.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    file.companyId === company.id && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <CompanyLogo
                    name={company.name}
                    logoUrl={company.logoUrl}
                    size="md"
                  />
                  <span className="flex-1 text-sm truncate">{company.name}</span>
                  {file.companyId === company.id && (
                    <span className="text-xs text-blue-500 font-medium">Current</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            !showCreateOption && (
              <div className="py-8 text-center text-sm text-gray-500">
                No companies found. Start typing to create one.
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
