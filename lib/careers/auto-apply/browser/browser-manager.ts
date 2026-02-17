import { chromium, Browser, BrowserContext } from 'playwright';

let browser: Browser | null = null;

/**
 * Get or create a singleton Playwright browser instance.
 * Supports AUTO_APPLY_HEADED=true for manual CAPTCHA solving.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const headed = process.env.AUTO_APPLY_HEADED === 'true';
    browser = await chromium.launch({
      headless: !headed,
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
 * Create an isolated BrowserContext for a single application submission.
 * Each context has its own cookies/storage so applications don't interfere.
 */
export async function createApplicationContext(): Promise<BrowserContext> {
  const browserInstance = await getBrowser();
  return browserInstance.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
}

/**
 * Close the singleton browser (cleanup).
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
