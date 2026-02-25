'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Wrench,
  SkipForward,
  RotateCcw,
  MessageSquarePlus,
  Send
} from 'lucide-react';
import { InterventionAction } from '@/lib/ai/agent/types';

interface AgentInterventionPanelProps {
  streamId: string;
  tool: string;
  error: string;
  onRespond: (streamId: string, action: InterventionAction, prompt?: string) => void;
}

export function AgentInterventionPanel({
  streamId,
  tool,
  error,
  onRespond
}: AgentInterventionPanelProps) {
  const [countdown, setCountdown] = useState(30);
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editPromptValue, setEditPromptValue] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRespond(streamId, 'auto_fix');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [streamId, onRespond]);

  const handleAction = (action: InterventionAction) => {
    if (action === 'edit_prompt') {
      setShowEditPrompt(true);
    } else {
      onRespond(streamId, action);
    }
  };

  const handleSubmitPrompt = () => {
    if (editPromptValue.trim()) {
      onRespond(streamId, 'edit_prompt', editPromptValue);
    }
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-amber-900 dark:text-amber-100">
            Intervention Required
          </span>
        </div>
        <span className="text-sm text-amber-700 dark:text-amber-300">
          Auto-fix in {countdown}s
        </span>
      </div>

      {/* Error Info */}
      <div className="mb-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            {tool}
          </span>
          <p className="line-clamp-2 flex-1 text-sm text-amber-800 dark:text-amber-200">
            {error}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction('auto_fix')}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:bg-amber-600 dark:hover:bg-amber-700 dark:focus:ring-amber-400"
        >
          <Wrench className="h-4 w-4" />
          Auto-Fix
        </button>

        <button
          onClick={() => handleAction('skip')}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          <SkipForward className="h-4 w-4" />
          Skip
        </button>

        <button
          onClick={() => handleAction('retry')}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>

        <button
          onClick={() => handleAction('edit_prompt')}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Edit Prompt
        </button>
      </div>

      {/* Edit Prompt Textarea */}
      {showEditPrompt && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-3 space-y-2"
        >
          <textarea
            value={editPromptValue}
            onChange={(e) => setEditPromptValue(e.target.value)}
            placeholder="Provide additional context for the code agent..."
            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm placeholder-amber-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100 dark:placeholder-amber-500"
            rows={3}
          />
          <button
            onClick={handleSubmitPrompt}
            disabled={!editPromptValue.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-amber-600 dark:hover:bg-amber-700 dark:focus:ring-amber-400"
          >
            <Send className="h-4 w-4" />
            Submit
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}