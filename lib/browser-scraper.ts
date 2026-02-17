import { chromium, Browser, Page } from 'playwright';

// Singleton browser instance for reuse
let browser: Browser | null = null;

/**
 * Get or create a browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

/**
 * Try to fetch page content using simple HTTP request (fast path)
 */
async function tryStaticFetch(url: string): Promise<{ html: string; success: boolean }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return { html: '', success: false };
    }

    const html = await response.text();
    return { html, success: true };
  } catch {
    return { html: '', success: false };
  }
}

/**
 * Check if the HTML content has sufficient job-related content
 */
function isContentSufficient(html: string): boolean {
  // Strip HTML tags to get text content
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Check for minimum text length
  if (textContent.length < 500) {
    return false;
  }

  const lowerText = textContent.toLowerCase();

  // Reject if dominated by privacy content
  const privacyIndicators = [
    'privacy policy',
    'cookie policy',
    'do not sell',
    'your privacy choices',
    'gdpr',
    'ccpa',
  ];

  const privacyMatches = privacyIndicators.filter(
    indicator => lowerText.includes(indicator)
  ).length;

  // Too many privacy indicators = likely privacy page
  if (privacyMatches >= 3 && textContent.length < 2000) {
    console.log('[scraper] Content appears to be privacy/legal focused');
    return false;
  }

  // Look for job-specific patterns (not generic keywords)
  const jobPatterns = [
    'job description',
    'about the role',
    'what you\'ll do',
    'key responsibilities',
    'years of experience',
    'bachelor\'s degree',
    'apply now',
    'position summary',
  ];

  const jobMatches = jobPatterns.filter(pattern =>
    lowerText.includes(pattern)
  ).length;

  // Need specific job indicators, not just generic keywords
  return jobMatches >= 2;
}

/**
 * Fetch page content using Playwright (for JavaScript-rendered pages)
 */
async function fetchWithBrowser(url: string): Promise<string> {
  const browserInstance = await getBrowser();
  const page: Page = await browserInstance.newPage();

  try {
    // Set a realistic viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Set user agent to avoid bot detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Navigate to the page - use domcontentloaded for faster initial load
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Wait for body to be available
    await page.waitForSelector('body', { timeout: 5000 });

    // Wait a bit for JavaScript to render content
    await page.waitForTimeout(3000);

    // Try to wait for common job content selectors (non-blocking)
    const jobSelectors = [
      '[class*="job-description"]',
      '[class*="job-details"]',
      '[class*="posting"]',
      '[class*="career"]',
      '[id*="job"]',
      'article',
      'main',
    ];

    for (const selector of jobSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`[browser] Found content with selector: ${selector}`);
        break;
      } catch {
        // Selector not found, try next
      }
    }

    // Get the rendered HTML from main page
    let html = await page.content();
    console.log(`[browser] Got ${html.length} bytes of main page HTML`);

    // Also try to get content from iframes (common for Greenhouse, Lever, etc.)
    try {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        try {
          const frameContent = await frame.content();
          if (frameContent.length > 1000) {
            console.log(`[browser] Found iframe with ${frameContent.length} bytes`);
            // Append iframe content to main HTML
            html += '\n<!-- IFRAME CONTENT -->\n' + frameContent;
          }
        } catch {
          // Frame may not be accessible
        }
      }
    } catch (error) {
      console.log('[browser] Could not access iframes:', error);
    }

    console.log(`[browser] Total HTML: ${html.length} bytes`);
    return html;
  } catch (error) {
    console.error('[browser] Error fetching with browser:', error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Smart scraper that tries static fetch first, then falls back to Playwright
 */
export async function scrapeJobPage(url: string): Promise<{ html: string; method: 'static' | 'browser' }> {
  // First, try the fast static fetch
  const staticResult = await tryStaticFetch(url);

  if (staticResult.success && isContentSufficient(staticResult.html)) {
    console.log(`[scraper] Used static fetch for ${url}`);
    return { html: staticResult.html, method: 'static' };
  }

  // Fall back to browser rendering
  console.log(`[scraper] Static fetch insufficient, using browser for ${url}`);
  const browserHtml = await fetchWithBrowser(url);
  return { html: browserHtml, method: 'browser' };
}

/**
 * Close the browser instance (for cleanup)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
