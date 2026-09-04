import { NextResponse } from 'next/server';

import { monitoring } from '@/lib/monitoring';

function formatPrometheusMetrics(data: ReturnType<typeof monitoring.getMetrics>): string {
  const lines: string[] = [];

  lines.push('# HELP aiworkflow_uptime_seconds Application uptime in seconds');
  lines.push('# TYPE aiworkflow_uptime_seconds gauge');
  lines.push(`aiworkflow_uptime_seconds ${data.uptime.toFixed(2)}`);
  lines.push('');

  lines.push('# HELP aiworkflow_memory_bytes Memory usage in bytes');
  lines.push('# TYPE aiworkflow_memory_bytes gauge');
  lines.push(`aiworkflow_memory_bytes{type="rss"} ${data.memory.rss}`);
  lines.push(`aiworkflow_memory_bytes{type="heap_used"} ${data.memory.heapUsed}`);
  lines.push(`aiworkflow_memory_bytes{type="heap_total"} ${data.memory.heapTotal}`);
  lines.push(`aiworkflow_memory_bytes{type="external"} ${data.memory.external}`);
  lines.push('');

  const requestStats = monitoring.getRequestStats();
  lines.push('# HELP aiworkflow_http_requests_total Total HTTP requests');
  lines.push('# TYPE aiworkflow_http_requests_total counter');
  for (const [key, value] of Object.entries(data.counters)) {
    if (key.startsWith('http_requests_total:')) {
      const labels = JSON.parse(key.replace('http_requests_total:', ''));
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      lines.push(`aiworkflow_http_requests_total{${labelStr}} ${value}`);
    }
  }
  lines.push('');

  lines.push('# HELP aiworkflow_request_duration_seconds Request duration');
  lines.push('# TYPE aiworkflow_request_duration_seconds summary');
  lines.push(
    `aiworkflow_request_duration_seconds{quantile="0.5"} ${(requestStats.p50Duration / 1000).toFixed(4)}`,
  );
  lines.push(
    `aiworkflow_request_duration_seconds{quantile="0.95"} ${(requestStats.p95Duration / 1000).toFixed(4)}`,
  );
  lines.push(
    `aiworkflow_request_duration_seconds{quantile="0.99"} ${(requestStats.p99Duration / 1000).toFixed(4)}`,
  );
  lines.push(
    `aiworkflow_request_duration_seconds_sum ${(requestStats.averageDuration * requestStats.totalRequests / 1000).toFixed(4)}`,
  );
  lines.push(`aiworkflow_request_duration_seconds_count ${requestStats.totalRequests}`);
  lines.push('');

  lines.push('# HELP aiworkflow_requests_per_second Requests per second');
  lines.push('# TYPE aiworkflow_requests_per_second gauge');
  lines.push(`aiworkflow_requests_per_second ${requestStats.requestsPerSecond.toFixed(2)}`);
  lines.push('');

  const errorStats = monitoring.getErrorRate();
  lines.push('# HELP aiworkflow_errors_total Total errors');
  lines.push('# TYPE aiworkflow_errors_total counter');
  for (const [key, value] of Object.entries(data.counters)) {
    if (key.startsWith('errors_total:')) {
      const labels = JSON.parse(key.replace('errors_total:', ''));
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      lines.push(`aiworkflow_errors_total{${labelStr}} ${value}`);
    }
  }
  lines.push('');

  lines.push('# HELP aiworkflow_error_rate Error rate percentage');
  lines.push('# TYPE aiworkflow_error_rate gauge');
  lines.push(`aiworkflow_error_rate ${errorStats.errorRate.toFixed(2)}`);
  lines.push('');

  lines.push('# HELP aiworkflow_http_status_requests Requests by status code');
  lines.push('# TYPE aiworkflow_http_status_requests counter');
  for (const [status, count] of Object.entries(requestStats.byStatus)) {
    lines.push(`aiworkflow_http_status_requests{status="${status}"} ${count}`);
  }
  lines.push('');

  lines.push('# HELP aiworkflow_info Application info');
  lines.push('# TYPE aiworkflow_info gauge');
  lines.push(
    `aiworkflow_info{version="${process.env.npm_package_version || '0.1.0'}",node="${process.version}"} 1`,
  );

  return lines.join('\n');
}

export async function GET() {
  const data = monitoring.getMetrics();
  const prometheusMetrics = formatPrometheusMetrics(data);

  return new NextResponse(prometheusMetrics, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
