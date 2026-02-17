'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/Button';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface CompilationPreviewProps {
  originalPdfUrl?: string;
  optimizedPdfUrl?: string;
  isVisible: boolean;
  onToggle: () => void;
}

export default function CompilationPreview({
  originalPdfUrl,
  optimizedPdfUrl,
  isVisible,
  onToggle,
}: CompilationPreviewProps) {
  const [originalNumPages, setOriginalNumPages] = useState<number>(0);
  const [optimizedNumPages, setOptimizedNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(400);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById('preview-container');
      if (container) {
        const width = isExpanded ? container.clientWidth : container.clientWidth / 2;
        setContainerWidth(width - 32); // Subtract padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isExpanded]);

  if (!isVisible) {
    return null;
  }

  const maxPages = Math.max(originalNumPages, optimizedNumPages);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, maxPages));
  };

  return (
    <div
      id="preview-container"
      className={cn(
        'border-l border-border bg-surface flex flex-col transition-all duration-300',
        isExpanded ? 'w-full' : 'w-1/2'
      )}
    >
      {/* Header */}
      <div className="border-b border-border bg-white dark:bg-gray-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-sm">PDF Preview</h3>
            {maxPages > 0 && (
              <div className="flex items-center gap-2">
                <IconButton
                  icon={<ChevronLeft className="w-4 h-4" />}
                  label="Previous page"
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  variant="ghost"
                />
                <span className="text-xs text-muted-foreground min-w-[4rem] text-center">
                  Page {pageNumber} of {maxPages}
                </span>
                <IconButton
                  icon={<ChevronRight className="w-4 h-4" />}
                  label="Next page"
                  onClick={goToNextPage}
                  disabled={pageNumber >= maxPages}
                  variant="ghost"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              icon={isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              label={isExpanded ? 'Minimize' : 'Maximize'}
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
            />
            <IconButton
              icon={<X className="w-4 h-4" />}
              label="Close preview"
              onClick={onToggle}
              variant="ghost"
            />
          </div>
        </div>
      </div>

      {/* PDF Display */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800">
        <div className={cn('grid gap-4 p-4', isExpanded ? 'grid-cols-1' : 'grid-cols-2')}>
          {/* Original PDF */}
          {originalPdfUrl && (
            <div className="flex flex-col">
              <div className="mb-2 px-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Original Resume
                </h4>
              </div>
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <Document
                  file={originalPdfUrl}
                  onLoadSuccess={({ numPages }) => setOriginalNumPages(numPages)}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-8 text-red-600">
                      <p className="text-sm">Failed to load original PDF</p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={Math.min(pageNumber, originalNumPages)}
                    width={Math.min(containerWidth, 600)}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
            </div>
          )}

          {/* Optimized PDF */}
          {optimizedPdfUrl && (
            <div className="flex flex-col">
              <div className="mb-2 px-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Optimized Resume
                </h4>
              </div>
              <div className="bg-white shadow-lg rounded-lg overflow-hidden ring-2 ring-emerald-500">
                <Document
                  file={optimizedPdfUrl}
                  onLoadSuccess={({ numPages }) => setOptimizedNumPages(numPages)}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600" />
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center p-8 text-red-600">
                      <p className="text-sm">Failed to load optimized PDF</p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={Math.min(pageNumber, optimizedNumPages)}
                    width={Math.min(containerWidth, 600)}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
