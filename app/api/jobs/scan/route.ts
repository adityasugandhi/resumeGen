import { load } from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { JobParser } from '@/lib/ai/job-parser';
import { generateEmbedding } from '@/lib/ai/semantic-matcher';
import { scrapeJobPage } from '@/lib/browser-scraper';

export const runtime = 'nodejs';
export const maxDuration = 60; // Job scanning can take longer

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Job URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }


    // Fetch job posting HTML (uses smart scraper with Playwright fallback for JS pages)
    let html: string;
    let scrapeMethod: 'static' | 'browser';
    try {
      const result = await scrapeJobPage(url);
      html = result.html;
      scrapeMethod = result.method;
      console.log(`[job-scan] Scraped ${url} using ${scrapeMethod} method`);
    } catch (error) {
      console.error('Failed to fetch job URL:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch job posting. The URL may be invalid or blocked.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Extract text content using cheerio
    const $ = load(html);

    // Remove script and style tags
    $('script, style, nav, header, footer, aside').remove();

    // Only remove very specific privacy/legal elements (be conservative)
    // Don't use wildcards to avoid catching job-related content
    $('#privacy-policy, #cookie-policy, #legal-notice').remove();
    $('[aria-label="Privacy Policy"], [aria-label="Cookie Policy"]').remove();

    // Remove obvious standalone privacy links/sections (must be very short and specific)
    $('a, div, section, p').each((_, elem) => {
      const text = $(elem).text().toLowerCase().trim();
      // Only remove if it's JUST a privacy policy link (< 50 chars, contains specific text)
      if (text.length < 50 && text.length > 0 && (
        text === 'privacy policy' ||
        text === 'cookie policy' ||
        text === 'do not sell my personal information' ||
        text === 'your privacy choices'
      )) {
        $(elem).remove();
      }
    });

    // Get main content (prioritize job description containers)
    const mainSelectors = [
      // Highest priority: job-specific
      '[class*="job-description"]',
      '[id*="job-description"]',
      '[class*="job-details"]',
      '[id*="job-details"]',
      '[class*="job-posting"]',
      '[data-section="job-details"]',

      // Medium priority: semantic
      '[role="article"]',
      'main article',
      'main',
      '[role="main"]',
      'article',

      // Low priority: generic (must have headings)
      '.content:has(h1, h2)',
    ];

    let content = '';
    let selectedSelector = 'none';
    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        selectedSelector = selector;
        console.log(`[job-scan] Selected selector: ${selector}, content length: ${content.length}`);
        break;
      }
    }

    // Fallback to body if no main content found
    if (!content || content.length < 200) {
      content = $('body').text();
      selectedSelector = 'body (fallback)';
      console.log(`[job-scan] Using fallback body, content length: ${content.length}`);
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();
    console.log(`[job-scan] Final content length after cleanup: ${content.length}, first 200 chars: ${content.substring(0, 200)}`);

    if (!content || content.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract meaningful content from the job posting. The page may require authentication or use dynamic content loading.',
        },
        { status: 500 }
      );
    }


    // Parse job data using Claude
    const parser = new JobParser();
    let jobData;

    try {
      jobData = await parser.parseJobPosting(content, url);
    } catch (error) {
      console.error('Failed to parse job data:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse job posting with AI. The content may be incomplete or malformed.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Validate extracted job data isn't privacy policy
    const hasValidTitle = jobData.title &&
      jobData.title !== 'Not specified' &&
      !jobData.title.toLowerCase().includes('privacy');

    const hasValidDescription = jobData.description &&
      jobData.description.length > 100 &&
      !jobData.description.toLowerCase().includes('we collect your personal information');

    const hasRequirements = jobData.requirements && jobData.requirements.length > 0;

    // Only reject if we're confident it's NOT a job posting
    // (missing title AND no requirements) OR (description is clearly privacy policy)
    if ((!hasValidTitle && !hasRequirements) ||
        (jobData.description.toLowerCase().includes('we collect your personal information') &&
         jobData.description.length < 500)) {
      console.log('[job-scan] Validation failed:', {
        hasValidTitle,
        hasValidDescription,
        hasRequirements,
        titleLength: jobData.title?.length,
        descriptionLength: jobData.description?.length,
        requirementsCount: jobData.requirements?.length
      });
      return NextResponse.json(
        {
          success: false,
          error: 'The URL appears to contain privacy policy content rather than a job posting. Please verify the URL points to an actual job description.',
        },
        { status: 422 }
      );
    }

    // Generate embedding for semantic search
    // Combine requirements for embedding
    const requirementsText = jobData.requirements.join(' ');
    let embedding: number[];

    try {
      embedding = await generateEmbedding(requirementsText);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Continue without embedding (will have limited matching capabilities)
      embedding = [];
    }

    // Create job posting object
    const jobPosting = {
      id: uuidv4(),
      url,
      title: jobData.title,
      company: jobData.company,
      location: jobData.location,
      salary: jobData.salary,
      employmentType: jobData.employmentType,
      description: jobData.description,
      requirements: jobData.requirements,
      responsibilities: jobData.responsibilities,
      qualifications: jobData.qualifications,
      embedding,
      status: 'scanned' as const,
      createdAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      job: jobPosting,
      scrapeMethod,
      message: `Successfully scanned job: ${jobData.title} at ${jobData.company}`,
    });
  } catch (error) {
    console.error('Unexpected error in job scan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while scanning the job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
