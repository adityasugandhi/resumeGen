/**
 * POST /api/knowledge/index
 * Trigger indexing of all projects
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  indexAllProjects,
  indexProject,
  reindexProject,
  clearIndex,
} from '@/lib/indexer';

export const maxDuration = 300; // 5 minutes max for indexing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action = 'index-all', projectName, projectPath } = body;

    let result;

    switch (action) {
      case 'index-all':
        // Index all projects
        console.log('Starting full index of all projects...');
        result = await indexAllProjects((progress) => {
          console.log(`[${progress.phase}] ${progress.message}`);
        });

        return NextResponse.json({
          success: true,
          action: 'index-all',
          ...result,
        });

      case 'index-project':
        // Index a single project by path
        if (!projectPath) {
          return NextResponse.json(
            { error: 'projectPath is required for index-project action' },
            { status: 400 }
          );
        }

        console.log(`Indexing project: ${projectPath}`);
        const docCount = await indexProject(projectPath, (progress) => {
          console.log(`[${progress.phase}] ${progress.message}`);
        });

        return NextResponse.json({
          success: true,
          action: 'index-project',
          projectPath,
          documentsIndexed: docCount,
        });

      case 'reindex-project':
        // Reindex a specific project by name
        if (!projectName) {
          return NextResponse.json(
            { error: 'projectName is required for reindex-project action' },
            { status: 400 }
          );
        }

        console.log(`Reindexing project: ${projectName}`);
        const reindexedCount = await reindexProject(projectName, (progress) => {
          console.log(`[${progress.phase}] ${progress.message}`);
        });

        return NextResponse.json({
          success: true,
          action: 'reindex-project',
          projectName,
          documentsIndexed: reindexedCount,
        });

      case 'clear':
        // Clear entire index
        console.log('Clearing entire index...');
        await clearIndex();

        return NextResponse.json({
          success: true,
          action: 'clear',
          message: 'Index cleared successfully',
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Indexing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform indexing operation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
