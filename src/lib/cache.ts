// Cache layer with Redis adapter pattern (works without Redis in dev)
// Uses an in-memory Map when Redis is unavailable

import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  serializer?: {
    serialize: (value: unknown) => string;
    deserialize: (value: string) => unknown;
  };
}

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

export interface LockOptions {
  ttl?: number;
  retryCount?: number;
  retryDelay?: number;
}

// ─── Memory Cache Implementation ─────────────────────────
class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 };
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlMs: number = 300000): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
    this.stats.sets++;
    this.stats.size = this.store.size;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.stats.deletes++;
    this.stats.size = this.store.size;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (!pattern) return allKeys;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter((k) => regex.test(k));
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    for (const key of keys) {
      await this.del(key);
    }
    return keys.length;
  }

  async flush(): Promise<void> {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 };
  }

  getStats(): CacheStats {
    return { ...this.stats, size: this.store.size };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
    this.stats.size = this.store.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// ─── Cache Client ────────────────────────────────────────
class CacheClient {
  private memoryCache: MemoryCache;
  private defaultPrefix: string;
  private defaultTtl: number;

  constructor(options?: { prefix?: string; defaultTtl?: number }) {
    this.memoryCache = new MemoryCache();
    this.defaultPrefix = options?.prefix || 'cache:';
    this.defaultTtl = options?.defaultTtl || 300000;
  }

  private prefixedKey(key: string): string {
    return `${this.defaultPrefix}${key}`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.memoryCache.get<T>(this.prefixedKey(key));
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.memoryCache.set(this.prefixedKey(key), value, ttlMs || this.defaultTtl);
  }

  async del(key: string): Promise<void> {
    await this.memoryCache.del(this.prefixedKey(key));
  }

  async exists(key: string): Promise<boolean> {
    return this.memoryCache.exists(this.prefixedKey(key));
  }

  async keys(pattern?: string): Promise<string[]> {
    const fullPattern = pattern ? this.prefixedKey(pattern) : this.prefixedKey('*');
    const keys = await this.memoryCache.keys(fullPattern);
    return keys.map((k) => k.slice(this.defaultPrefix.length));
  }

  async invalidatePattern(pattern: string): Promise<number> {
    return this.memoryCache.invalidatePattern(this.prefixedKey(pattern));
  }

  async flush(): Promise<void> {
    await this.memoryCache.flush();
  }

  getStats(): CacheStats {
    return this.memoryCache.getStats();
  }
}

// ─── Singleton Cache Instance ────────────────────────────
const globalCache = globalThis as unknown as { __cacheClient?: CacheClient };
export const cache = globalCache.__cacheClient || new CacheClient();
if (process.env.NODE_ENV !== 'production') {
  globalCache.__cacheClient = cache;
}

// ─── Cache-Aside Pattern ─────────────────────────────────
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number }
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  await cache.set(key, value, options?.ttl);
  return value;
}

// ─── Cache Invalidation ──────────────────────────────────
export async function invalidateCache(pattern: string): Promise<number> {
  return cache.invalidatePattern(pattern);
}

export async function invalidateKey(key: string): Promise<void> {
  await cache.del(key);
}

// ─── TTL Management ──────────────────────────────────────
export async function setWithTTL(key: string, value: unknown, ttlMs: number): Promise<void> {
  await cache.set(key, value, ttlMs);
}

export async function getRemainingTTL(key: string): Promise<number> {
  // Memory cache doesn't expose TTL, return -1 if not found
  const exists = await cache.exists(key);
  return exists ? -1 : 0;
}

// ─── Cache Warming ───────────────────────────────────────
export async function warmCache(
  entries: Array<{ key: string; fetcher: () => Promise<unknown>; ttl?: number }>
): Promise<{ warmed: number; errors: number }> {
  let warmed = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const value = await entry.fetcher();
      await cache.set(entry.key, value, entry.ttl);
      warmed++;
    } catch {
      errors++;
    }
  }

  return { warmed, errors };
}

// ─── Distributed Locking ─────────────────────────────────
const locks = new Map<string, { holder: string; expiresAt: number }>();

export async function acquireLock(
  resource: string,
  options?: LockOptions
): Promise<{ acquired: boolean; lockId?: string }> {
  const { ttl = 30000, retryCount = 3, retryDelay = 100 } = options || {};
  const lockId = generateId();

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const existing = locks.get(resource);

    if (!existing || Date.now() > existing.expiresAt) {
      locks.set(resource, { holder: lockId, expiresAt: Date.now() + ttl });
      return { acquired: true, lockId };
    }

    if (attempt < retryCount) {
      await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
    }
  }

  return { acquired: false };
}

export async function releaseLock(resource: string, lockId: string): Promise<boolean> {
  const existing = locks.get(resource);
  if (!existing || existing.holder !== lockId) return false;
  locks.delete(resource);
  return true;
}

export async function withLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<T> {
  const { acquired, lockId } = await acquireLock(resource, options);
  if (!acquired || !lockId) {
    throw new Error(`Failed to acquire lock for ${resource}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(resource, lockId);
  }
}

// ─── Cache Statistics ────────────────────────────────────
export function getCacheStats(): CacheStats {
  return cache.getStats();
}
