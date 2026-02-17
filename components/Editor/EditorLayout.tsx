'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IconButton } from '@/components/ui/Button';

interface EditorLayoutProps {
  children: React.ReactNode;
}

export default function EditorLayout({ children }: EditorLayoutProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-4">
          <IconButton
            icon={<ArrowLeft className="w-5 h-5" />}
            label="Back to jobs"
            onClick={() => router.push('/jobs')}
            variant="ghost"
          />
          <div>
            <h1 className="text-lg font-semibold">Resume Editor</h1>
            <p className="text-xs text-muted-foreground">
              Review and apply AI-generated resume improvements
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
