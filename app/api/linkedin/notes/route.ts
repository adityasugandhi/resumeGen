import { NextRequest, NextResponse } from 'next/server';
import { LinkedInNoteGenerator, LinkedInNoteParams } from '@/lib/ai/linkedin-note-generator';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personName, personRole, personCompany, jobTitle, jobCompany, jobRequirements, userBackground } = body;

    // Validate required fields
    if (!personName || typeof personName !== 'string' || personName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Person name is required' },
        { status: 400 }
      );
    }

    if (!jobTitle || typeof jobTitle !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Job title is required' },
        { status: 400 }
      );
    }

    if (!jobCompany || typeof jobCompany !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Job company is required' },
        { status: 400 }
      );
    }

    // Check for Groq API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Groq API key not configured. Please add GROQ_API_KEY to your environment.' },
        { status: 500 }
      );
    }

    // Prepare parameters
    const params: LinkedInNoteParams = {
      personName: personName.trim(),
      personRole: personRole?.trim() || undefined,
      personCompany: personCompany?.trim() || undefined,
      jobTitle: jobTitle.trim(),
      jobCompany: jobCompany.trim(),
      jobRequirements: Array.isArray(jobRequirements) ? jobRequirements.slice(0, 10) : undefined,
      userBackground: userBackground?.trim() || undefined,
    };

    // Generate LinkedIn note
    const generator = new LinkedInNoteGenerator();
    const result = await generator.generateConnectionNote(params);

    return NextResponse.json({
      success: true,
      note: result.note,
      variations: result.variations,
      charCount: result.charCount,
    });
  } catch (error) {
    console.error('Error generating LinkedIn note:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('No text response from Groq')) {
        return NextResponse.json(
          { success: false, error: 'AI service did not respond. Please try again.' },
          { status: 503 }
        );
      }
      if (error.message.includes('Could not extract valid JSON')) {
        return NextResponse.json(
          { success: false, error: 'Failed to parse AI response. Please try again.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate LinkedIn note',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
