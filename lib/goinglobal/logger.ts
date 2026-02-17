// Access logging for H1B API — addresses V-008 (no audit trail)

export interface AccessLogEntry {
  timestamp: string;
  ip: string;
  userAgent: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
  status: "success" | "rate_limited" | "error" | "bad_request";
  errorMessage?: string;
}

const accessLog: AccessLogEntry[] = [];
const MAX_LOG_ENTRIES = 1000;

export function logAccess(entry: AccessLogEntry): void {
  accessLog.push(entry);

  // Rotate log if it exceeds max
  if (accessLog.length > MAX_LOG_ENTRIES) {
    accessLog.splice(0, accessLog.length - MAX_LOG_ENTRIES);
  }

  // Console log for server-side visibility
  const logLine = `[H1B] ${entry.timestamp} | ${entry.status.toUpperCase()} | ${entry.ip} | ${entry.userAgent.slice(0, 60)} | params=${JSON.stringify(entry.params)}`;

  if (entry.status === "error") {
    console.error(logLine, entry.errorMessage);
  } else if (entry.status === "rate_limited") {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

export function getRecentLogs(count = 50): AccessLogEntry[] {
  return accessLog.slice(-count);
}
