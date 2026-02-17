import { chromium, type Cookie } from "playwright";

let cachedCookies: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (reduced from 30 — V-005 session persistence)

export async function getSessionCookies(): Promise<string> {
  if (cachedCookies && Date.now() < cacheExpiry) {
    return cachedCookies;
  }

  const authUrl = process.env.GOINGLOBAL_AUTH_URL;
  if (!authUrl) {
    throw new Error("GOINGGOBAL_AUTH_URL is not configured");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(authUrl, { waitUntil: "networkidle", timeout: 30000 });

    const cookies: Cookie[] = await context.cookies();
    if (cookies.length === 0) {
      throw new Error("Authentication failed — no session cookies received");
    }

    const cookieString = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    cachedCookies = cookieString;
    cacheExpiry = Date.now() + CACHE_TTL_MS;

    return cookieString;
  } finally {
    await browser.close();
  }
}

export function clearCookieCache(): void {
  cachedCookies = null;
  cacheExpiry = 0;
}
