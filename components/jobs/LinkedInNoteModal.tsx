'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Linkedin,
  User,
  Briefcase,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';

interface JobPosting {
  id: string;
  title: string;
  company: string;
  requirements: string[];
}

interface LinkedInNoteModalProps {
  job: JobPosting;
  isOpen: boolean;
  onClose: () => void;
  userBackground?: string;
}

interface GeneratedNote {
  note: string;
  variations: string[];
  charCount: number;
}

export default function LinkedInNoteModal({
  job,
  isOpen,
  onClose,
  userBackground,
}: LinkedInNoteModalProps) {
  const [personName, setPersonName] = useState('');
  const [personRole, setPersonRole] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<GeneratedNote | null>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!personName.trim()) {
      setError('Please enter the person\'s name');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/linkedin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName: personName.trim(),
          personRole: personRole.trim() || undefined,
          personCompany: job.company,
          jobTitle: job.title,
          jobCompany: job.company,
          jobRequirements: job.requirements,
          userBackground,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate note');
      }

      setGeneratedNote({
        note: data.note,
        variations: data.variations,
        charCount: data.charCount,
      });
      setSelectedNoteIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate note');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (index: number) => {
    const note = index === 0 ? generatedNote?.note : generatedNote?.variations[index - 1];
    if (!note) return;

    await navigator.clipboard.writeText(note);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getAllNotes = (): string[] => {
    if (!generatedNote) return [];
    return [generatedNote.note, ...generatedNote.variations];
  };

  const handleClose = () => {
    setPersonName('');
    setPersonRole('');
    setGeneratedNote(null);
    setSelectedNoteIndex(0);
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header gradient */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700" />

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                    <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Generate LinkedIn Note
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      For {job.title} at {job.company}
                    </p>
                  </div>
                </div>
                <IconButton
                  icon={<X className="w-5 h-5" />}
                  label="Close"
                  variant="ghost"
                  onClick={handleClose}
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Person Name Input */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4" />
                  Person&apos;s Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g., Andrew Stein"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Person Role Input */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Briefcase className="w-4 h-4" />
                  Their Role/Headline (Optional)
                </label>
                <input
                  type="text"
                  value={personRole}
                  onChange={(e) => setPersonRole(e.target.value)}
                  placeholder="e.g., Senior Software Engineer at Delta"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Generate Button */}
              {!generatedNote && (
                <Button
                  variant="primary"
                  className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-400 hover:via-blue-500 hover:to-blue-600 shadow-blue-500/25 hover:shadow-blue-500/30"
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                  disabled={!personName.trim()}
                >
                  {isGenerating ? 'Generating...' : 'Generate Note'}
                </Button>
              )}

              {/* Generated Notes */}
              {generatedNote && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Note Selection Tabs */}
                  <div className="flex gap-2">
                    {getAllNotes().map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedNoteIndex(index)}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                          ${selectedNoteIndex === index
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }
                        `}
                      >
                        {index === 0 ? 'Primary' : `Variation ${index}`}
                      </button>
                    ))}
                  </div>

                  {/* Selected Note Display */}
                  <div className="relative">
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                        {getAllNotes()[selectedNoteIndex]}
                      </p>
                    </div>
                    {/* Character Count */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`
                        font-medium
                        ${getAllNotes()[selectedNoteIndex]?.length > 300
                          ? 'text-red-500'
                          : getAllNotes()[selectedNoteIndex]?.length > 280
                          ? 'text-yellow-500'
                          : 'text-green-500'
                        }
                      `}>
                        {getAllNotes()[selectedNoteIndex]?.length || 0}/300 characters
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        LinkedIn limit: 300 chars
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      leftIcon={<RefreshCw className="w-4 h-4" />}
                      onClick={handleGenerate}
                      isLoading={isGenerating}
                    >
                      Regenerate
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-400 hover:via-blue-500 hover:to-blue-600 shadow-blue-500/25 hover:shadow-blue-500/30"
                      leftIcon={
                        copiedIndex === selectedNoteIndex
                          ? <Check className="w-4 h-4" />
                          : <Copy className="w-4 h-4" />
                      }
                      onClick={() => handleCopy(selectedNoteIndex)}
                    >
                      {copiedIndex === selectedNoteIndex ? 'Copied!' : 'Copy to Clipboard'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
