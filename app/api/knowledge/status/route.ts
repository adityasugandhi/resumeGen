/**
 * GET /api/knowledge/status
 * Get index status and statistics
 */

import { NextResponse } from 'next/server';
import { getIndexingStatus, listProjectNames } from '@/lib/indexer';

export async function GET() {
  try {
    // Get index status from LanceDB
    const indexStatus = await getIndexingStatus();

    // Get list of available projects
    const availableProjects = await listProjectNames();

    // Calculate indexed vs available
    const indexedProjectNames = indexStatus.projectStats.map((p) => p.projectName);
    const unindexedProjects = availableProjects.filter(
      (p) => !indexedProjectNames.includes(p)
    );

    return NextResponse.json({
      success: true,
      status: {
        totalDocuments: indexStatus.totalDocuments,
        totalProjects: indexStatus.totalProjects,
        lastIndexedAt: indexStatus.lastIndexedAt,
        availableProjects: availableProjects.length,
        unindexedProjects: unindexedProjects.length,
      },
      projectStats: indexStatus.projectStats,
      unindexedProjects,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get index status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
