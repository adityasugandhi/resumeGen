import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ResumeOptimizer } from '@/lib/ai/resume-optimizer';
import { getCompanyH1bProfile } from '@/lib/goinglobal/h1b-intelligence';

export const runtime = 'nodejs';
export const maxDuration = 60; // Resume optimization can take longer

interface OptimizeRequest {
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobRequirements: string[];
  jobDescription?: string; // Fallback when requirements are empty
  gapAnalysis: string[];
  originalLatex: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      jobId,
      jobTitle,
      jobCompany,
      jobRequirements,
      jobDescription,
      gapAnalysis,
      originalLatex,
    }: OptimizeRequest = await request.json();

    // Validation
    if (!jobTitle || !jobCompany) {
      return NextResponse.json(
        { success: false, error: 'Job title and company are required' },
        { status: 400 }
      );
    }

    if (!originalLatex) {
      return NextResponse.json(
        { success: false, error: 'Original resume LaTeX is required' },
        { status: 400 }
      );
    }

    // If no requirements provided, try to extract from description or use a generic approach
    let effectiveRequirements = jobRequirements || [];
    if (effectiveRequirements.length === 0 && jobDescription) {
      // Use the description as a single requirement for AI to analyze
      effectiveRequirements = [`Based on job description: ${jobDescription.substring(0, 2000)}`];
    }

    if (effectiveRequirements.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Job requirements or description are required' },
        { status: 400 }
      );
    }


    // Fetch H1B salary context for the company (best-effort, don't block on failure)
    let h1bContext: string | undefined;
    try {
      const profile = await getCompanyH1bProfile(jobCompany);
      if (profile.totalPositions > 0) {
        const matchingRoles = profile.roles
          .filter((r) => r.title.toLowerCase().includes(jobTitle.toLowerCase().split(' ')[0]))
          .slice(0, 5);
        const roleList = matchingRoles.length > 0
          ? matchingRoles.map((r) => `${r.title} ($${r.wage.toLocaleString()})`).join(', ')
          : profile.roles.slice(0, 3).map((r) => `${r.title} ($${r.wage.toLocaleString()})`).join(', ');
        h1bContext = `${jobCompany} sponsors H1B visas with ${profile.totalPositions} positions and avg wage $${profile.avgWage.toLocaleString()}. Similar roles: ${roleList}`;
      }
    } catch {
      // H1B data is optional — continue without it
    }

    // Optimize resume using Claude
    const optimizer = new ResumeOptimizer();

    let result;
    try {
      result = await optimizer.optimizeResume(
        originalLatex,
        jobTitle,
        jobCompany,
        effectiveRequirements,
        gapAnalysis || [],
        h1bContext
      );
    } catch (error) {
      console.error('Failed to optimize resume:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to optimize resume with AI',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Create resume version object
    const resumeVersion = {
      id: uuidv4(),
      jobId,
      originalLatex,
      tailoredLatex: result.tailoredLatex,
      changes: result.changes,
      overallMatchScore: result.confidenceScore,
      createdAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      version: resumeVersion,
      summary: result.summary,
      message: `Resume optimized successfully with ${result.changes.length} improvements`,
    });
  } catch (error) {
    console.error('Unexpected error in resume optimization:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while optimizing the resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
