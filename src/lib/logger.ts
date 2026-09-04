import { config } from "./config";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  source?: string;
  stack?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

class Logger {
  private minLevel: LogLevel;
  private isDevelopment: boolean;

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
    this.isDevelopment = config.app.isDev;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    if (this.isDevelopment) {
      return this.formatDevelopment(entry);
    }
    return this.formatProduction(entry);
  }

  private formatDevelopment(entry: LogEntry): string {
    const color = COLORS[entry.level];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const prefix = entry.source ? `[${entry.source}]` : "";

    let output = `${DIM}${timestamp}${RESET} ${color}${BOLD}${levelStr}${RESET} ${prefix} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => {
          if (typeof v === "object") {
            return `${k}=${JSON.stringify(v)}`;
          }
          return `${k}=${v}`;
        })
        .join(" ");
      output += `\n  ${DIM}${contextStr}${RESET}`;
    }

    if (entry.stack) {
      output += `\n  ${DIM}Stack:${RESET}\n${entry.stack}`;
    }

    return output;
  }

  private formatProduction(entry: LogEntry): string {
    const logEntry: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      source: entry.source,
    };

    if (entry.context && Object.keys(entry.context).length > 0) {
      logEntry.context = entry.context;
    }

    if (entry.stack) {
      logEntry.stack = entry.stack;
    }

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, message: string, context?: LogContext, source?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      source,
      stack: level === "error" ? new Error().stack : undefined,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext, source?: string): void {
    this.log("debug", message, context, source);
  }

  info(message: string, context?: LogContext, source?: string): void {
    this.log("info", message, context, source);
  }

  warn(message: string, context?: LogContext, source?: string): void {
    this.log("warn", message, context, source);
  }

  error(message: string, context?: LogContext, source?: string): void {
    this.log("error", message, context, source);
  }

  child(source: string): ChildLogger {
    return new ChildLogger(this, source);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

class ChildLogger {
  private parent: Logger;
  private source: string;

  constructor(parent: Logger, source: string) {
    this.parent = parent;
    this.source = source;
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, context, this.source);
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, context, this.source);
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, context, this.source);
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, context, this.source);
  }
}

function createLogger(): Logger {
  const level = (config.logging.level as LogLevel) || "info";
  return new Logger(level);
}

export const logger = createLogger();

export function createRequestLogger(requestId: string): ChildLogger {
  return logger.child(`req:${requestId.substring(0, 8)}`);
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export function logApiRequest(
  method: string,
  path: string,
  requestId: string,
  context?: LogContext
): void {
  logger.info("API Request", {
    method,
    path,
    requestId,
    ...context,
  });
}

export function logApiResponse(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestId: string
): void {
  const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  logger[level]("API Response", {
    method,
    path,
    statusCode,
    duration,
    requestId,
  });
}

export function logError(
  error: Error,
  context?: LogContext,
  source?: string
): void {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
  }, source);
}

export function logAudit(
  action: string,
  resource: string,
  resourceId: string,
  userId: string,
  orgId: string,
  details?: Record<string, unknown>
): void {
  logger.info("Audit", {
    action,
    resource,
    resourceId,
    userId,
    orgId,
    ...details,
  }, "audit");
}

export function logPerformance(
  operation: string,
  durationMs: number,
  context?: LogContext
): void {
  const level: LogLevel = durationMs > 1000 ? "warn" : "debug";
  logger[level](`Performance: ${operation}`, {
    duration: durationMs,
    ...context,
  }, "perf");
}

export function createTimer(label: string): {
  stop: (context?: LogContext) => number;
} {
  const start = performance.now();
  return {
    stop: (context?: LogContext) => {
      const duration = Math.round(performance.now() - start);
      logPerformance(label, duration, context);
      return duration;
    },
  };
}

export { Logger, ChildLogger };
export type { LogLevel, LogContext, LogEntry };
