import { NextRequest, NextResponse } from 'next/server';
import { calculateJobResumeMatch, suggestImprovements } from '@/lib/ai/semantic-matcher';
import { MasterResume } from '@/lib/indexeddb';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface AnalyzeRequest {
  jobRequirements: string[];
  masterResume: MasterResume;
}

export async function POST(request: NextRequest) {
  try {
    const { jobRequirements, masterResume }: AnalyzeRequest = await request.json();

    if (!jobRequirements || jobRequirements.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Job requirements are required' },
        { status: 400 }
      );
    }

    if (!masterResume) {
      return NextResponse.json(
        { success: false, error: 'Master resume is required' },
        { status: 400 }
      );
    }

    // Prepare resume components for matching
    const resumeComponents = {
      experiences: masterResume.experiences.map(
        (exp) =>
          `${exp.title} at ${exp.company}: ${exp.bullets.join('. ')}`
      ),
      skills: [
        ...masterResume.skills.technical,
        ...masterResume.skills.soft,
        ...masterResume.skills.tools,
      ],
      projects: masterResume.projects?.map(
        (proj) =>
          `${proj.name}: ${proj.description}. Technologies: ${proj.technologies.join(', ')}`
      ),
    };

    // Calculate semantic match
    const matchResult = await calculateJobResumeMatch(
      jobRequirements,
      resumeComponents
    );

    // Generate improvement suggestions
    const suggestions = suggestImprovements(
      matchResult.requirementMatches,
      matchResult.gaps
    );

    return NextResponse.json({
      success: true,
      analysis: {
        overallScore: matchResult.overallScore,
        requirementMatches: matchResult.requirementMatches,
        gaps: matchResult.gaps,
        suggestions,
        strengths: matchResult.requirementMatches
          .filter((m) => m.score >= 0.75)
          .map((m) => m.requirement),
        weaknesses: matchResult.requirementMatches
          .filter((m) => m.score < 0.5)
          .map((m) => m.requirement),
      },
    });
  } catch (error) {
    console.error('Error analyzing job match:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze job match',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
