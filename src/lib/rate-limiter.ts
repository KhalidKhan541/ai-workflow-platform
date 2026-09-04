// Rate limiting utilities with multiple algorithms

import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export interface RateLimitConfig {
  algorithm: 'token-bucket' | 'sliding-window' | 'fixed-window';
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
  onLimit?: (key: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitRule {
  name: string;
  path?: string;
  method?: string;
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: { ip?: string; userId?: string; path: string; method: string }) => string;
}

// ─── Token Bucket Algorithm ──────────────────────────────
class TokenBucket {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per ms
    private windowMs: number
  ) {}

  allow(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket) {
      this.buckets.set(key, { tokens: this.capacity - 1, lastRefill: now });
      return { allowed: true, remaining: this.capacity - 1, limit: this.capacity, resetAt: now + this.windowMs };
    }

    // Refill tokens
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / this.refillRate);
      return { allowed: false, remaining: 0, limit: this.capacity, resetAt: now + retryAfter, retryAfter };
    }

    bucket.tokens--;
    return { allowed: true, remaining: bucket.tokens, limit: this.capacity, resetAt: now + this.windowMs };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  getSize(): number {
    return this.buckets.size;
  }
}

// ─── Sliding Window Algorithm ────────────────────────────
class SlidingWindow {
  private windows = new Map<string, { requests: number[] }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  allow(key: string): RateLimitResult {
    const now = Date.now();
    const window = this.windows.get(key) || { requests: [] };

    // Remove expired requests
    window.requests = window.requests.filter((t) => now - t < this.windowMs);

    if (window.requests.length >= this.maxRequests) {
      const oldestRequest = window.requests[0];
      const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
      this.windows.set(key, window);
      return { allowed: false, remaining: 0, limit: this.maxRequests, resetAt: oldestRequest + this.windowMs, retryAfter };
    }

    window.requests.push(now);
    this.windows.set(key, window);

    return {
      allowed: true,
      remaining: this.maxRequests - window.requests.length,
      limit: this.maxRequests,
      resetAt: now + this.windowMs,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  getSize(): number {
    return this.windows.size;
  }
}

// ─── Fixed Window Algorithm ──────────────────────────────
class FixedWindow {
  private windows = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  allow(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const window = this.windows.get(key);

    if (!window || window.windowStart !== windowStart) {
      this.windows.set(key, { count: 1, windowStart });
      return { allowed: true, remaining: this.maxRequests - 1, limit: this.maxRequests, resetAt: windowStart + this.windowMs };
    }

    if (window.count >= this.maxRequests) {
      const retryAfter = Math.ceil((windowStart + this.windowMs - now) / 1000);
      return { allowed: false, remaining: 0, limit: this.maxRequests, resetAt: windowStart + this.windowMs, retryAfter };
    }

    window.count++;
    return { allowed: true, remaining: this.maxRequests - window.count, limit: this.maxRequests, resetAt: windowStart + this.windowMs };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  getSize(): number {
    return this.windows.size;
  }
}

// ─── Rate Limiter Manager ────────────────────────────────
class RateLimiter {
  private limiters = new Map<string, TokenBucket | SlidingWindow | FixedWindow>();
  private rules: RateLimitRule[] = [];

  constructor() {
    // Default rules
    this.addRule({ name: 'global', maxRequests: 100, windowMs: 60000 });
    this.addRule({ name: 'auth', path: '/api/auth', maxRequests: 10, windowMs: 60000 });
    this.addRule({ name: 'api', path: '/api', maxRequests: 50, windowMs: 60000 });
  }

  addRule(rule: RateLimitRule): void {
    this.rules.push(rule);
    const config: RateLimitConfig = {
      algorithm: 'sliding-window',
      maxRequests: rule.maxRequests,
      windowMs: rule.windowMs,
      keyPrefix: rule.name,
    };

    switch (config.algorithm) {
      case 'token-bucket':
        this.limiters.set(rule.name, new TokenBucket(config.maxRequests, config.maxRequests / config.windowMs, config.windowMs));
        break;
      case 'sliding-window':
        this.limiters.set(rule.name, new SlidingWindow(config.maxRequests, config.windowMs));
        break;
      case 'fixed-window':
        this.limiters.set(rule.name, new FixedWindow(config.maxRequests, config.windowMs));
        break;
    }
  }

  check(req: { ip?: string; userId?: string; path: string; method: string }): RateLimitResult {
    const key = req.userId || req.ip || 'unknown';

    for (const rule of this.rules) {
      if (rule.path && !req.path.startsWith(rule.path)) continue;
      if (rule.method && rule.method !== req.method) continue;

      const limiter = this.limiters.get(rule.name);
      if (limiter) {
        return limiter.allow(`${rule.name}:${key}`);
      }
    }

    return { allowed: true, remaining: 100, limit: 100, resetAt: Date.now() + 60000 };
  }

  reset(key: string): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset(key);
    }
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, limiter] of this.limiters) {
      stats[name] = limiter.getSize();
    }
    return stats;
  }
}

// ─── Singleton ───────────────────────────────────────────
const globalRateLimiter = globalThis as unknown as { __rateLimiter?: RateLimiter };
export const rateLimiter = globalRateLimiter.__rateLimiter || new RateLimiter();
if (process.env.NODE_ENV !== 'production') {
  globalRateLimiter.__rateLimiter = rateLimiter;
}

// ─── Convenience Functions ───────────────────────────────
export function checkRateLimit(req: { ip?: string; userId?: string; path: string; method: string }): RateLimitResult {
  return rateLimiter.check(req);
}

export function addRateLimitRule(rule: RateLimitRule): void {
  rateLimiter.addRule(rule);
}
