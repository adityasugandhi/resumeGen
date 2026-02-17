'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface PDFViewerProps {
  pdfUrl: string;
}

export default function PDFViewer({ pdfUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById('pdf-container');
      if (container) {
        setContainerWidth(container.clientWidth - 32); // Subtract padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className={cn(
                'p-1.5 rounded transition-colors',
                pageNumber <= 1
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              title="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-sm">
              Page {pageNumber} of {numPages}
            </span>

            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className={cn(
                'p-1.5 rounded transition-colors',
                pageNumber >= numPages
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              title="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className={cn(
                'p-1.5 rounded transition-colors',
                scale <= 0.5
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              title="Zoom out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            <span className="text-sm min-w-[4rem] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className={cn(
                'p-1.5 rounded transition-colors',
                scale >= 3.0
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              title="Zoom in"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            <button
              onClick={resetZoom}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Reset zoom"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Display */}
      <div
        id="pdf-container"
        className="flex-1 overflow-auto scrollbar-thin bg-gray-100 dark:bg-gray-800 p-4"
      >
        <div className="flex justify-center">
          <div className="bg-white shadow-lg">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              }
              error={
                <div className="flex items-center justify-center p-8 text-red-600">
                  <p>Failed to load PDF</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                width={Math.min(containerWidth, 800)}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
}
