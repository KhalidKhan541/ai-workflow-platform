export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface RequestMetric {
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: number;
  userId?: string;
}

export interface ErrorMetric {
  message: string;
  stack?: string;
  path: string;
  method: string;
  userId?: string;
  timestamp: number;
}

class MonitoringService {
  private metrics: MetricData[] = [];
  private requestMetrics: RequestMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();
  private maxBufferSize = 10000;

  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      labels,
      timestamp: Date.now(),
    });

    if (this.metrics.length > this.maxBufferSize) {
      this.metrics = this.metrics.slice(-this.maxBufferSize / 2);
    }
  }

  incrementCounter(name: string, labels?: Record<string, string>) {
    const key = `${name}:${JSON.stringify(labels || {})}`;
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
    this.recordMetric(name, current + 1, labels);
  }

  startTimer(name: string): () => number {
    const start = performance.now();
    this.timers.set(name, start);

    return () => {
      const duration = performance.now() - start;
      this.timers.delete(name);
      this.recordMetric(name, duration);
      return duration;
    };
  }

  recordRequest(req: { method: string; url: string }, res: { statusCode: number }, duration: number) {
    const metric: RequestMetric = {
      method: req.method,
      path: new URL(req.url, 'http://localhost').pathname,
      status: res.statusCode,
      duration,
      timestamp: Date.now(),
    };

    this.requestMetrics.push(metric);

    if (this.requestMetrics.length > this.maxBufferSize) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxBufferSize / 2);
    }

    this.incrementCounter('http_requests_total', {
      method: req.method,
      status: String(res.statusCode),
    });
  }

  recordError(error: Error, context: { path: string; method: string; userId?: string }) {
    const metric: ErrorMetric = {
      message: error.message,
      stack: error.stack,
      path: context.path,
      method: context.method,
      userId: context.userId,
      timestamp: Date.now(),
    };

    this.errorMetrics.push(metric);

    if (this.errorMetrics.length > this.maxBufferSize) {
      this.errorMetrics = this.errorMetrics.slice(-this.maxBufferSize / 2);
    }

    this.incrementCounter('errors_total', {
      path: context.path,
      type: error.constructor.name,
    });

    console.error(`[Error] ${error.message}`, {
      path: context.path,
      method: context.method,
      stack: error.stack,
    });
  }

  getMetrics(): {
    requests: RequestMetric[];
    errors: ErrorMetric[];
    counters: Record<string, number>;
    uptime: number;
    memory: NodeJS.MemoryUsage;
  } {
    return {
      requests: this.requestMetrics.slice(-100),
      errors: this.errorMetrics.slice(-100),
      counters: Object.fromEntries(this.counters),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  getRequestStats(timeWindowMs: number = 60000) {
    const now = Date.now();
    const recentRequests = this.requestMetrics.filter(
      (r) => now - r.timestamp < timeWindowMs,
    );

    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let p50Duration = 0;
    let p95Duration = 0;
    let p99Duration = 0;

    for (const req of recentRequests) {
      const status = String(req.status);
      byStatus[status] = (byStatus[status] || 0) + 1;
      totalDuration += req.duration;
    }

    if (recentRequests.length > 0) {
      const sortedDurations = recentRequests
        .map((r) => r.duration)
        .sort((a, b) => a - b);
      p50Duration = sortedDurations[Math.floor(sortedDurations.length * 0.5)];
      p95Duration = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
      p99Duration = sortedDurations[Math.floor(sortedDurations.length * 0.99)];
    }

    return {
      totalRequests: recentRequests.length,
      requestsPerSecond: recentRequests.length / (timeWindowMs / 1000),
      averageDuration: recentRequests.length > 0 ? totalDuration / recentRequests.length : 0,
      p50Duration,
      p95Duration,
      p99Duration,
      byStatus,
    };
  }

  getErrorRate(timeWindowMs: number = 60000) {
    const now = Date.now();
    const recentErrors = this.errorMetrics.filter(
      (e) => now - e.timestamp < timeWindowMs,
    );
    const recentRequests = this.requestMetrics.filter(
      (r) => now - r.timestamp < timeWindowMs,
    );

    return {
      totalErrors: recentErrors.length,
      errorRate: recentRequests.length > 0
        ? (recentErrors.length / recentRequests.length) * 100
        : 0,
      errorsByType: recentErrors.reduce(
        (acc, e) => {
          acc[e.message] = (acc[e.message] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}

export const monitoring = new MonitoringService();

export function withMonitoring<T>(
  handler: (req: Request) => Promise<T>,
): (req: Request) => Promise<T> {
  return async (req: Request) => {
    const url = new URL(req.url);
    const start = performance.now();

    try {
      const result = await handler(req);
      const duration = performance.now() - start;

      monitoring.incrementCounter('http_requests_total', {
        method: req.method,
        status: '200',
        path: url.pathname,
      });

      monitoring.recordMetric('http_request_duration_ms', duration, {
        method: req.method,
        path: url.pathname,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      monitoring.incrementCounter('http_requests_total', {
        method: req.method,
        status: '500',
        path: url.pathname,
      });

      monitoring.recordError(error as Error, {
        path: url.pathname,
        method: req.method,
      });

      throw error;
    }
  };
}
