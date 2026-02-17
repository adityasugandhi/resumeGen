'use client';

import React from 'react';
import Image from 'next/image';
import { MapPin, DollarSign, Briefcase, ChevronRight, Wand2 } from 'lucide-react';
import { getCompanyLogoUrl, extractDomain } from '@/store/companyStore';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import CountUp from '@/components/CountUp';
import SpotlightCard from '@/components/SpotlightCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string;
    location?: string;
    salary?: string;
    employmentType?: string;
    requirements?: string[];
    overallMatch?: number;
    url: string;
    status?: 'scanned' | 'applied' | 'interviewing' | 'rejected' | 'offer';
    createdAt?: number;
  };
  onClick?: () => void;
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const router = useRouter();

  const getMatchColor = (match?: number) => {
    if (!match) return 'text-muted-foreground';
    if (match >= 80) return 'text-emerald-500';
    if (match >= 60) return 'text-blue-500';
    if (match >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getMatchBg = (match?: number) => {
    if (!match) return 'bg-muted';
    if (match >= 80) return 'bg-emerald-50 dark:bg-emerald-950/30';
    if (match >= 60) return 'bg-blue-50 dark:bg-blue-950/30';
    if (match >= 40) return 'bg-amber-50 dark:bg-amber-950/30';
    return 'bg-red-50 dark:bg-red-950/30';
  };

  const handleOptimizeResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/editor?jobId=${job.id}`);
  };

  return (
    <SpotlightCard
      className="group cursor-pointer transition-all duration-300"
      spotlightColor="rgba(16, 185, 129, 0.12)"
    >
      <motion.div
        onClick={onClick}
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative rounded-2xl border border-border bg-surface overflow-hidden"
      >
        {/* Top gradient accent */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        <div className="p-5">
          {/* Header: Company & Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                <Image
                  src={getCompanyLogoUrl(extractDomain(job.company))}
                  alt={`${job.company} logo`}
                  width={20}
                  height={20}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span className="text-sm font-medium">{job.company}</span>
            </div>
            {job.status && <StatusBadge status={job.status} size="sm" />}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2 pr-4">
            {job.title}
          </h3>

          {/* Location */}
          {job.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <MapPin className="w-3.5 h-3.5" />
              <span className="line-clamp-1">{job.location}</span>
            </div>
          )}

          {/* Match Score & Meta */}
          <div className="flex items-center gap-4 mb-4">
            {job.overallMatch !== undefined && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getMatchBg(job.overallMatch)}`}>
                <span className={`text-2xl font-bold ${getMatchColor(job.overallMatch)}`}>
                  <CountUp to={job.overallMatch} duration={1.2} />
                  <span className="text-lg">%</span>
                </span>
                <span className="text-xs text-muted-foreground">match</span>
              </div>
            )}

            {job.salary && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{job.salary}</span>
              </div>
            )}
          </div>

          {/* Requirements preview */}
          {job.requirements && job.requirements.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Key Requirements
              </p>
              <ul className="space-y-1">
                {job.requirements.slice(0, 3).map((req, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground line-clamp-1 flex items-start gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                    {req}
                  </li>
                ))}
                {job.requirements.length > 3 && (
                  <li className="text-xs text-primary font-medium">
                    +{job.requirements.length - 3} more requirements
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-col gap-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {job.employmentType && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Briefcase className="w-3.5 h-3.5" />
                    {job.employmentType}
                  </div>
                )}
              </div>

              <motion.div
                className="flex items-center gap-1 text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                whileHover={{ x: 4 }}
              >
                View details
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            </div>

            {/* Optimize Resume Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="w-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Wand2 className="w-4 h-4" />}
                onClick={handleOptimizeResume}
                className="w-full"
              >
                Optimize Resume
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/[0.02] group-hover:to-accent/[0.02] transition-all duration-300 pointer-events-none" />
      </motion.div>
    </SpotlightCard>
  );
}
