import { Stagehand, AISdkClient } from '@browserbasehq/stagehand';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { v4 as uuidv4 } from 'uuid';
import type { CareerJob, CareerPlatform } from '../types';
import type { AgentStepEvent } from '@/lib/ai/agent/types';
import { parseAtsUrl } from '../ats-detector';
import { registerCompanyFromUrl } from '../company-discovery';
import { flareSolve, isFlareSolverrAvailable } from './flaresolverr-client';
import { findCareersUrl } from './search-orchestrator';

export interface ExplorationResult {
  company: string;
  careersUrl: string;
  platform: CareerPlatform;
  jobs: CareerJob[];
  totalFound: number;
  pagesExplored: number;
  boardToken?: string;
  registeredInDb: boolean;
}

export interface ExploreOptions {
  maxPages?: number;        // Default 5
  engineeringOnly?: boolean; // Default true
  careersUrl?: string;      // Optional known careers URL to start from
  onEvent?: (event: AgentStepEvent) => void;
}

// Engineering-related keywords for filtering (reused from run-pipeline.ts)
const ENGINEERING_KEYWORDS = [
  'software', 'engineer', 'engineering', 'developer', 'frontend',
  'backend', 'full stack', 'fullstack', 'full-stack', 'devops',
  'sre', 'infrastructure', 'platform', 'data engineer', 'ml engineer',
  'machine learning', 'ai engineer', 'systems engineer', 'cloud',
  'security engineer', 'mobile engineer', 'ios engineer', 'android',
  'qa engineer', 'test engineer', 'reliability',
];

export class CareerExplorerAgent {
  private stagehand: Stagehand | null = null;

  async explore(companyName: string, options: ExploreOptions = {}): Promise<ExplorationResult> {
    const { maxPages = 5, engineeringOnly = true, onEvent } = options;
    let pagesExplored = 0;
    let careersUrl = options.careersUrl || '';
    let detectedPlatform: CareerPlatform = 'unknown';
    let boardToken: string | undefined;
    let allJobs: CareerJob[] = [];
    let registeredInDb = false;

    try {
      // Initialize Stagehand — priority: OpenRouter→Haiku (fastest for extract),
      // then Bedrock→Sonnet, then Groq (act/observe only, no extract)
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
      const groqKey = process.env.GROQ_API_KEY;
      let usesClaude = false;

      const browserOpts = {
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      };

      if (openRouterKey) {
        // OpenRouter has lower latency than Bedrock for Stagehand operations
        this.stagehand = new Stagehand({
          env: 'LOCAL',
          model: {
            modelName: 'anthropic/claude-sonnet-4-6',
            apiKey: openRouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
          },
          verbose: 0,
          localBrowserLaunchOptions: browserOpts,
        });
        usesClaude = true;
      } else if (bedrockToken) {
        const region = process.env.BEDROCK_AWS_REGION ?? 'us-east-1';
        const bedrockProvider = createAmazonBedrock({
          region,
          apiKey: bedrockToken,
        });
        const bedrockClient = new AISdkClient({
          model: bedrockProvider('us.anthropic.claude-3-5-sonnet-20241022-v2:0'),
        });
        this.stagehand = new Stagehand({
          env: 'LOCAL',
          llmClient: bedrockClient,
          verbose: 0,
          localBrowserLaunchOptions: browserOpts,
        });
        usesClaude = true;
      } else if (groqKey) {
        this.stagehand = new Stagehand({
          env: 'LOCAL',
          model: {
            modelName: 'groq/llama-3.3-70b-versatile',
            apiKey: groqKey,
          },
          verbose: 0,
          localBrowserLaunchOptions: browserOpts,
        });
      } else {
        throw new Error('No LLM API key available (need OPENROUTER_API_KEY, AWS_BEARER_TOKEN_BEDROCK, or GROQ_API_KEY)');
      }

      await this.stagehand.init();
      onEvent?.({ type: 'browser_action', action: 'init', element: `Browser launched for ${companyName}` });

      // Step 1: Find the careers page via multi-engine search orchestrator
      if (!careersUrl) {
        onEvent?.({ type: 'browser_action', action: 'search', element: `Searching for ${companyName} careers page...` });
        const searchResult = await findCareersUrl(companyName);
        careersUrl = searchResult.url;
        pagesExplored++;

        if (careersUrl) {
          onEvent?.({ type: 'browser_action', action: 'found', element: `Found via ${searchResult.source} (${searchResult.confidence}): ${careersUrl}` });
        }
      }

      if (!careersUrl) {
        return {
          company: companyName,
          careersUrl: '',
          platform: 'unknown',
          jobs: [],
          totalFound: 0,
          pagesExplored,
          registeredInDb: false,
        };
      }

      onEvent?.({ type: 'browser_action', action: 'navigate', element: careersUrl });

      // Navigate to careers page
      const page = this.stagehand.context.pages()[0];
      await page.goto(careersUrl, { waitUntil: 'networkidle', timeoutMs: 20000 }).catch(() =>
        page.goto(careersUrl, { waitUntil: 'domcontentloaded', timeoutMs: 15000 })
      );
      await new Promise(r => setTimeout(r, 2000)); // Wait for dynamic content
      pagesExplored++;

      // Dismiss cookie consent banners (common on EU-compliant career sites)
      await this.dismissCookieConsent();

      // Step 2: Detect ATS type from the page URL
      const pageUrl = page.url();
      const atsDetection = this.detectAtsFromUrl(pageUrl);
      if (atsDetection) {
        detectedPlatform = atsDetection.platform;
        boardToken = atsDetection.boardToken;
        careersUrl = atsDetection.careersUrl;

        onEvent?.({ type: 'browser_action', action: 'ats_detected', element: `${detectedPlatform} (token: ${boardToken})` });

        try {
          const regResult = await registerCompanyFromUrl(companyName, careersUrl);
          registeredInDb = regResult.status === 'registered';
        } catch {
          // Best effort
        }

        return {
          company: companyName,
          careersUrl,
          platform: detectedPlatform,
          jobs: [],
          totalFound: 0,
          pagesExplored,
          boardToken,
          registeredInDb,
        };
      }

      // Also try to detect ATS from page content (iframes, links)
      try {
        const atsFromPage = await this.detectAtsFromPageContent();
        if (atsFromPage) {
          detectedPlatform = atsFromPage.platform;
          boardToken = atsFromPage.boardToken;

          try {
            const regResult = await registerCompanyFromUrl(companyName, atsFromPage.careersUrl);
            registeredInDb = regResult.status === 'registered';
          } catch { /* best effort */ }

          return {
            company: companyName,
            careersUrl: atsFromPage.careersUrl,
            platform: detectedPlatform,
            jobs: [],
            totalFound: 0,
            pagesExplored,
            boardToken,
            registeredInDb,
          };
        }
      } catch {
        // Continue with FlareSolverr fallback or generic extraction
      }

      // Fallback: If page detection failed, try FlareSolverr to get raw HTML
      try {
        const flareAvailable = await isFlareSolverrAvailable();
        if (flareAvailable) {
          const flareResult = await flareSolve(careersUrl, 30000);
          const atsFromHtml = this.detectAtsFromHtml(flareResult.html);
          if (atsFromHtml) {
            detectedPlatform = atsFromHtml.platform;
            boardToken = atsFromHtml.boardToken;

            onEvent?.({ type: 'browser_action', action: 'ats_detected', element: `${detectedPlatform} via FlareSolverr (token: ${boardToken})` });

            try {
              const regResult = await registerCompanyFromUrl(companyName, atsFromHtml.careersUrl);
              registeredInDb = regResult.status === 'registered';
            } catch { /* best effort */ }

            return {
              company: companyName,
              careersUrl: atsFromHtml.careersUrl,
              platform: detectedPlatform,
              jobs: [],
              totalFound: 0,
              pagesExplored,
              boardToken,
              registeredInDb,
            };
          }
        }
      } catch {
        // Continue with generic extraction
      }

      // Step 3: Try to navigate from landing page to actual job listings
      detectedPlatform = 'custom';

      // 3a: Try to find a job search link from the page HTML
      const jobSearchUrl = await this.findJobSearchLink(page, companyName);
      if (jobSearchUrl && jobSearchUrl !== careersUrl) {
        try {
          await page.goto(jobSearchUrl, { waitUntil: 'domcontentloaded', timeoutMs: 15000 });
          await new Promise(r => setTimeout(r, 2000));
          careersUrl = page.url();
          pagesExplored++;
          onEvent?.({ type: 'browser_action', action: 'navigate', element: `Found job search page: ${careersUrl}` });

          // Re-check for ATS after navigation
          const atsAfterNav = this.detectAtsFromUrl(careersUrl);
          if (atsAfterNav) {
            try {
              const regResult = await registerCompanyFromUrl(companyName, atsAfterNav.careersUrl);
              registeredInDb = regResult.status === 'registered';
            } catch { /* best effort */ }
            return {
              company: companyName,
              careersUrl: atsAfterNav.careersUrl,
              platform: atsAfterNav.platform,
              jobs: [],
              totalFound: 0,
              pagesExplored,
              boardToken: atsAfterNav.boardToken,
              registeredInDb,
            };
          }
        } catch {
          // Navigation failed, continue with current page
        }
      }

      // 3b: Fallback - try Stagehand act() to click a search button
      if (!jobSearchUrl) {
        try {
          const urlBefore = page.url();
          await Promise.race([
            this.stagehand.act(
              'Look for and click a "Search Jobs", "View All Jobs", "Open Positions", "Browse Jobs", "See all roles", "Search open positions", "Find jobs", or similar link/button that leads to the job listings or search page'
            ),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('act() timeout')), 15000)),
          ]);
          await new Promise(r => setTimeout(r, 3000));
          pagesExplored++;
          const urlAfter = page.url();
          if (urlAfter !== urlBefore) {
            careersUrl = urlAfter;
          }
          onEvent?.({ type: 'browser_action', action: 'navigate', element: `Navigated to: ${careersUrl}` });
        } catch {
          // No "search jobs" button found, try extracting from current page
        }
      }

      // Step 4: Extract jobs from the page
      for (let pageNum = 0; pageNum < maxPages; pageNum++) {
        const currentPageUrl = page.url();
        onEvent?.({ type: 'browser_action', action: 'extract', element: `Page ${pageNum + 1}: ${currentPageUrl}` });

        // Wait for dynamic content to render
        await new Promise(r => setTimeout(r, 4000));

        let extractedJobs: { title: string; location?: string | null; team?: string | null; url: string }[] = [];

        // Strategy 1: DOM extraction (most reliable for SPAs)
        try {
          extractedJobs = await this.extractJobsFromDom(page, companyName);
        } catch {
          // DOM extraction failed
        }

        // Strategy 2: Stagehand extract() with Zod schema (works with Claude via Bedrock or OpenRouter)
        if (extractedJobs.length === 0 && usesClaude) {
          try {
            extractedJobs = await this.extractJobsViaStagehand(companyName);
          } catch {
            // Stagehand extract failed
          }
        }

        // Strategy 3: Get page HTML and use Groq for structured extraction
        if (extractedJobs.length === 0) {
          try {
            const pageHtml = await page.evaluate(() => document.documentElement.outerHTML) as string;
            extractedJobs = await this.extractJobsFromHtml(pageHtml, currentPageUrl, companyName);
          } catch (extractErr) {
            console.warn(`[explorer] HTML extraction failed, trying FlareSolverr:`, (extractErr as Error).message);

            // Strategy 4: FlareSolverr fallback
            try {
              extractedJobs = await this.extractJobsViaLlm(currentPageUrl, companyName);
            } catch (llmErr) {
              console.warn(`[explorer] All extraction failed on page ${pageNum + 1}:`, (llmErr as Error).message);
              break;
            }
          }
        }

        if (extractedJobs.length > 0) {
          const baseUrl = new URL(currentPageUrl);
          const newJobs: CareerJob[] = extractedJobs.map(j => ({
            id: uuidv4(),
            title: this.cleanJobTitle(j.title),
            location: j.location || 'Not specified',
            team: j.team || '',
            url: j.url.startsWith('http') ? j.url : new URL(j.url, baseUrl.origin).toString(),
            company: companyName,
            platform: detectedPlatform,
            updatedAt: Date.now(),
          }));
          allJobs.push(...newJobs);
        } else {
          break; // No more jobs on this page
        }

        // Try to find and click "Next" / "Load More" / "Show More"
        if (pageNum < maxPages - 1) {
          const hasMore = await this.tryNextPage();
          pagesExplored++;
          if (!hasMore) break;
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Deduplicate jobs by URL
      const seenUrls = new Set<string>();
      allJobs = allJobs.filter(job => {
        if (seenUrls.has(job.url)) return false;
        seenUrls.add(job.url);
        return true;
      });

      // Filter to engineering roles if requested
      if (engineeringOnly && allJobs.length > 0) {
        allJobs = allJobs.filter(job => {
          const title = job.title.toLowerCase();
          const team = job.team.toLowerCase();
          return ENGINEERING_KEYWORDS.some(kw => title.includes(kw) || team.includes(kw));
        });
      }

      // Register the company in DB
      if (allJobs.length > 0) {
        try {
          const { createCompany } = await import('@/lib/db/queries/companies');
          await createCompany({
            name: companyName,
            platform: 'custom',
            boardToken: companyName.toLowerCase().replace(/\s+/g, '-'),
            careersUrl,
          });
          registeredInDb = true;
        } catch {
          try {
            const { updateCompany } = await import('@/lib/db/queries/companies');
            await updateCompany(companyName, {
              platform: 'custom' as CareerPlatform,
              careersUrl,
              isActive: true,
            });
            registeredInDb = true;
          } catch { /* best effort */ }
        }
      }

      return {
        company: companyName,
        careersUrl,
        platform: detectedPlatform,
        jobs: allJobs,
        totalFound: allJobs.length,
        pagesExplored,
        boardToken,
        registeredInDb,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Find the company's careers page using the multi-engine search orchestrator.
   * Falls back to FlareSolverr Google search if all engines fail.
   */
  private async findCareersPage(companyName: string): Promise<string> {
    const result = await findCareersUrl(companyName);
    return result.url;
  }

  /**
   * Extract job listings directly from the DOM by finding links that look like job postings.
   * This is the most reliable strategy for SPAs with large DOMs.
   */
  private async extractJobsFromDom(
    page: { evaluate: (fn: () => unknown) => Promise<unknown> },
    _companyName: string
  ): Promise<{ title: string; location?: string | null; team?: string | null; url: string }[]> {
    const rawJobs = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));

      // Common URL patterns for individual job postings
      const jobUrlPatterns = [
        /\/details\//, /\/job\//, /\/jobs\//, /\/position\//,
        /\/opening\//, /\/posting\//, /\/apply\//, /\/careers\/.*\d/,
        /greenhouse\.io\/.*\/jobs\//, /lever\.co\/.*\/[a-f0-9-]+/,
        /ashbyhq\.com\/.*\/[a-f0-9-]+/,
        // Workday patterns
        /myworkdayjobs\.com\/.*\/job\//, /wd\d+\.myworkdayjobs\.com/,
        // iCIMS patterns
        /icims\.com\/.*\/job\//, /jobs-.*\.icims\.com/,
        // Taleo patterns
        /taleo\.net\/.*\/requisition/, /oraclecloud\.com\/.*\/job/,
        // SmartRecruiters
        /smartrecruiters\.com\/.*\//, /jobs\.smartrecruiters\.com/,
        // Jobvite
        /jobvite\.com\/.*\/job/,
        // SuccessFactors (SAP)
        /successfactors.*\/job\//, /\/go\/.*\/\d+/,
        // Generic patterns
        /\/requisition\//, /\/vacancy\//, /\/role\//, /\/jobdetail\//,
      ];

      const seen = new Set<string>();
      const jobs: { title: string; url: string; location: string | null; team: string | null }[] = [];

      for (const anchor of anchors) {
        const a = anchor as HTMLAnchorElement;
        const href = a.href;
        const text = a.textContent?.trim();

        if (!href || !text || text.length < 5 || text.length > 200) continue;
        if (href === '#' || href.startsWith('javascript:')) continue;

        // Check if this looks like a job posting link
        const isJobUrl = jobUrlPatterns.some(p => p.test(href));
        if (!isJobUrl) continue;

        // Skip duplicate URLs and navigation links
        if (seen.has(href)) continue;
        seen.add(href);

        // Skip links that are just "See full description", "Apply", etc.
        if (/^(see|view|apply|learn more|read more|sign in|log in|back)/i.test(text)) continue;

        // Try to find location from nearby elements
        const row = a.closest('tr, li, [class*="job"], [class*="result"], [class*="posting"], [class*="card"], [class*="listing"], [class*="position"], [role="listitem"], article');
        let location: string | null = null;
        let team: string | null = null;

        if (row) {
          const cells = row.querySelectorAll('td, span, div, p, small');
          for (const cell of cells) {
            const cellText = cell.textContent?.trim() || '';
            if (cellText === text) continue;
            // Skip if it's a child of the anchor (avoids concatenated title+location)
            if (a.contains(cell)) continue;
            if (cellText.length > 5 && cellText.length < 100) {
              if (/(?:remote|hybrid|onsite|usa|united states|california|new york|seattle|austin|san francisco|cupertino|mountain view|chicago|boston|denver|portland|atlanta|dallas|washington|virginia|texas|florida|india|london|dublin|berlin|toronto|singapore)/i.test(cellText) && !location) {
                location = cellText;
              } else if (!team && cellText !== location) {
                team = cellText;
              }
            }
          }
        }

        // Clean title: remove leading/trailing dashes, pipes, and extra whitespace
        const cleanedTitle = text.replace(/^[\s\-|]+|[\s\-|]+$/g, '').replace(/\s+/g, ' ');

        jobs.push({ title: cleanedTitle, url: href, location, team });
      }

      return jobs;
    }) as { title: string; url: string; location: string | null; team: string | null }[];

    return Array.isArray(rawJobs) ? rawJobs : [];
  }

  /**
   * Extract jobs using Stagehand's extract() with Zod schema.
   * Only works when using OpenRouter→Claude (not Groq).
   */
  private async extractJobsViaStagehand(
    companyName: string
  ): Promise<{ title: string; location?: string | null; team?: string | null; url: string }[]> {
    if (!this.stagehand) return [];

    try {
      const { z } = await import('zod');
      const schema = z.object({
        jobs: z.array(z.object({
          title: z.string().describe('Job title'),
          location: z.string().nullable().optional().describe('Job location'),
          team: z.string().nullable().optional().describe('Department or team'),
          url: z.string().describe('URL to the job posting'),
        })),
      });

      const result = await Promise.race([
        this.stagehand.extract(
          `Extract all job listings visible on this ${companyName} careers page. For each job, get the title, location, team/department, and URL.`,
          schema,
        ),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('extract() timeout')), 30000)),
      ]);

      return result.jobs || [];
    } catch (err) {
      console.warn(`[explorer] Stagehand extract() failed:`, (err as Error).message);
      return [];
    }
  }

  /**
   * Find a link to the actual job search/listing page from the current page's HTML.
   */
  private async findJobSearchLink(page: { evaluate: (fn: () => unknown) => Promise<unknown>; url: () => string }, _companyName: string): Promise<string | null> {
    try {
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors.map(a => ({
          href: (a as HTMLAnchorElement).href,
          text: (a as HTMLAnchorElement).textContent?.trim() || '',
        }));
      }) as { href: string; text: string }[];

      if (!Array.isArray(links)) return null;

      const searchPatterns = [
        /search.*job/i, /find.*job/i, /job.*search/i, /open.*position/i,
        /view.*all.*job/i, /see.*all.*role/i, /browse.*job/i,
        /all.*opening/i, /search.*role/i, /explore.*job/i,
        /search.*opening/i, /current.*opening/i,
      ];

      const isUsableLink = (href: string) => {
        if (!href) return false;
        if (href === '#' || href.endsWith('#')) return false;
        if (href.startsWith('javascript:')) return false;
        if (href === page.url()) return false;
        return true;
      };

      // First: find links whose text matches search patterns AND have real URLs
      for (const link of links) {
        if (!isUsableLink(link.href)) continue;
        for (const pattern of searchPatterns) {
          if (pattern.test(link.text)) {
            return link.href;
          }
        }
      }

      // Second: find links whose URL contains /search, /results, or known ATS search patterns
      const urlPatterns = [
        /\/search\?/i, /\/search\//i, /\/results/i,
        /\/en-us\/search/i, /\/en\/search/i,
        /successfactors.*search/i, /\/go\//i,
      ];
      for (const link of links) {
        if (!isUsableLink(link.href)) continue;
        for (const pattern of urlPatterns) {
          if (pattern.test(link.href)) {
            return link.href;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the best available LLM provider config for HTML extraction.
   * Prefers OpenRouter (cheaper, no rate limits) over Groq.
   */
  private getLlmConfig(): { apiUrl: string; apiKey: string; model: string; provider: string } | null {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      return {
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: openRouterKey,
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
        provider: 'openrouter',
      };
    }
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      return {
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: groqKey,
        model: process.env.GROQ_JOB_PARSER_MODEL || 'llama-3.3-70b-versatile',
        provider: 'groq',
      };
    }
    return null;
  }

  /**
   * Extract jobs from HTML content using LLM JSON mode (OpenRouter preferred, Groq fallback).
   */
  private async extractJobsFromHtml(
    html: string,
    pageUrl: string,
    companyName: string
  ): Promise<{ title: string; location?: string | null; team?: string | null; url: string }[]> {
    const llm = this.getLlmConfig();
    if (!llm) return [];

    // Strip script/style tags and truncate to reduce tokens
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '');
    const truncated = cleaned.length > 20000 ? cleaned.slice(0, 20000) : cleaned;

    const response = await fetch(llm.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: `You extract job listings from HTML. Return a JSON object with a "jobs" array. Each job has: title (string), location (string or null), team (string or null), url (string — absolute URL using base ${pageUrl}). Only include actual job postings, not navigation links. If no jobs are found, return {"jobs": []}.`,
          },
          {
            role: 'user',
            content: `Extract all job listings from this ${companyName} careers page HTML. Return JSON only:\n\n${truncated}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0,
      }),
    });

    if (!response.ok) throw new Error(`${llm.provider} API error: ${response.status}`);

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    try {
      const parsed = JSON.parse(content) as { jobs?: { title: string; location?: string | null; team?: string | null; url: string }[] };
      return parsed.jobs || [];
    } catch {
      return [];
    }
  }

  /**
   * Fallback extraction: use FlareSolverr to get the rendered HTML,
   * then call LLM directly with JSON mode for structured extraction.
   */
  private async extractJobsViaLlm(
    pageUrl: string,
    companyName: string
  ): Promise<{ title: string; location?: string | null; team?: string | null; url: string }[]> {
    const flareAvailable = await isFlareSolverrAvailable();
    if (!flareAvailable) return [];

    const llm = this.getLlmConfig();
    if (!llm) return [];

    const result = await flareSolve(pageUrl, 30000);
    const html = result.html;

    const truncated = html.length > 15000 ? html.slice(0, 15000) : html;

    const response = await fetch(llm.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: 'You extract job listings from HTML. Return a JSON object with a "jobs" array. Each job has: title (string), location (string or null), team (string or null), url (string). Only include actual job postings, not navigation links.',
          },
          {
            role: 'user',
            content: `Extract all job listings from this ${companyName} careers page HTML. Return JSON only:\n\n${truncated}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`${llm.provider} API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    try {
      const parsed = JSON.parse(content) as {
        jobs?: { title: string; location?: string | null; team?: string | null; url: string }[];
      };
      return parsed.jobs || [];
    } catch {
      return [];
    }
  }

  /**
   * Clean job title: remove concatenated location/department text.
   */
  private cleanJobTitle(title: string): string {
    // Remove trailing location patterns like "- San Francisco, CA" or "| Remote"
    return title
      .replace(/\s*[-|]\s*(?:remote|hybrid|onsite|on-site).*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Detect ATS from the current page URL.
   */
  private detectAtsFromUrl(url: string): { platform: CareerPlatform; boardToken: string; careersUrl: string } | null {
    const parsed = parseAtsUrl(url);
    if (parsed) return parsed;

    // Check for Workday pattern
    const workdayMatch = url.match(/([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com/);
    if (workdayMatch) {
      return {
        platform: 'workday',
        boardToken: workdayMatch[1],
        careersUrl: url,
      };
    }

    // Check for iCIMS pattern
    const icimsMatch = url.match(/([a-z0-9-]+)\.icims\.com/);
    if (icimsMatch) {
      return {
        platform: 'icims',
        boardToken: icimsMatch[1],
        careersUrl: url,
      };
    }

    return null;
  }

  /**
   * Detect ATS by analyzing page content (links, iframes) via Stagehand's browser.
   */
  private async detectAtsFromPageContent(): Promise<{ platform: CareerPlatform; boardToken: string; careersUrl: string } | null> {
    if (!this.stagehand) return null;

    const page = this.stagehand.context.pages()[0];

    const urls: string[] = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href], iframe[src]'));
      return links
        .map(el => (el as HTMLAnchorElement).href || (el as HTMLIFrameElement).src)
        .filter(Boolean);
    });

    return this.matchAtsPatterns(urls);
  }

  /**
   * Detect ATS by scanning raw HTML from FlareSolverr for ATS URLs.
   */
  private detectAtsFromHtml(html: string): { platform: CareerPlatform; boardToken: string; careersUrl: string } | null {
    const urlRegex = /(?:href|src|action)=["']([^"']+)["']/gi;
    const urls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    // Also look for ATS URLs in inline scripts and data attributes
    const inlineUrlRegex = /https?:\/\/(?:boards(?:-api)?\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com|[a-z0-9-]+\.icims\.com)[^\s"'<>]*/gi;
    while ((match = inlineUrlRegex.exec(html)) !== null) {
      urls.push(match[0]);
    }

    return this.matchAtsPatterns(urls);
  }

  /**
   * Given a list of URLs, check each against known ATS patterns and return the first match.
   */
  private matchAtsPatterns(urls: string[]): { platform: CareerPlatform; boardToken: string; careersUrl: string } | null {
    const atsPatterns = [
      { regex: /boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?([a-zA-Z0-9_-]+)/, platform: 'greenhouse' as CareerPlatform, urlFn: (t: string) => `https://boards.greenhouse.io/${t}` },
      { regex: /job-boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/, platform: 'greenhouse' as CareerPlatform, urlFn: (t: string) => `https://boards.greenhouse.io/${t}` },
      { regex: /jobs\.lever\.co\/([a-zA-Z0-9_-]+)/, platform: 'lever' as CareerPlatform, urlFn: (t: string) => `https://jobs.lever.co/${t}` },
      { regex: /jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/, platform: 'ashby' as CareerPlatform, urlFn: (t: string) => `https://jobs.ashbyhq.com/${t}` },
      { regex: /([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com/, platform: 'workday' as CareerPlatform, urlFn: (_t: string, url: string) => url },
      { regex: /([a-z0-9-]+)\.icims\.com/, platform: 'icims' as CareerPlatform, urlFn: (_t: string, url: string) => url },
    ];

    for (const url of urls) {
      for (const { regex, platform, urlFn } of atsPatterns) {
        const match = url.match(regex);
        if (match) {
          return {
            platform,
            boardToken: match[1],
            careersUrl: urlFn(match[1], url),
          };
        }
      }
    }

    return null;
  }

  /**
   * Dismiss cookie consent banners that block page interaction.
   * Uses Stagehand act() to find and click accept/reject buttons.
   */
  private async dismissCookieConsent(): Promise<void> {
    if (!this.stagehand) return;

    try {
      // First try DOM-based dismissal (faster, no LLM call)
      const page = this.stagehand.context.pages()[0];
      const dismissed = await page.evaluate(() => {
        const selectors = [
          'button[id*="accept"]', 'button[id*="cookie"]',
          'button[class*="accept"]', 'button[class*="consent"]',
          'a[id*="accept"]', '[data-testid*="accept"]',
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel) as HTMLElement | null;
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }
        // Try text-based matching
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          if (text.includes('accept all') || text.includes('accept cookies') || text.includes('reject all')) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (dismissed) {
        await new Promise(r => setTimeout(r, 1000));
        return;
      }

      // Fallback: use Stagehand act() for complex cookie banners
      await Promise.race([
        this.stagehand.act(
          'If there is a cookie consent banner or popup, click "Accept All Cookies", "Accept All", "Reject All Cookies", or similar button to dismiss it. If no cookie banner is visible, do nothing.'
        ),
        new Promise<void>(resolve => setTimeout(resolve, 8000)),
      ]);
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      // Cookie banner not found or already dismissed — continue
    }
  }

  /**
   * Try to navigate to the next page of results.
   */
  private async tryNextPage(): Promise<boolean> {
    if (!this.stagehand) return false;

    try {
      const actions = await this.stagehand.observe(
        'Find a "Next page", "Load More", "Show More", "View More Jobs", or pagination button that loads more job listings'
      );

      if (actions.length > 0) {
        await this.stagehand.act(actions[0]);
        return true;
      }
    } catch {
      // No pagination found
    }

    return false;
  }

  private async cleanup(): Promise<void> {
    if (this.stagehand) {
      try {
        await Promise.race([
          this.stagehand.close(),
          new Promise(resolve => setTimeout(resolve, 5000)),
        ]);
      } catch {
        // Best effort cleanup
      }
      this.stagehand = null;
    }
  }
}
