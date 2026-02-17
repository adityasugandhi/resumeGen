'use client';

import { DollarSign, TrendingUp, Users, Building2 } from 'lucide-react';
import { StatCard } from '@/components/ui/Card';

interface H1bStatsRowProps {
  avgWage: number;
  medianWage: number;
  totalPositions: number;
  topCompany: string;
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export default function H1bStatsRow({ avgWage, medianWage, totalPositions, topCompany }: H1bStatsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Avg Wage"
        value={formatCurrency(avgWage)}
        icon={<DollarSign className="w-5 h-5" />}
        color="emerald"
      />
      <StatCard
        label="Median Wage"
        value={formatCurrency(medianWage)}
        icon={<TrendingUp className="w-5 h-5" />}
        color="blue"
      />
      <StatCard
        label="Total Positions"
        value={totalPositions.toLocaleString()}
        icon={<Users className="w-5 h-5" />}
        color="amber"
      />
      <StatCard
        label="Top Company"
        value={topCompany || '—'}
        icon={<Building2 className="w-5 h-5" />}
        color="default"
      />
    </div>
  );
}
