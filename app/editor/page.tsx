'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useJobStore } from '@/store/jobStore';
import { useEditorStore } from '@/store/editorStore';
import { useResumeStore } from '@/store/resumeStore';
import { ResumeChange, ResumeVersion } from '@/lib/indexeddb';

// Import all editor components
import EditorLayout from '@/components/Editor/EditorLayout';
import DiffPanel from '@/components/Editor/DiffPanel';
// KeywordAnalysis component expects ATSScore props - using simple display instead
// import KeywordAnalysis from '@/components/Editor/KeywordAnalysis';
import SuggestionHeader from '@/components/Editor/SuggestionHeader';
import ActionBar from '@/components/Editor/ActionBar';
import ViewToggle from '@/components/Editor/ViewToggle';
import ChangeCard from '@/components/Editor/ChangeCard';
import CompilationPreview from '@/components/Editor/CompilationPreview';

type ViewMode = 'diff' | 'overlay' | 'raw';

function EditorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('jobId');

  // Store hooks
  const { jobs } = useJobStore();
  const { content: currentLatex } = useEditorStore();
  const { resumeVersions, addResumeVersion, acceptChange, rejectChange, applyAcceptedChanges } =
    useResumeStore();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<ResumeVersion | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | undefined>();
  const [optimizedPdfUrl, setOptimizedPdfUrl] = useState<string | undefined>();
  const [showPreview, setShowPreview] = useState(false);
  const [highlightedLineNumber, setHighlightedLineNumber] = useState<number | undefined>();

  // Find the job
  const job = jobId ? jobs.find((j) => j.id === jobId) : null;

  // Initialize on mount
  useEffect(() => {
    const initializeEditor = async () => {
      if (!jobId) {
        toast.error('No job selected');
        router.push('/jobs');
        return;
      }

      if (!job) {
        toast.error('Job not found');
        router.push('/jobs');
        return;
      }

      if (!currentLatex) {
        toast.error('Please open a resume file in the editor first');
        router.push('/');
        return;
      }

      // Check if we already have a version for this job
      const existingVersion = resumeVersions.find((v) => v.jobId === jobId);
      if (existingVersion) {
        setCurrentVersion(existingVersion);
        setIsLoading(false);
        return;
      }

      // Otherwise, optimize the resume
      setIsOptimizing(true);
      try {
        // If requirements are empty, try to use qualifications or responsibilities
        const requirements = (job.requirements?.length ?? 0) > 0
          ? job.requirements
          : ((job.qualifications?.length ?? 0) > 0
              ? job.qualifications
              : job.responsibilities || []);

        const response = await fetch('/api/resume/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            jobTitle: job.title,
            jobCompany: job.company,
            jobRequirements: requirements,
            jobDescription: job.description, // Fallback for AI when requirements empty
            gapAnalysis: [],
            originalLatex: currentLatex,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to optimize resume');
        }

        const data = await response.json();

        if (!data.success || !data.version) {
          throw new Error(data.error || 'Invalid response from optimization API');
        }

        // Create resume version from API response
        const version: ResumeVersion = {
          id: data.version.id || `version-${Date.now()}`,
          jobId,
          originalLatex: currentLatex,
          tailoredLatex: data.version.tailoredLatex,
          changes: data.version.changes || [],
          overallMatchScore: data.version.overallMatchScore || 0,
          createdAt: data.version.createdAt || Date.now(),
          acceptedChanges: [],
        };

        await addResumeVersion(version);
        setCurrentVersion(version);
        toast.success('Resume optimized successfully!');
      } catch (error) {
        console.error('Error optimizing resume:', error);
        toast.error('Failed to optimize resume with AI');
        router.push('/jobs');
      } finally {
        setIsOptimizing(false);
        setIsLoading(false);
      }
    };

    initializeEditor();
  }, [jobId]);

  // Handle change actions
  const handleAcceptChange = async (changeId: string) => {
    if (!currentVersion) return;
    await acceptChange(currentVersion.id, changeId);
    setCurrentVersion({
      ...currentVersion,
      acceptedChanges: [...(currentVersion.acceptedChanges || []), changeId],
    });
  };

  const handleRejectChange = async (changeId: string) => {
    if (!currentVersion) return;
    await rejectChange(currentVersion.id, changeId);
    setCurrentVersion({
      ...currentVersion,
      acceptedChanges: (currentVersion.acceptedChanges || []).filter((id) => id !== changeId),
    });
  };

  const handleAcceptAll = () => {
    if (!currentVersion) return;
    currentVersion.changes.forEach((change) => {
      handleAcceptChange(change.id);
    });
    toast.success('All changes accepted');
  };

  const handleRejectAll = () => {
    if (!currentVersion) return;
    setCurrentVersion({
      ...currentVersion,
      acceptedChanges: [],
    });
    toast.success('All changes rejected');
  };

  const handleRefine = async () => {
    toast.info('AI refinement coming soon!');
  };

  const handleExport = () => {
    if (!currentVersion) return;
    const finalLatex = applyAcceptedChanges(currentVersion.id);

    // Copy to clipboard
    navigator.clipboard.writeText(finalLatex);
    toast.success('Optimized LaTeX copied to clipboard!');
  };

  const handleDownload = async () => {
    if (!currentVersion) return;
    setIsCompiling(true);

    try {
      const finalLatex = applyAcceptedChanges(currentVersion.id);

      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: finalLatex }),
      });

      if (!response.ok) {
        throw new Error('Compilation failed');
      }

      const data = await response.json();

      // Download the PDF
      const link = document.createElement('a');
      link.href = data.pdfUrl;
      link.download = `resume-${job?.company}-${Date.now()}.pdf`;
      link.click();

      toast.success('Resume compiled and downloaded!');
    } catch (error) {
      console.error('Compilation error:', error);
      toast.error('Failed to compile resume');
    } finally {
      setIsCompiling(false);
    }
  };

  // Extract keywords from job requirements for analysis
  const extractKeywords = () => {
    if (!job?.requirements) return [];

    // Helper to escape special regex characters
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return job.requirements.flatMap((req) => {
      // Simple keyword extraction (split on common separators)
      return req
        .split(/[,;/&]/)
        .map((k) => k.trim())
        .filter((k) => k.length > 2);
    }).map((keyword) => ({
      keyword,
      present: currentLatex?.toLowerCase().includes(keyword.toLowerCase()) || false,
      occurrences: currentLatex
        ? (currentLatex.toLowerCase().match(new RegExp(escapeRegex(keyword.toLowerCase()), 'g')) || []).length
        : 0,
    }));
  };

  if (isLoading || isOptimizing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-medium">
            {isOptimizing ? 'Optimizing your resume...' : 'Loading editor...'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {isOptimizing ? 'AI is analyzing job requirements and tailoring your resume' : 'Please wait'}
          </p>
        </div>
      </div>
    );
  }

  if (!currentVersion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-medium">Failed to load resume version</p>
          <button
            onClick={() => router.push('/jobs')}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  const acceptedCount = currentVersion.acceptedChanges?.length || 0;
  const pendingCount = currentVersion.changes.length - acceptedCount;
  const keywords = extractKeywords();

  return (
    <EditorLayout>
      {/* Header */}
      <SuggestionHeader
        summary={`Optimized resume for ${job?.title} at ${job?.company}. Review the suggested changes below.`}
        confidence={currentVersion.overallMatchScore}
        changeCount={currentVersion.changes.length}
        acceptedCount={acceptedCount}
      />
      <ViewToggle currentView={viewMode} onViewChange={setViewMode} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Diff Panel */}
        {viewMode === 'diff' && (
          <DiffPanel
            originalLatex={currentVersion.originalLatex}
            modifiedLatex={currentVersion.tailoredLatex}
            highlightedLine={highlightedLineNumber}
          />
        )}

        {viewMode === 'overlay' && (
          <div className="flex-1 p-6 overflow-auto">
            <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-900 p-6 rounded-lg border border-border">
              {currentVersion.tailoredLatex}
            </pre>
          </div>
        )}

        {viewMode === 'raw' && (
          <div className="flex-1 p-6 overflow-auto">
            <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-900 p-6 rounded-lg border border-border">
              {currentVersion.originalLatex}
            </pre>
          </div>
        )}

        {/* Right: Keyword Analysis + Changes List */}
        <div className="w-80 border-l border-border flex flex-col bg-surface">
          {/* Simple Keyword Coverage Display */}
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Keyword Coverage</h3>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Match Rate</span>
                <span>{keywords.length > 0 ? Math.round((keywords.filter(k => k.present).length / keywords.length) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${keywords.length > 0 ? (keywords.filter(k => k.present).length / keywords.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {keywords.slice(0, 8).map((kw, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className={kw.present ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                    {kw.present ? '✓' : '○'} {kw.keyword}
                  </span>
                  {kw.occurrences > 0 && (
                    <span className="text-muted-foreground">×{kw.occurrences}</span>
                  )}
                </div>
              ))}
              {keywords.length > 8 && (
                <div className="text-xs text-muted-foreground">+{keywords.length - 8} more</div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {currentVersion.changes.map((change) => (
              <ChangeCard
                key={change.id}
                change={change}
                isAccepted={currentVersion.acceptedChanges?.includes(change.id) || false}
                isRejected={!currentVersion.acceptedChanges?.includes(change.id)}
                onAccept={() => handleAcceptChange(change.id)}
                onReject={() => handleRejectChange(change.id)}
                onHover={() => setHighlightedLineNumber(change.lineNumber)}
                onClick={() => setHighlightedLineNumber(change.lineNumber)}
              />
            ))}
          </div>
        </div>

        {/* PDF Preview (Conditional) */}
        {showPreview && (
          <CompilationPreview
            originalPdfUrl={originalPdfUrl}
            optimizedPdfUrl={optimizedPdfUrl}
            isVisible={showPreview}
            onToggle={() => setShowPreview(!showPreview)}
          />
        )}
      </div>

      {/* Footer: Action Bar */}
      <ActionBar
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
        onRefine={handleRefine}
        onExport={handleExport}
        onDownload={handleDownload}
        pendingCount={pendingCount}
        isCompiling={isCompiling}
      />
    </EditorLayout>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      }
    >
      <EditorPageContent />
    </Suspense>
  );
}
