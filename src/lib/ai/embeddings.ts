import type { AIProvider } from "@/types/ai";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbeddingOptions {
  provider: AIProvider;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}

export interface EmbeddingResult {
  embeddings: number[][];
  tokenCount: number;
  latencyMs: number;
}

export interface EmbeddingCacheEntry {
  text: string;
  embedding: number[];
  model: string;
  createdAt: Date;
}

export interface ClusterResult {
  clusters: Map<number, { index: number; text: string }[]>;
  centroidLabels: string[];
}

// ─── Text Preprocessing ──────────────────────────────────────────────────────

export class TextPreprocessor {
  static clean(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .trim();
  }

  static normalizeWhitespace(text: string): string {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
  }

  static truncate(text: string, maxTokens: number, encodingRatio: number = 4): string {
    const maxChars = maxTokens * encodingRatio;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + "...";
  }

  static splitIntoChunks(
    text: string,
    chunkSize: number = 1000,
    overlap: number = 200
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
      if (start + overlap >= text.length) break;
    }

    return chunks;
  }

  static estimateTokenCount(text: string): number {
    // Rough estimation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }
}

// ─── Embedding Cache ─────────────────────────────────────────────────────────

export class EmbeddingCache {
  private store: Map<string, EmbeddingCacheEntry> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = 50000) {
    this.maxEntries = maxEntries;
  }

  private generateKey(text: string, model: string): string {
    let hash = 0;
    const str = `${model}:${text}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  get(text: string, model: string): number[] | null {
    const key = this.generateKey(text, model);
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.embedding;
  }

  set(text: string, model: string, embedding: number[]): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    const key = this.generateKey(text, model);
    this.store.set(key, {
      text,
      embedding,
      model,
      createdAt: new Date(),
    });
  }

  has(text: string, model: string): boolean {
    const key = this.generateKey(text, model);
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// ─── Provider Embedding Clients ──────────────────────────────────────────────

abstract class EmbeddingClient {
  abstract provider: AIProvider;
  abstract generate(texts: string[], dimensions?: number): Promise<number[][]>;
  abstract countTokens(texts: string[]): number;
}

class OpenAIEmbeddingClient extends EmbeddingClient {
  provider: AIProvider = "openai";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = "text-embedding-3-small") {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  }

  async generate(texts: string[], dimensions?: number): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((item: { embedding: number[] }) => item.embedding);
  }

  countTokens(texts: string[]): number {
    return texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
  }
}

class CohereEmbeddingClient extends EmbeddingClient {
  provider: AIProvider = "openai"; // Cohere isn't a primary provider, but we adapt
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "embed-english-v3.0") {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await fetch("https://api.cohere.ai/v1/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        texts,
        input_type: "search_document",
        embedding_types: ["float"],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere embedding error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.embeddings.float;
  }

  countTokens(texts: string[]): number {
    return texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
  }
}

// ─── Embedding Pipeline ──────────────────────────────────────────────────────

export class EmbeddingPipeline {
  private clients: Map<string, EmbeddingClient> = new Map();
  private cache: EmbeddingCache;
  private defaultProvider: AIProvider;

  constructor(options: EmbeddingOptions & { apiKey?: string; cohereApiKey?: string }) {
    this.defaultProvider = options.provider;
    this.cache = new EmbeddingCache();

    if (options.apiKey) {
      this.clients.set("openai", new OpenAIEmbeddingClient(options.apiKey));
    }
    if (options.cohereApiKey) {
      this.clients.set("cohere", new CohereEmbeddingClient(options.cohereApiKey));
    }
  }

  async embed(
    texts: string[],
    options: Partial<EmbeddingOptions> = {}
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const provider = options.provider ?? this.defaultProvider;
    const model = options.model;
    const batchSize = options.batchSize ?? 100;

    const cleanedTexts = texts.map((t) => TextPreprocessor.clean(t));
    const cachedResults: (number[] | null)[] = [];
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // Check cache
    for (let i = 0; i < cleanedTexts.length; i++) {
      const modelKey = model ?? this.getDefaultModel(provider);
      const cached = this.cache.get(cleanedTexts[i], modelKey);
      if (cached) {
        cachedResults.push(cached);
      } else {
        cachedResults.push(null);
        uncachedIndices.push(i);
        uncachedTexts.push(cleanedTexts[i]);
      }
    }

    // Batch embed uncached texts
    const newEmbeddings: number[][] = [];
    if (uncachedTexts.length > 0) {
      const client = this.getClient(provider);
      const modelKey = model ?? this.getDefaultModel(provider);

      for (let i = 0; i < uncachedTexts.length; i += batchSize) {
        const batch = uncachedTexts.slice(i, i + batchSize);
        const batchEmbeddings = await client.generate(batch, options.dimensions);
        newEmbeddings.push(...batchEmbeddings);

        // Cache results
        for (let j = 0; j < batch.length; j++) {
          this.cache.set(batch[j], modelKey, batchEmbeddings[j]);
        }
      }
    }

    // Merge results
    const allEmbeddings: number[][] = [];
    let newIndex = 0;
    for (let i = 0; i < cachedResults.length; i++) {
      if (cachedResults[i]) {
        allEmbeddings.push(cachedResults[i]!);
      } else {
        allEmbeddings.push(newEmbeddings[newIndex]);
        newIndex++;
      }
    }

    const tokenCount = cleanedTexts.reduce((sum, t) => sum + TextPreprocessor.estimateTokenCount(t), 0);

    return {
      embeddings: allEmbeddings,
      tokenCount,
      latencyMs: Date.now() - startTime,
    };
  }

  async embedSingle(text: string, options: Partial<EmbeddingOptions> = {}): Promise<number[]> {
    const result = await this.embed([text], options);
    return result.embeddings[0];
  }

  async findSimilar(
    query: string,
    candidates: { text: string; id: string; embedding?: number[] }[],
    topK: number = 5
  ): Promise<{ id: string; text: string; score: number }[]> {
    const queryEmbedding = await this.embedSingle(query);

    const scored = candidates.map((c) => ({
      id: c.id,
      text: c.text,
      score: c.embedding
        ? cosineSimilarity(queryEmbedding, c.embedding)
        : 0,
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  getCache(): EmbeddingCache {
    return this.cache;
  }

  private getClient(provider: AIProvider): EmbeddingClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(
        `No embedding client configured for provider: ${provider}. ` +
        `Provide an API key for this provider.`
      );
    }
    return client;
  }

  private getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case "openai":
        return "text-embedding-3-small";
      default:
        return "default";
    }
  }
}

// ─── Similarity Utilities ────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
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

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// ─── Dimension Reduction (PCA) ──────────────────────────────────────────────

export function reduceDimensions(
  embeddings: number[][],
  targetDimensions: number
): number[][] {
  if (targetDimensions >= embeddings[0]?.length ?? 0) {
    return embeddings;
  }

  // Simple PCA-like reduction using random projection
  const originalDim = embeddings[0].length;
  const projectionMatrix: number[][] = [];

  // Generate random projection matrix with Gaussian-like values
  for (let i = 0; i < originalDim; i++) {
    projectionMatrix.push([]);
    for (let j = 0; j < targetDimensions; j++) {
      // Use deterministic pseudo-random based on indices
      const seed = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      projectionMatrix[i].push(seed - Math.floor(seed) - 0.5);
    }
  }

  return embeddings.map((emb) => {
    const result: number[] = new Array(targetDimensions).fill(0);
    for (let j = 0; j < targetDimensions; j++) {
      for (let i = 0; i < originalDim; i++) {
        result[j] += emb[i] * projectionMatrix[i][j];
      }
    }
    return result;
  });
}

// ─── Clustering ──────────────────────────────────────────────────────────────

export function kMeansClustering(
  embeddings: number[][],
  k: number,
  maxIterations: number = 100
): ClusterResult {
  const n = embeddings.length;
  if (n === 0 || k === 0) {
    return { clusters: new Map(), centroidLabels: [] };
  }

  const dim = embeddings[0].length;
  const actualK = Math.min(k, n);

  // Initialize centroids using k-means++
  const centroids: number[][] = [];
  const used = new Set<number>();

  // Pick first centroid randomly
  const firstIdx = 0;
  centroids.push([...embeddings[firstIdx]]);
  used.add(firstIdx);

  for (let c = 1; c < actualK; c++) {
    const distances = embeddings.map((emb, idx) => {
      if (used.has(idx)) return 0;
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = euclideanDistance(emb, centroid);
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      random -= distances[i];
      if (random <= 0 && !used.has(i)) {
        centroids.push([...embeddings[i]]);
        used.add(i);
        break;
      }
    }
  }

  // Iteratively assign and update
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = embeddings.map((emb) => {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < actualK; c++) {
        const dist = euclideanDistance(emb, centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    if (!changed) break;
    assignments = newAssignments;

    // Update centroids
    for (let c = 0; c < actualK; c++) {
      const members = embeddings.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;

      for (let d = 0; d < dim; d++) {
        centroids[c][d] = members.reduce((sum, m) => sum + m[d], 0) / members.length;
      }
    }
  }

  // Build cluster map
  const clusters = new Map<number, { index: number; text: string }[]>();
  for (let c = 0; c < actualK; c++) {
    clusters.set(c, []);
  }
  assignments.forEach((cluster, idx) => {
    clusters.get(cluster)!.push({ index: idx, text: "" });
  });

  return {
    clusters,
    centroidLabels: centroids.map((_, i) => `cluster_${i}`),
  };
}
