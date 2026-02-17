'use client';

import { Building2, DollarSign, Users } from 'lucide-react';
import { extractDomain, getCompanyLogoUrl } from '@/store/companyStore';

interface CompanySponsor {
  company: string;
  count: number;
  avgWage: number;
}

interface CompanySponsorsTableProps {
  sponsors: CompanySponsor[];
  onCompanyClick?: (company: string) => void;
}

export default function CompanySponsorsTable({ sponsors, onCompanyClick }: CompanySponsorsTableProps) {
  if (sponsors.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No sponsor data available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Top Sponsors
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {sponsors.length} companies
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Positions
                </span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Avg Wage
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sponsors.map((sponsor, idx) => {
              const domain = extractDomain(sponsor.company);
              const logoUrl = getCompanyLogoUrl(domain);

              return (
                <tr
                  key={idx}
                  onClick={() => onCompanyClick?.(sponsor.company)}
                  className={`
                    hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors
                    ${onCompanyClick ? 'cursor-pointer' : ''}
                  `}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={logoUrl}
                        alt={sponsor.company}
                        className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {sponsor.company}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                      {sponsor.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                    ${sponsor.avgWage.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
