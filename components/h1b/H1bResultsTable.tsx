'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, MapPin, Building2, DollarSign } from 'lucide-react';

interface H1bResult {
  jobTitle: string;
  company: string;
  location: string;
  wage: number;
  year: string;
}

interface H1bResultsTableProps {
  results: H1bResult[];
  medianWage?: number;
}

type SortKey = 'jobTitle' | 'company' | 'location' | 'wage' | 'year';
type SortDir = 'asc' | 'desc';

export default function H1bResultsTable({ results, medianWage = 0 }: H1bResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('wage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [visibleCount, setVisibleCount] = useState(25);

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [results, sortKey, sortDir]);

  const visible = sorted.slice(0, visibleCount);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-emerald-500" />
      : <ChevronDown className="w-3 h-3 text-emerald-500" />;
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No salary data found. Try a different search.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Salary Details
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {results.length} records
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              {([
                ['jobTitle', 'Job Title'],
                ['company', 'Company'],
                ['location', 'Location'],
                ['wage', 'Wage'],
                ['year', 'Year'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                >
                  <span className="flex items-center gap-1">
                    {label}
                    <SortIcon column={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {row.jobTitle}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {row.company}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {row.location}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-semibold ${
                      row.wage >= medianWage
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    ${row.wage.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {row.year}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleCount < results.length && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + 25)}
            className="px-6 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
          >
            Show more ({results.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
