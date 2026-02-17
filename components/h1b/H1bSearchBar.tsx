'use client';

import { useState } from 'react';
import { Search, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const TRENDING_COMPANIES = [
  'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'OpenAI',
];

const AVAILABLE_YEARS = ['2026', '2025', '2024'];

interface H1bSearchBarProps {
  onSearch: (params: { jobTitle: string; company: string; years: string[] }) => void;
  isLoading?: boolean;
}

export default function H1bSearchBar({ onSearch, isLoading = false }: H1bSearchBarProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [selectedYears, setSelectedYears] = useState<string[]>(['2025', '2026']);

  const handleSearch = () => {
    if (!jobTitle.trim() && !company.trim()) return;
    onSearch({ jobTitle: jobTitle.trim(), company: company.trim(), years: selectedYears });
  };

  const handleTrendingClick = (companyName: string) => {
    setCompany(companyName);
    onSearch({ jobTitle: jobTitle.trim(), company: companyName, years: selectedYears });
  };

  const toggleYear = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Job title (e.g., Software Engineer)"
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex-1">
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Company name (e.g., Google)"
          />
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {AVAILABLE_YEARS.map((year) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={`
                  flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-all
                  ${selectedYears.includes(year)
                    ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <Calendar className="w-3 h-3" />
                {year}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            onClick={handleSearch}
            isLoading={isLoading}
            disabled={!jobTitle.trim() && !company.trim()}
            leftIcon={<Search className="w-4 h-4" />}
          >
            Search
          </Button>
        </div>
      </div>

      {/* Trending chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Trending:
        </span>
        {TRENDING_COMPANIES.map((name) => (
          <button
            key={name}
            onClick={() => handleTrendingClick(name)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-full border transition-all
              ${company === name
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400'
              }
            `}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
