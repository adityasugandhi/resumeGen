'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  Briefcase,
  GraduationCap,
  ListChecks,
  Linkedin,
  Globe,
  Loader2,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, StatusBadge, MatchScoreBadge } from '@/components/ui/Badge';
import LinkedInNoteModal from './LinkedInNoteModal';

interface JobPosting {
  id: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  employmentType?: string;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  qualifications?: string[];
  overallMatch?: number;
  status: 'scanned' | 'applied' | 'interviewing' | 'rejected' | 'offer';
  createdAt: number;
}

interface JobDetailsModalProps {
  job: JobPosting;
  isOpen: boolean;
  onClose: () => void;
  onOptimize: (jobId: string) => void;
  isOptimizing?: boolean;
}

export default function JobDetailsModal({
  job,
  isOpen,
  onClose,
  onOptimize,
  isOptimizing = false,
}: JobDetailsModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'responsibilities' | 'h1b'>('overview');
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [h1bData, setH1bData] = useState<{
    company: string;
    totalPositions: number;
    roles: { title: string; wage: number; location: string }[];
    avgWage: number;
    topMetros: { metro: string; count: number }[];
  } | null>(null);
  const [h1bLoading, setH1bLoading] = useState(false);
  const [h1bError, setH1bError] = useState<string | null>(null);

  const h1bFetchedRef = useRef(false);

  useEffect(() => {
    if (activeTab !== 'h1b' || h1bFetchedRef.current) return;
    h1bFetchedRef.current = true;

    const fetchData = async () => {
      setH1bLoading(true);
      setH1bError(null);
      try {
        const res = await fetch(`/api/h1b/company?company=${encodeURIComponent(job.company)}`);
        if (res.ok) {
          const data = await res.json();
          setH1bData(data);
        } else {
          const errData = await res.json();
          setH1bError(errData.error || 'Failed to fetch H1B data');
          h1bFetchedRef.current = false; // Allow retry on error
        }
      } catch {
        setH1bError('Network error fetching H1B data');
        h1bFetchedRef.current = false; // Allow retry on error
      } finally {
        setH1bLoading(false);
      }
    };

    fetchData();
  }, [activeTab, job.company]);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(job.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Gradient top border */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={job.status} />
                    {job.overallMatch !== undefined && (
                      <MatchScoreBadge score={job.overallMatch} />
                    )}
                  </div>

                  <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white mb-1 truncate">
                    {job.title}
                  </h2>

                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      {job.company}
                    </span>
                    {job.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                    )}
                  </div>
                </div>

                <IconButton
                  icon={<X className="w-5 h-5" />}
                  label="Close"
                  variant="ghost"
                  onClick={onClose}
                />
              </div>

              {/* Meta info row */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {job.salary && (
                  <Badge variant="success" size="lg">
                    <DollarSign className="w-3.5 h-3.5" />
                    {job.salary}
                  </Badge>
                )}
                {job.employmentType && (
                  <Badge variant="info" size="lg">
                    <Clock className="w-3.5 h-3.5" />
                    {job.employmentType}
                  </Badge>
                )}
                <Badge variant="outline" size="lg">
                  Scanned {formatDate(job.createdAt)}
                </Badge>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-8 py-2 border-b border-gray-100 dark:border-gray-800 flex gap-1">
              {[
                { id: 'overview', label: 'Overview', icon: Briefcase },
                { id: 'requirements', label: 'Requirements', icon: CheckCircle2 },
                { id: 'responsibilities', label: 'Responsibilities', icon: ListChecks },
                { id: 'h1b', label: 'H1B Data', icon: Globe },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === tab.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'requirements' && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                      {job.requirements.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Job Description
                    </h3>
                    <div className="prose prose-gray dark:prose-invert max-w-none">
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {job.description}
                      </p>
                    </div>

                    {/* Quick stats */}
                    <div className="mt-8 grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Requirements</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {job.requirements.length}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <ListChecks className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Responsibilities</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {job.responsibilities?.length || 0}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <GraduationCap className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Qualifications</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {job.qualifications?.length || 0}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'requirements' && (
                  <motion.div
                    key="requirements"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Requirements & Qualifications
                    </h3>
                    <ul className="space-y-3">
                      {job.requirements.map((req, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{req}</span>
                        </motion.li>
                      ))}
                    </ul>

                    {job.qualifications && job.qualifications.length > 0 && (
                      <div className="mt-8">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <GraduationCap className="w-5 h-5" />
                          Preferred Qualifications
                        </h4>
                        <ul className="space-y-3">
                          {job.qualifications.map((qual, index) => (
                            <motion.li
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                            >
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                <AlertCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">{qual}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'responsibilities' && (
                  <motion.div
                    key="responsibilities"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Key Responsibilities
                    </h3>
                    {job.responsibilities && job.responsibilities.length > 0 ? (
                      <ul className="space-y-3">
                        {job.responsibilities.map((resp, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                          >
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-xs font-bold text-teal-700 dark:text-teal-400">
                              {index + 1}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">{resp}</span>
                          </motion.li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No responsibilities listed for this position</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'h1b' && (
                  <motion.div
                    key="h1b"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      H1B Visa Data — {job.company}
                    </h3>

                    {h1bLoading && (
                      <div className="flex items-center justify-center py-12 gap-3 text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Fetching H1B data for {job.company}...</span>
                      </div>
                    )}

                    {h1bError && (
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-400">{h1bError}</p>
                      </div>
                    )}

                    {h1bData && (
                      <div className="space-y-6">
                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                              <DollarSign className="w-4 h-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Avg Wage</span>
                            </div>
                            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                              ${h1bData.avgWage.toLocaleString()}
                            </span>
                          </div>
                          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                              <Building2 className="w-4 h-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Positions</span>
                            </div>
                            <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                              {h1bData.totalPositions}
                            </span>
                          </div>
                          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                              <MapPin className="w-4 h-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Top Metro</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900 dark:text-white truncate block">
                              {h1bData.topMetros[0]?.metro || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Roles matching the job title */}
                        {(() => {
                          const matchingRoles = h1bData.roles.filter(
                            (r) => r.title.toLowerCase().includes(job.title.toLowerCase().split(' ')[0])
                          );
                          if (matchingRoles.length > 0) {
                            return (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-emerald-500" />
                                  Matching Roles
                                </h4>
                                <div className="space-y-2">
                                  {matchingRoles.slice(0, 5).map((role, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50"
                                    >
                                      <div>
                                        <span className="font-medium text-gray-900 dark:text-white text-sm">{role.title}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{role.location}</span>
                                      </div>
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        ${role.wage.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* All roles table */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            All H1B Roles ({h1bData.roles.length})
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0">
                                <tr className="bg-gray-50 dark:bg-gray-800/50">
                                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Location</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Wage</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {h1bData.roles.slice(0, 50).map((role, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                    <td className="px-3 py-2 text-gray-900 dark:text-white">{role.title}</td>
                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{role.location}</td>
                                    <td className="px-3 py-2 font-medium text-emerald-600 dark:text-emerald-400">
                                      ${role.wage.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Top metros */}
                        {h1bData.topMetros.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                              Top Metros
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {h1bData.topMetros.map((m, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                                >
                                  <MapPin className="w-3 h-3" />
                                  {m.metro}
                                  <span className="text-gray-400 dark:text-gray-500">({m.count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    onClick={handleCopyUrl}
                  >
                    {copiedUrl ? 'Copied!' : 'Copy URL'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ExternalLink className="w-4 h-4" />}
                    onClick={() => window.open(job.url, '_blank')}
                  >
                    Open Original
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Linkedin className="w-4 h-4" />}
                    onClick={() => setShowLinkedInModal(true)}
                  >
                    LinkedIn Note
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    leftIcon={<Sparkles className="w-4 h-4" />}
                    onClick={() => onOptimize(job.id)}
                    isLoading={isOptimizing}
                  >
                    Optimize Resume
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* LinkedIn Note Modal */}
          <LinkedInNoteModal
            job={job}
            isOpen={showLinkedInModal}
            onClose={() => setShowLinkedInModal(false)}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
