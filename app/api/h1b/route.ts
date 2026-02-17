import { NextRequest, NextResponse } from "next/server";
import { getSessionCookies, clearCookieCache } from "@/lib/goinglobal/cookies";
import { fetchH1bCsv, type H1bExportParams } from "@/lib/goinglobal/export";
import { logAccess } from "@/lib/goinglobal/logger";
import { checkRateLimit } from "@/lib/goinglobal/rate-limiter";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  const { searchParams } = request.nextUrl;

  const params: H1bExportParams = {
    jobTitle: searchParams.get("jobTitle") || undefined,
    company: searchParams.get("company") || undefined,
    year: searchParams.getAll("year"),
    city: searchParams.get("city") || undefined,
    state: searchParams.get("state") || undefined,
    metroArea: searchParams.get("metroArea") || undefined,
  };

  if (!params.year || params.year.length === 0) {
    params.year = undefined;
  }

  // V-009: Require at least one search parameter to prevent bulk scraping
  const hasSearchParam =
    params.jobTitle || params.company || params.city || params.state || params.metroArea;

  if (!hasSearchParam) {
    logAccess({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      params,
      status: "bad_request",
      errorMessage: "No search parameters provided",
    });

    return NextResponse.json(
      { error: "At least one search parameter (jobTitle, company, city, state, or metroArea) is required" },
      { status: 400 }
    );
  }

  // V-006: Rate limiting — 10 requests/minute per IP
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    logAccess({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      params,
      status: "rate_limited",
    });

    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
        },
      }
    );
  }

  try {
    const cookies = await getSessionCookies();
    const csv = await fetchH1bCsv(cookies, params);

    // V-008: Log successful access
    logAccess({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      params,
      status: "success",
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="h1b_data.csv"',
        // V-007: Prevent referrer leakage
        "Referrer-Policy": "no-referrer",
        // Security headers
        "X-Content-Type-Options": "nosniff",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
      },
    });
  } catch (error) {
    clearCookieCache();

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    // V-008: Log errors (sanitize — don't expose auth URL)
    logAccess({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      params,
      status: "error",
      errorMessage: message.replace(/accid=[^\s&]+/g, "accid=[REDACTED]"),
    });

    // Don't leak internal details to client
    return NextResponse.json(
      { error: "Failed to fetch H1B data. Please try again later." },
      { status: 500 }
    );
  }
}
