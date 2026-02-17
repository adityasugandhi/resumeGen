'use client';

import React from 'react';
import EditorExample from '@/components/Editor/EditorExample';

/**
 * Demo page for the AI Resume Editor components
 *
 * Navigate to /editor-demo to see the full editor layout in action
 *
 * Features demonstrated:
 * - Full-screen 3-section layout
 * - Side-by-side diff visualization
 * - Synchronized scrolling
 * - Character-level change highlighting
 * - View mode toggling (Source/Preview/Diff)
 * - Change tracking sidebar
 * - Accept/Reject/Reset actions
 */
export default function EditorDemoPage() {
  return <EditorExample />;
}
