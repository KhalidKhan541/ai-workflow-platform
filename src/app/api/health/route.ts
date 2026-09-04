import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { monitoring } from '@/lib/monitoring';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    memory: MemoryCheck;
    disk: CheckResult;
  };
}

interface CheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
}

interface MemoryCheck extends CheckResult {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latencyMs: performance.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: performance.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = performance.now();
  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 2000,
      commandTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
    });

    await redis.connect();
    await redis.ping();
    await redis.quit();

    return {
      status: 'up',
      latencyMs: performance.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: performance.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function checkMemory(): MemoryCheck {
  const mem = process.memoryUsage();
  const heapUsedPercent = (mem.heapUsed / mem.heapTotal) * 100;

  return {
    status: heapUsedPercent < 90 ? 'up' : 'down',
    latencyMs: 0,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss: mem.rss,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    message:
      heapUsedPercent >= 90
        ? `Heap usage critical: ${heapUsedPercent.toFixed(1)}%`
        : undefined,
  };
}

function checkDisk(): CheckResult {
  try {
    const fs = require('fs');
    const stats = fs.statSync('/');
    const total = stats.blocks * stats.blksize;
    const free = stats.bfree * stats.blksize;
    const usedPercent = ((total - free) / total) * 100;

    return {
      status: usedPercent < 95 ? 'up' : 'down',
      latencyMs: 0,
      message:
        usedPercent >= 95
          ? `Disk usage critical: ${usedPercent.toFixed(1)}%`
          : undefined,
    };
  } catch {
    return {
      status: 'up',
      latencyMs: 0,
      message: 'Disk check not available',
    };
  }
}

export async function GET() {
  const start = performance.now();

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const memory = checkMemory();
  const disk = checkDisk();

  const checks = { database, redis, memory, disk };

  const allUp = Object.values(checks).every((c) => c.status === 'up');
  const anyDown = Object.values(checks).some((c) => c.status === 'down');

  const status: HealthCheck['status'] = allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded';

  const health: HealthCheck = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    checks,
  };

  monitoring.recordMetric('health_check_duration_ms', performance.now() - start);

  const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
