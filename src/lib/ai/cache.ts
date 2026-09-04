import type {
  CompletionRequest,
  CompletionResponse,
  CacheConfig,
  CacheEntry,
  AIProvider,
} from "@/types/ai";

// ─── Cache Key Generation ────────────────────────────────────────────────────

function generateCacheKey(request: CompletionRequest): string {
  const keyParts = {
    messages: request.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      name: m.name,
    })),
    model: request.model,
    provider: request.provider,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    topP: request.topP,
    tools: request.tools?.map((t) => t.function.name),
  };
  return `ai_cache:${hashString(JSON.stringify(keyParts))}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getQueryText(request: CompletionRequest): string {
  const lastUserMsg = [...request.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return "";
  return typeof lastUserMsg.content === "string"
    ? lastUserMsg.content
    : JSON.stringify(lastUserMsg.content);
}

// ─── In-Memory Cache Backend ─────────────────────────────────────────────────

export class InMemoryCacheBackend {
  private store: Map<string, CacheEntry> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (new Date() > entry.expiresAt) {
      this.store.delete(key);
      this.embeddings.delete(key);
      return undefined;
    }

    entry.hitCount++;
    return entry;
  }

  set(key: string, entry: CacheEntry): void {
    if (this.store.size >= this.maxEntries) {
      this.evictLRU();
    }
    this.store.set(key, entry);
    if (entry.embedding) {
      this.embeddings.set(key, entry.embedding);
    }
  }

  delete(key: string): boolean {
    this.embeddings.delete(key);
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.embeddings.clear();
  }

  size(): number {
    return this.store.size;
  }

  getEmbeddings(): Map<string, number[]> {
    return this.embeddings;
  }

  has(key: string): boolean {
    const entry = this.get(key);
    return entry !== undefined;
  }

  private evictLRU(): void {
    let leastKey: string | null = null;
    let leastHits = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.hitCount < leastHits) {
        leastHits = entry.hitCount;
        leastKey = key;
      }
    }

    if (leastKey) {
      this.store.delete(leastKey);
      this.embeddings.delete(leastKey);
    }
  }
}

// ─── Redis Cache Backend ─────────────────────────────────────────────────────

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export class RedisCacheBackend {
  private redis: unknown;
  private keyPrefix: string;
  private maxEntries: number;

  constructor(config: RedisConfig, maxEntries: number = 10000) {
    this.keyPrefix = config.keyPrefix ?? "ai_cache:";
    this.maxEntries = maxEntries;

    try {
      // Dynamic import for optional Redis dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require("ioredis");
      this.redis = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db ?? 0,
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          return Math.min(times * 50, 2000);
        },
      });
    } catch {
      throw new Error(
        "Redis backend requires 'ioredis' package. Install with: npm install ioredis"
      );
    }
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    try {
      const data = await (this.redis as { get: (k: string) => Promise<string | null> }).get(`${this.keyPrefix}${key}`);
      if (!data) return undefined;

      const entry: CacheEntry = JSON.parse(data);
      entry.hitCount++;
      return entry;
    } catch {
      return undefined;
    }
  }

  async set(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void> {
    try {
      await (this.redis as { set: (k: string, v: string, ex?: number) => Promise<unknown> }).set(
        `${this.keyPrefix}${key}`,
        JSON.stringify(entry),
        "EX",
        ttlSeconds
      );
    } catch {
      // Silently fail on cache write errors
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await (this.redis as { del: (k: string) => Promise<number> }).del(`${this.keyPrefix}${key}`);
      return result > 0;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await (this.redis as { keys: (p: string) => Promise<string[]> }).keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await (this.redis as { del: (...k: string[]) => Promise<number> }).del(...keys);
      }
    } catch {
      // Silently fail
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await (this.redis as { keys: (p: string) => Promise<string[]> }).keys(`${this.keyPrefix}*`);
      return keys.length;
    } catch {
      return 0;
    }
  }
}

// ─── Semantic Similarity ─────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ─── AI Cache ────────────────────────────────────────────────────────────────

export type CacheBackend = InMemoryCacheBackend | RedisCacheBackend;

export class AICache {
  private backend: CacheBackend;
  private config: CacheConfig;
  private embeddingFn?: (text: string) => Promise<number[]>;

  constructor(config: Partial<CacheConfig> & { backend?: CacheBackend }) {
    this.config = {
      ttlSeconds: config.ttlSeconds ?? 3600,
      maxEntries: config.maxEntries ?? 10000,
      semanticSimilarity: config.semanticSimilarity ?? false,
      similarityThreshold: config.similarityThreshold ?? 0.92,
      strategy: config.strategy ?? "exact",
    };
    this.backend = config.backend ?? new InMemoryCacheBackend(this.config.maxEntries);
  }

  setEmbeddingFunction(fn: (text: string) => Promise<number[]>): void {
    this.embeddingFn = fn;
  }

  async get(request: CompletionRequest): Promise<CompletionResponse | null> {
    const key = generateCacheKey(request);

    // Exact match
    if (this.backend instanceof InMemoryCacheBackend) {
      const entry = this.backend.get(key);
      if (entry) return entry.response;
    } else {
      const entry = await this.backend.get(key);
      if (entry) return entry.response;
    }

    // Semantic match
    if (
      this.config.semanticSimilarity &&
      this.config.strategy !== "exact" &&
      this.embeddingFn
    ) {
      const semanticResult = await this.findSemanticMatch(request);
      if (semanticResult) return semanticResult;
    }

    return null;
  }

  async set(request: CompletionRequest, response: CompletionResponse): Promise<void> {
    const key = generateCacheKey(request);
    const now = new Date();
    const entry: CacheEntry = {
      key,
      response,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.ttlSeconds * 1000),
      hitCount: 0,
    };

    // Generate embedding for semantic search
    if (this.config.semanticSimilarity && this.embeddingFn) {
      const queryText = getQueryText(request);
      if (queryText) {
        entry.embedding = await this.embeddingFn(queryText);
      }
    }

    if (this.backend instanceof InMemoryCacheBackend) {
      this.backend.set(key, entry);
    } else {
      await this.backend.set(key, entry, this.config.ttlSeconds);
    }
  }

  async invalidate(pattern?: string): Promise<number> {
    if (pattern) {
      // Pattern-based invalidation
      if (this.backend instanceof InMemoryCacheBackend) {
        let count = 0;
        for (const key of Array.from(this.backend.getEmbeddings().keys())) {
          if (key.includes(pattern)) {
            this.backend.delete(key);
            count++;
          }
        }
        return count;
      }
    }

    await this.backend.clear();
    return 0;
  }

  async size(): Promise<number> {
    if (this.backend instanceof InMemoryCacheBackend) {
      return this.backend.size();
    }
    return this.backend.size();
  }

  private async findSemanticMatch(
    request: CompletionRequest
  ): Promise<CompletionResponse | null> {
    if (!this.embeddingFn) return null;

    const queryText = getQueryText(request);
    if (!queryText) return null;

    const queryEmbedding = await this.embeddingFn(queryText);
    let bestScore = 0;
    let bestResponse: CompletionResponse | null = null;

    if (this.backend instanceof InMemoryCacheBackend) {
      const embeddings = this.backend.getEmbeddings();
      for (const [key, embedding] of embeddings) {
        const score = cosineSimilarity(queryEmbedding, embedding);
        if (score > bestScore && score >= this.config.similarityThreshold) {
          bestScore = score;
          const entry = this.backend.get(key);
          if (entry) {
            bestResponse = entry.response;
          }
        }
      }
    }

    return bestResponse;
  }
}

// ─── Convenience Factory ─────────────────────────────────────────────────────

export function createCache(
  config: Partial<CacheConfig> & { redis?: RedisConfig }
): AICache {
  let backend: CacheBackend;

  if (config.redis) {
    backend = new RedisCacheBackend(config.redis, config.maxEntries);
  } else {
    backend = new InMemoryCacheBackend(config.maxEntries);
  }

  return new AICache({ ...config, backend });
}
