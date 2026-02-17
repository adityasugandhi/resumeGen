'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
  Briefcase,
  TrendingUp,
  Target,
  Clock,
  Settings,
  Search,
  Link2,
  Globe,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import JobCard from '@/components/jobs/JobCard';
import JobDetailsModal from '@/components/jobs/JobDetailsModal';
import PreviewModal from '@/components/jobs/PreviewModal';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatCard } from '@/components/ui/Card';
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalContent, ModalFooter } from '@/components/ui/Modal';
import { JobCardSkeleton, StatCardSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { useEditorStore } from '@/store/editorStore';
import { useJobStore } from '@/store/jobStore';
import { useResumeStore } from '@/store/resumeStore';

export default function JobsPage() {
  const router = useRouter();
  const [showScanModal, setShowScanModal] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    jobs,
    isScanning,
    scanError,
    loadJobs,
    addJob,
    setIsScanning,
    setScanError,
    getJobStats,
  } = useJobStore();

  const {
    isOptimizing,
    loadResumeVersions,
    addResumeVersion,
    setIsOptimizing,
    setOptimizationError,
    getCurrentVersion,
  } = useResumeStore();

  const { content: currentLatex } = useEditorStore();

  useEffect(() => {
    const init = async () => {
      await loadJobs();
      await loadResumeVersions();
      setIsLoading(false);
    };
    init();
  }, [loadJobs, loadResumeVersions]);

  const stats = getJobStats();
  const currentVersion = getCurrentVersion();
  const selectedJobData = jobs.find((j) => j.id === selectedJob);

  const handleScanJob = async () => {
    if (!jobUrl.trim()) {
      toast.error('Please enter a job URL');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/jobs/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl }),
      });

      const data = await response.json();

      if (data.success) {
        await addJob(data.job);
        toast.success(data.message);
        setJobUrl('');
        setShowScanModal(false);
      } else {
        setScanError(data.error);
        toast.error(data.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      setScanError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOptimizeResume = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    if (!currentLatex) {
      toast.error('Please open a resume file in the editor first');
      return;
    }

    setIsOptimizing(true);
    setOptimizationError(null);
    setSelectedJob(null); // Close job details modal

    try {
      const response = await fetch('/api/resume/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobCompany: job.company,
          jobRequirements: job.requirements,
          gapAnalysis: [],
          originalLatex: currentLatex,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await addResumeVersion(data.version);
        setShowPreviewModal(true);
        toast.success(data.message);
      } else {
        setOptimizationError(data.error);
        toast.error(data.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      setOptimizationError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleExportResume = (_latex: string) => {
    toast.success('Resume exported to editor. You can now compile and download it!');
    setShowPreviewModal(false);
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
                <button className="flex items-center gap-2 px-4 py-2 text-sm bg-surface text-foreground rounded-lg shadow-sm">
                  <Briefcase className="w-4 h-4" />
                  <span>Jobs</span>
                </button>
                <button
                  onClick={() => router.push('/h1b')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
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
        {isLoading ? (
          // Loading skeletons
          <div>
            <div className="mb-8">
              <div className="h-10 w-64 bg-muted rounded-lg animate-pulse mb-2" />
              <div className="h-5 w-96 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : jobs.length > 0 ? (
          // Jobs exist - show dashboard
          <>
            {/* Header */}
            <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="success" className="mb-3">
                  <Sparkles className="w-3 h-3" />
                  AI-Powered Tracking
                </Badge>
                <h2 className="text-4xl font-serif font-bold text-foreground mb-2">
                  Your Job Pipeline
                </h2>
                <p className="text-muted-foreground text-lg">
                  Track opportunities and generate tailored resumes for every application
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={() => setShowScanModal(true)}
              >
                Scan New Job
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <StatCard
                label="Total Jobs"
                value={stats.total}
                icon={<Briefcase className="w-5 h-5" />}
                color="default"
              />
              <StatCard
                label="Applied"
                value={stats.applied}
                icon={<Target className="w-5 h-5" />}
                color="emerald"
              />
              <StatCard
                label="Interviewing"
                value={stats.interviewing}
                icon={<Clock className="w-5 h-5" />}
                color="blue"
              />
              <StatCard
                label="Avg Match"
                value={`${stats.avgMatch}%`}
                icon={<TrendingUp className="w-5 h-5" />}
                color="amber"
              />
            </div>

            {/* Job Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="relative group"
                >
                  <JobCard
                    job={job}
                    onClick={() => setSelectedJob(job.id)}
                  />
                  {/* Quick optimize button */}
                  <div
                    className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Sparkles className="w-4 h-4" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOptimizeResume(job.id);
                      }}
                      isLoading={isOptimizing}
                    >
                      Optimize
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          // Empty state
          <div className="max-w-4xl mx-auto text-center py-16">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-8">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>

              <h2 className="text-5xl font-serif font-bold text-foreground mb-4">
                AI-Powered Job Tracking
              </h2>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Scan job postings, extract requirements automatically, and generate perfectly tailored resumes in seconds
              </p>

              <Button
                variant="primary"
                size="lg"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={() => setShowScanModal(true)}
                className="text-lg px-8 py-4"
              >
                Scan Your First Job
              </Button>

            {/* Feature cards */}
            <div className="grid md:grid-cols-3 gap-6 mt-20">
              {[
                {
                  step: '1',
                  title: 'Paste Job URL',
                  description: 'Copy any job link from LinkedIn, Indeed, or company career pages',
                  gradient: 'from-emerald-500 to-teal-500',
                },
                {
                  step: '2',
                  title: 'AI Extracts Details',
                  description: 'We pull title, requirements, skills, and responsibilities automatically',
                  gradient: 'from-teal-500 to-cyan-500',
                },
                {
                  step: '3',
                  title: 'Optimize Resume',
                  description: 'Generate a tailored resume version and export it to the editor',
                  gradient: 'from-cyan-500 to-blue-500',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="relative p-6 rounded-2xl bg-surface border border-border group hover:shadow-xl transition-shadow"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <span className="text-2xl font-bold text-white">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scan Job Modal */}
      <Modal
        isOpen={showScanModal && !isScanning}
        onClose={() => setShowScanModal(false)}
        size="md"
      >
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <ModalTitle>Scan Job Posting</ModalTitle>
              <ModalDescription>AI-powered extraction in seconds</ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <ModalContent>
          <p className="text-muted-foreground mb-4">
            Paste any public job URL from LinkedIn, Indeed, or a company career site.
          </p>

          <div className="mb-4 p-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Supported sources
            </p>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                linkedin.com/jobs/view/...
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                indeed.com/viewjob?jk=...
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                company.com/careers/role
              </div>
            </div>
          </div>

          <Input
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScanJob()}
            placeholder="https://..."
            leftIcon={<Link2 className="w-4 h-4" />}
            rightIcon={
              jobUrl && (
                <button
                  onClick={() => setJobUrl('')}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )
            }
          />

          <AnimatePresence>
            {scanError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2"
              >
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{scanError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">
                Typical scan time: 2-5 seconds
              </span>
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowScanModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={handleScanJob}
            disabled={!jobUrl.trim()}
          >
            Scan with AI
          </Button>
        </ModalFooter>
      </Modal>

      {/* Scanning Loading Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-surface rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 text-center border border-border"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-spin-slow" />
                <div className="absolute inset-1 rounded-full bg-surface flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-2">
                Scanning Job Posting
              </h3>
              <p className="text-muted-foreground mb-6">
                Our AI is extracting requirements and preparing insights
              </p>

              <div className="space-y-3 text-sm text-left">
                {[
                  { label: 'Reading job description', color: 'bg-emerald-500' },
                  { label: 'Extracting requirements', color: 'bg-teal-500' },
                  { label: 'Calculating match score', color: 'bg-cyan-500' },
                ].map((step, index) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <span className={`w-2 h-2 rounded-full ${step.color} animate-pulse`} />
                    <span className="text-muted-foreground">{step.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Details Modal */}
      {selectedJobData && (
        <JobDetailsModal
          job={selectedJobData}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          onOptimize={handleOptimizeResume}
          isOptimizing={isOptimizing}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && currentVersion && (
        <PreviewModal
          version={currentVersion}
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onExport={handleExportResume}
        />
      )}
    </div>
  );
}
