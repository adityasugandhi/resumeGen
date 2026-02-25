/**
 * Lightweight structured logger for the agent pipeline.
 * Adds context (runId, company, phase) to log output.
 * No external dependencies — wraps console with JSON metadata.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  runId?: string;
  company?: string;
  phase?: string;
  tool?: string;
  [key: string]: unknown;
}

class Logger {
  private context: LogContext = {};
  private level: LogLevel = 'info';

  private static readonly LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(context?: LogContext) {
    if (context) this.context = context;
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    if (envLevel && envLevel in Logger.LEVELS) {
      this.level = envLevel;
    }
  }

  /** Create a child logger with additional context */
  child(context: LogContext): Logger {
    const child = new Logger({ ...this.context, ...context });
    child.level = this.level;
    return child;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (Logger.LEVELS[level] < Logger.LEVELS[this.level]) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...this.context,
      ...data,
    };

    switch (level) {
      case 'error':
        console.error(JSON.stringify(entry));
        break;
      case 'warn':
        console.warn(JSON.stringify(entry));
        break;
      case 'debug':
        console.debug(JSON.stringify(entry));
        break;
      default:
        console.log(JSON.stringify(entry));
    }
  }
}

/** Root logger instance */
export const logger = new Logger();

/** Create a logger for a specific agent run */
export function createRunLogger(runId: string): Logger {
  return logger.child({ runId });
}

export { Logger, type LogContext, type LogLevel };
