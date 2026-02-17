import { NextRequest, NextResponse } from 'next/server';
import { getResumeVersion } from '@/lib/indexeddb';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Version ID is required' },
        { status: 400 }
      );
    }

    const version = await getResumeVersion(id);

    if (!version) {
      return NextResponse.json(
        { success: false, error: 'Resume version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      version,
    });
  } catch (error) {
    console.error('Error fetching resume version:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch resume version',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
