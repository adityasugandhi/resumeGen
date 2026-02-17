import { NextRequest, NextResponse } from "next/server";
import { logAccess } from "@/lib/goinglobal/logger";
import { checkRateLimit } from "@/lib/goinglobal/rate-limiter";
import { getMarketIntelligence } from "@/lib/goinglobal/h1b-intelligence";

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
  const jobTitle = searchParams.get("jobTitle");
  const metro = searchParams.get("metro") || undefined;
  const years = searchParams.getAll("year");

  if (!jobTitle) {
    return NextResponse.json(
      { error: "jobTitle parameter is required" },
      { status: 400 }
    );
  }

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const intelligence = await getMarketIntelligence(
      jobTitle,
      metro,
      years.length > 0 ? years : undefined
    );

    logAccess({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      params: { jobTitle, metro, year: years },
      status: "success",
    });

    return NextResponse.json(
      { jobTitle, metro: metro || "all", ...intelligence },
      {
        headers: {
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch {
    logAccess({
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      params: { jobTitle, metro },
      status: "error",
      errorMessage: "Market intelligence fetch failed",
    });

    return NextResponse.json(
      { error: "Failed to fetch market intelligence" },
      { status: 500 }
    );
  }
}
