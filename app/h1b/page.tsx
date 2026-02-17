'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Briefcase,
  Globe,
  Settings,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import H1bSearchBar from '@/components/h1b/H1bSearchBar';
import H1bStatsRow from '@/components/h1b/H1bStatsRow';
import H1bResultsTable from '@/components/h1b/H1bResultsTable';
import CompanySponsorsTable from '@/components/h1b/CompanySponsorsTable';

interface MarketData {
  totalPositions: number;
  avgWage: number;
  medianWage: number;
  topCompanies: { company: string; count: number; avgWage: number }[];
  wageRange: { min: number; max: number };
}

interface DetailRow {
  jobTitle: string;
  company: string;
  location: string;
  wage: number;
  year: string;
}

function parseCsvToRows(csv: string): DetailRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const wage = parseInt((cols[5] || '0').replace(/[$,]/g, ''), 10) || 0;
    return {
      jobTitle: cols[0] || '',
      company: cols[2] || '',
      location: cols[3] || '',
      wage,
      year: cols[6] || '',
    };
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export default function H1bPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [searchLabel, setSearchLabel] = useState('');

  const handleSearch = async (params: { jobTitle: string; company: string; years: string[] }) => {
    setIsLoading(true);
    setError(null);
    setSearchLabel(params.jobTitle || params.company);

    try {
      // Fetch market intelligence and raw CSV in parallel
      const yearParams = params.years.map((y) => `year=${y}`).join('&');

      const fetchPromises: Promise<Response>[] = [];

      // Market data (needs jobTitle)
      if (params.jobTitle) {
        const marketUrl = `/api/h1b/market?jobTitle=${encodeURIComponent(params.jobTitle)}&${yearParams}`;
        fetchPromises.push(fetch(marketUrl));
      }

      // Raw CSV for details table
      const csvParams = new URLSearchParams();
      if (params.jobTitle) csvParams.set('jobTitle', params.jobTitle);
      if (params.company) csvParams.set('company', params.company);
      params.years.forEach((y) => csvParams.append('year', y));
      fetchPromises.push(fetch(`/api/h1b?${csvParams.toString()}`));

      const responses = await Promise.all(fetchPromises);

      // Parse market data
      if (params.jobTitle && responses.length === 2) {
        const marketRes = responses[0];
        if (marketRes.ok) {
          const data = await marketRes.json();
          setMarketData(data);
        }

        const csvRes = responses[1];
        if (csvRes.ok) {
          const csv = await csvRes.text();
          setDetailRows(parseCsvToRows(csv));
        } else {
          const errData = await csvRes.json();
          setError(errData.error || 'Failed to fetch H1B data');
        }
      } else {
        // Company-only search — no market data
        const csvRes = responses[0];
        if (csvRes.ok) {
          const csv = await csvRes.text();
          const rows = parseCsvToRows(csv);
          setDetailRows(rows);

          // Compute stats from rows
          const wages = rows.map((r) => r.wage).filter((w) => w > 0);
          wages.sort((a, b) => a - b);
          const avg = wages.length > 0 ? Math.round(wages.reduce((a, b) => a + b, 0) / wages.length) : 0;
          const median = wages.length > 0
            ? wages.length % 2 === 0
              ? (wages[wages.length / 2 - 1] + wages[wages.length / 2]) / 2
              : wages[Math.floor(wages.length / 2)]
            : 0;

          // Group by company for top sponsors
          const companyCounts = new Map<string, { count: number; totalWage: number }>();
          for (const r of rows) {
            const entry = companyCounts.get(r.company) || { count: 0, totalWage: 0 };
            entry.count++;
            entry.totalWage += r.wage;
            companyCounts.set(r.company, entry);
          }
          const topCompanies = [...companyCounts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([company, data]) => ({
              company,
              count: data.count,
              avgWage: Math.round(data.totalWage / data.count),
            }));

          setMarketData({
            totalPositions: rows.length,
            avgWage: avg,
            medianWage: median,
            topCompanies,
            wageRange: {
              min: wages.length > 0 ? wages[0] : 0,
              max: wages.length > 0 ? wages[wages.length - 1] : 0,
            },
          });
        } else {
          const errData = await csvRes.json();
          setError(errData.error || 'Failed to fetch H1B data');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyClick = (company: string) => {
    handleSearch({ jobTitle: '', company, years: ['2025', '2026'] });
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Navigation Bar */}
      <nav className="relative z-20 border-b border-border bg-surface/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-serif font-bold text-foreground">
                Career<span className="text-primary">Forge</span>
              </h1>

              <div className="flex gap-1 p-1 bg-muted rounded-xl">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Editor</span>
                </button>
                <button
                  onClick={() => router.push('/jobs')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Jobs</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm bg-surface text-foreground rounded-lg shadow-sm">
                  <Globe className="w-4 h-4" />
                  <span>H1B Intel</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconButton
                icon={<Settings className="w-5 h-5" />}
                label="Settings"
                variant="ghost"
                onClick={() => router.push('/settings')}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Badge variant="success" className="mb-3">
            <Sparkles className="w-3 h-3" />
            DOL Certified Data
          </Badge>
          <h2 className="text-4xl font-serif font-bold text-foreground mb-2">
            H1B Salary Intelligence
          </h2>
          <p className="text-muted-foreground text-lg">
            Search H1B visa salary records powered by GoingGlobal DOL data
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <H1bSearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Fetching H1B data...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && marketData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {searchLabel && (
              <p className="text-sm text-muted-foreground">
                Showing results for <span className="font-semibold text-foreground">&quot;{searchLabel}&quot;</span>
              </p>
            )}

            {/* Stats Row */}
            <H1bStatsRow
              avgWage={marketData.avgWage}
              medianWage={marketData.medianWage}
              totalPositions={marketData.totalPositions}
              topCompany={marketData.topCompanies[0]?.company || ''}
            />

            {/* Two-column layout: sponsors + details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <CompanySponsorsTable
                  sponsors={marketData.topCompanies}
                  onCompanyClick={handleCompanyClick}
                />
              </div>
              <div className="lg:col-span-2">
                <H1bResultsTable
                  results={detailRows}
                  medianWage={marketData.medianWage}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state — no search yet */}
        {!isLoading && !marketData && !error && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-8">
              <Globe className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
              Explore H1B Salary Data
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Search by job title or company to discover real H1B visa salary data from DOL records
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
              <span>Try:</span>
              {['Software Engineer', 'Data Scientist', 'Product Manager'].map((term) => (
                <button
                  key={term}
                  onClick={() => handleSearch({ jobTitle: term, company: '', years: ['2025', '2026'] })}
                  className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
