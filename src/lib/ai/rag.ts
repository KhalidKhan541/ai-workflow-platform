import type {
  Document,
  DocumentChunk,
  ChunkingConfig,
  RAGConfig,
  SearchResult,
} from "@/types/ai";
import { EmbeddingPipeline, TextPreprocessor } from "./embeddings";

// ─── Chunking Strategies ─────────────────────────────────────────────────────

export interface Chunker {
  chunk(text: string, config: ChunkingConfig): string[];
}

export class FixedSizeChunker implements Chunker {
  chunk(text: string, config: ChunkingConfig): string[] {
    const { chunkSize, chunkOverlap } = config;
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - chunkOverlap;
      if (start + chunkOverlap >= text.length) break;
    }

    return chunks;
  }
}

export class RecursiveChunker implements Chunker {
  private defaultSeparators = ["\n\n", "\n", ". ", " ", ""];

  chunk(text: string, config: ChunkingConfig): string[] {
    const separators = config.separators ?? this.defaultSeparators;
    return this.recursiveSplit(text, config.chunkSize, config.chunkOverlap, separators);
  }

  private recursiveSplit(
    text: string,
    chunkSize: number,
    overlap: number,
    separators: string[]
  ): string[] {
    if (text.length <= chunkSize) return [text];

    const separator = separators[0] ?? "";
    const remainingSeparators = separators.slice(1);

    if (!separator) {
      return this.forceSplit(text, chunkSize, overlap);
    }

    const parts = text.split(separator);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const part of parts) {
      const testChunk = currentChunk ? currentChunk + separator + part : part;

      if (testChunk.length <= chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        if (part.length > chunkSize) {
          chunks.push(...this.recursiveSplit(part, chunkSize, overlap, remainingSeparators));
          currentChunk = "";
        } else {
          currentChunk = part;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private forceSplit(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
    }
    return chunks;
  }
}

export class SemanticChunker implements Chunker {
  private embeddingPipeline: EmbeddingPipeline;

  constructor(embeddingPipeline: EmbeddingPipeline) {
    this.embeddingPipeline = embeddingPipeline;
  }

  async chunkAsync(text: string, config: ChunkingConfig): Promise<string[]> {
    const sentences = this.splitIntoSentences(text);
    if (sentences.length <= 3) return [text];

    const embeddings = await this.embeddingPipeline.embed(sentences);

    const chunks: string[] = [];
    let currentChunk: string[] = [sentences[0]];
    let threshold = config.chunkOverlap / 100 || 0.3;

    for (let i = 1; i < sentences.length; i++) {
      const similarity = cosineSimilarity(
        embeddings.embeddings[i - 1],
        embeddings.embeddings[i]
      );

      if (similarity < threshold) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [sentences[i]];
      } else {
        currentChunk.push(sentences[i]);
      }

      if (currentChunk.join(" ").length > config.chunkSize) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }

  chunk(text: string, config: ChunkingConfig): string[] {
    // Fallback to recursive chunking for synchronous use
    const recursive = new RecursiveChunker();
    return recursive.chunk(text, config);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
  }
}

function createChunker(config: ChunkingConfig, embeddingPipeline?: EmbeddingPipeline): Chunker {
  switch (config.strategy) {
    case "fixed":
      return new FixedSizeChunker();
    case "semantic":
      if (!embeddingPipeline) {
        throw new Error("Semantic chunking requires an embedding pipeline");
      }
      return new SemanticChunker(embeddingPipeline);
    case "recursive":
    default:
      return new RecursiveChunker();
  }
}

// ─── RAG Store ───────────────────────────────────────────────────────────────

export interface RAGStoreConfig {
  useInMemory: boolean;
  pgvectorConnectionString?: string;
  collectionName?: string;
}

export class InMemoryRAGStore {
  private chunks: Map<string, DocumentChunk> = new Map();
  private documents: Map<string, Document> = new Map();

  addDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
    if (doc.chunks) {
      for (const chunk of doc.chunks) {
        this.chunks.set(chunk.id, chunk);
      }
    }
  }

  removeDocument(docId: string): void {
    const doc = this.documents.get(docId);
    if (doc?.chunks) {
      for (const chunk of doc.chunks) {
        this.chunks.delete(chunk.id);
      }
    }
    this.documents.delete(docId);
  }

  getAllChunks(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  getDocument(docId: string): Document | undefined {
    return this.documents.get(docId);
  }

  search(
    queryEmbedding: number[],
    topK: number,
    filter?: (chunk: DocumentChunk) => boolean
  ): SearchResult[] {
    let candidates = Array.from(this.chunks.values());
    if (filter) {
      candidates = candidates.filter(filter);
    }

    return candidates
      .map((chunk) => ({
        chunk,
        score: chunk.embedding
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : 0,
        document: this.documents.get(chunk.documentId)!,
      }))
      .filter((r) => r.document)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  size(): number {
    return this.chunks.size;
  }

  clear(): void {
    this.chunks.clear();
    this.documents.clear();
  }
}

// ─── Hybrid Search ───────────────────────────────────────────────────────────

export class HybridSearchEngine {
  private keywordIndex: Map<string, Set<string>> = new Map();
  private store: InMemoryRAGStore;

  constructor(store: InMemoryRAGStore) {
    this.store = store;
    this.buildIndex();
  }

  private buildIndex(): void {
    const chunks = this.store.getAllChunks();
    for (const chunk of chunks) {
      const words = chunk.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/[^a-z0-9]/g, "");
        if (clean.length < 2) continue;
        const set = this.keywordIndex.get(clean) ?? new Set();
        set.add(chunk.id);
        this.keywordIndex.set(clean, set);
      }
    }
  }

  addChunk(chunk: DocumentChunk): void {
    const words = chunk.content.toLowerCase().split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[^a-z0-9]/g, "");
      if (clean.length < 2) continue;
      const set = this.keywordIndex.get(clean) ?? new Set();
      set.add(chunk.id);
      this.keywordIndex.set(clean, set);
    }
  }

  keywordSearch(query: string, topK: number): { chunkId: string; score: number }[] {
    const words = query.toLowerCase().split(/\s+/);
    const scores: Map<string, number> = new Map();

    for (const word of words) {
      const clean = word.replace(/[^a-z0-9]/g, "");
      const chunkIds = this.keywordIndex.get(clean);
      if (chunkIds) {
        for (const id of chunkIds) {
          scores.set(id, (scores.get(id) ?? 0) + 1);
        }
      }
    }

    return Array.from(scores.entries())
      .map(([chunkId, score]) => ({ chunkId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  search(
    query: string,
    queryEmbedding: number[],
    topK: number,
    semanticWeight: number = 0.7
  ): SearchResult[] {
    const keywordResults = this.keywordSearch(query, topK * 2);
    const semanticResults = this.store.search(queryEmbedding, topK * 2);

    const maxKeywordScore = Math.max(...keywordResults.map((r) => r.score), 1);
    const maxSemanticScore = Math.max(...semanticResults.map((r) => r.score), 0.001);

    const combinedScores = new Map<string, number>();

    for (const kr of keywordResults) {
      const normalizedScore = kr.score / maxKeywordScore;
      combinedScores.set(kr.chunkId, (1 - semanticWeight) * normalizedScore);
    }

    for (const sr of semanticResults) {
      const normalizedScore = sr.score / maxSemanticScore;
      const existing = combinedScores.get(sr.chunk.id) ?? 0;
      combinedScores.set(sr.chunk.id, existing + semanticWeight * normalizedScore);
    }

    return Array.from(combinedScores.entries())
      .map(([chunkId, score]) => {
        const chunk = this.store.getAllChunks().find((c) => c.id === chunkId);
        if (!chunk) return null;
        return {
          chunk,
          score,
          document: this.store.getDocument(chunk.documentId)!,
        };
      })
      .filter((r): r is SearchResult => r !== null && r.document !== undefined)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// ─── RAG Engine ──────────────────────────────────────────────────────────────

export class RAGEngine {
  private embeddingPipeline: EmbeddingPipeline;
  private store: InMemoryRAGStore;
  private hybridSearch: HybridSearchEngine;
  private config: RAGConfig;

  constructor(
    embeddingPipeline: EmbeddingPipeline,
    config: Partial<RAGConfig> = {}
  ) {
    this.embeddingPipeline = embeddingPipeline;
    this.config = {
      chunking: {
        strategy: config.chunking?.strategy ?? "recursive",
        chunkSize: config.chunking?.chunkSize ?? 1000,
        chunkOverlap: config.chunking?.chunkOverlap ?? 200,
        separators: config.chunking?.separators,
      },
      embeddingModel: config.embeddingModel ?? "text-embedding-3-small",
      embeddingProvider: config.embeddingProvider ?? "openai",
      topK: config.topK ?? 5,
      scoreThreshold: config.scoreThreshold ?? 0.5,
      rerankEnabled: config.rerankEnabled ?? false,
      hybridSearchWeight: config.hybridSearchWeight ?? 0.7,
    };

    this.store = new InMemoryRAGStore();
    this.hybridSearch = new HybridSearchEngine(this.store);
  }

  async ingestDocument(
    document: Document
  ): Promise<Document> {
    const chunker = createChunker(this.config.chunking, this.embeddingPipeline);
    const textChunks = chunker.chunk(document.content, this.config.chunking);

    const chunks: DocumentChunk[] = [];
    let tokenOffset = 0;

    for (let i = 0; i < textChunks.length; i++) {
      const content = textChunks[i];
      const tokenCount = Math.ceil(content.length / 4);

      const embeddingResult = await this.embeddingPipeline.embed([content], {
        provider: this.config.embeddingProvider,
        model: this.config.embeddingModel,
      });

      chunks.push({
        id: `${document.id}_chunk_${i}`,
        documentId: document.id,
        content,
        embedding: embeddingResult.embeddings[0],
        metadata: {
          ...document.metadata,
          chunkIndex: i,
          tokenOffset,
          tokenCount,
        },
        tokenCount,
      });

      tokenOffset += tokenCount;
    }

    const enrichedDoc: Document = {
      ...document,
      chunks,
    };

    this.store.addDocument(enrichedDoc);

    for (const chunk of chunks) {
      this.hybridSearch.addChunk(chunk);
    }

    return enrichedDoc;
  }

  async ingestText(
    text: string,
    metadata: Record<string, unknown> = {}
  ): Promise<Document> {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const document: Document = {
      id: docId,
      content: text,
      metadata,
    };

    return this.ingestDocument(document);
  }

  async search(
    query: string,
    options: {
      topK?: number;
      filter?: (chunk: DocumentChunk) => boolean;
      useHybrid?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK ?? this.config.topK;

    const queryEmbeddingResult = await this.embeddingPipeline.embed([query], {
      provider: this.config.embeddingProvider,
      model: this.config.embeddingModel,
    });

    const queryEmbedding = queryEmbeddingResult.embeddings[0];

    let results: SearchResult[];

    if (options.useHybrid !== false) {
      results = this.hybridSearch.search(
        query,
        queryEmbedding,
        topK,
        this.config.hybridSearchWeight
      );
    } else {
      results = this.store.search(queryEmbedding, topK, options.filter);
    }

    return results.filter((r) => r.score >= this.config.scoreThreshold);
  }

  async getContextForQuery(
    query: string,
    maxTokens: number = 4000
  ): Promise<{ context: string; citations: { text: string; source: string; score: number }[] }> {
    const results = await this.search(query);

    let totalTokens = 0;
    const contextParts: string[] = [];
    const citations: { text: string; source: string; score: number }[] = [];

    for (const result of results) {
      const chunkTokens = result.chunk.tokenCount;
      if (totalTokens + chunkTokens > maxTokens) break;

      contextParts.push(result.chunk.content);
      citations.push({
        text: result.chunk.content.slice(0, 100) + "...",
        source: String(result.document.metadata.title ?? result.document.id),
        score: result.score,
      });

      totalTokens += chunkTokens;
    }

    return {
      context: contextParts.join("\n\n---\n\n"),
      citations,
    };
  }

  removeDocument(docId: string): void {
    this.store.removeDocument(docId);
  }

  size(): number {
    return this.store.size();
  }

  getStore(): InMemoryRAGStore {
    return this.store;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

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
