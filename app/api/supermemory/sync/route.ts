/**
 * SuperMemory Sync API Route
 *
 * Handles synchronization requests from the client:
 * - POST /api/supermemory/sync - Perform full sync
 * - GET /api/supermemory/sync - Check sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { memoryService } from '@/lib/supermemory/service';
import { syncAll } from '@/lib/supermemory/sync';
import type { SyncResult } from '@/lib/supermemory/types';

// ============================================
// POST - Perform Full Sync
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check if SuperMemory is enabled
    if (!memoryService.isEnabled()) {
      return NextResponse.json(
        {
          success: false,
          error: 'SuperMemory is not configured. Please add SUPERMEMORY_API_KEY to your environment variables.',
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      );
    }


    // Perform sync
    const result: SyncResult = await syncAll(userId);

    // Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        result: {
          operationsCompleted: result.operationsCompleted,
          operationsFailed: result.operationsFailed,
          duration: result.duration,
        },
      });
    } else {
      console.error(
        `[API /api/supermemory/sync] Sync completed with errors: ${result.operationsFailed} failed`
      );
      return NextResponse.json(
        {
          success: false,
          error: `Sync completed with ${result.operationsFailed} errors`,
          result: {
            operationsCompleted: result.operationsCompleted,
            operationsFailed: result.operationsFailed,
            errors: result.errors.map(e => e.error),
            duration: result.duration,
          },
        },
        { status: 207 } // Multi-Status
      );
    }
  } catch (error) {
    console.error('[API /api/supermemory/sync] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Check Sync Status
// ============================================

export async function GET(_request: NextRequest) {
  try {
    // Check if SuperMemory is enabled
    const isEnabled = memoryService.isEnabled();

    // Test connection if enabled
    let isConnected = false;
    if (isEnabled) {
      isConnected = await memoryService.testConnection();
    }

    return NextResponse.json({
      success: true,
      status: {
        enabled: isEnabled,
        connected: isConnected,
        message: isEnabled
          ? isConnected
            ? 'SuperMemory is ready'
            : 'SuperMemory is configured but connection failed'
          : 'SuperMemory is not configured',
      },
    });
  } catch (error) {
    console.error('[API /api/supermemory/sync GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
