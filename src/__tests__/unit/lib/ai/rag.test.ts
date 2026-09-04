import { RAGSystem } from '@/lib/ai/rag';
import type { Document, RAGConfig } from '@/types/ai';

describe('RAGSystem', () => {
  let rag: RAGSystem;
  const defaultConfig: RAGConfig = {
    chunking: { strategy: 'fixed', chunkSize: 100, chunkOverlap: 20 },
    embeddingModel: 'text-embedding-3-small',
    embeddingProvider: 'openai',
    topK: 3,
    scoreThreshold: 0.3,
    rerankEnabled: false,
    hybridSearchWeight: 0.5,
  };

  beforeEach(() => {
    rag = new RAGSystem(defaultConfig);
  });

  describe('fixed chunking', () => {
    it('should split document into fixed-size chunks', () => {
      const doc: Document = {
        id: 'doc-1',
        content: 'A'.repeat(250),
        metadata: { source: 'test' },
      };

      const chunks = rag.chunkDocument(doc);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].documentId).toBe('doc-1');
      expect(chunks[0].id).toContain('doc-1');
    });

    it('should respect chunk size', () => {
      const doc: Document = {
        id: 'doc-2',
        content: 'Hello World! ',
        metadata: {},
      };

      const config: RAGConfig = {
        ...defaultConfig,
        chunking: { strategy: 'fixed', chunkSize: 10, chunkOverlap: 0 },
      };
      const localRag = new RAGSystem(config);
      const chunks = localRag.chunkDocument(doc);

      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(12);
      });
    });

    it('should handle content shorter than chunk size', () => {
      const doc: Document = {
        id: 'doc-3',
        content: 'Short',
        metadata: {},
      };

      const chunks = rag.chunkDocument(doc);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Short');
    });

    it('should calculate token count', () => {
      const doc: Document = {
        id: 'doc-4',
        content: 'A'.repeat(100),
        metadata: {},
      };

      const chunks = rag.chunkDocument(doc);
      expect(chunks[0].tokenCount).toBe(25);
    });
  });

  describe('recursive chunking', () => {
    it('should split using separators', () => {
      const config: RAGConfig = {
        ...defaultConfig,
        chunking: { strategy: 'recursive', chunkSize: 50, chunkOverlap: 10, separators: ['\n\n', '\n', ' '] },
      };
      const localRag = new RAGSystem(config);

      const doc: Document = {
        id: 'doc-5',
        content: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.',
        metadata: {},
      };

      const chunks = localRag.chunkDocument(doc);
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((c) => expect(c.metadata.strategy).toBe('recursive'));
    });
  });

  describe('semantic chunking', () => {
    it('should split by sentences', () => {
      const config: RAGConfig = {
        ...defaultConfig,
        chunking: { strategy: 'semantic', chunkSize: 30, chunkOverlap: 0 },
      };
      const localRag = new RAGSystem(config);

      const doc: Document = {
        id: 'doc-6',
        content: 'First sentence. Second sentence. Third sentence.',
        metadata: {},
      };

      const chunks = localRag.chunkDocument(doc);
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((c) => expect(c.metadata.strategy).toBe('semantic'));
    });
  });

  describe('embedding generation', () => {
    it('should generate deterministic embeddings', () => {
      const emb1 = rag.generateEmbedding('hello');
      const emb2 = rag.generateEmbedding('hello');
      expect(emb1).toEqual(emb2);
    });

    it('should generate different embeddings for different text', () => {
      const emb1 = rag.generateEmbedding('hello');
      const emb2 = rag.generateEmbedding('world');
      expect(emb1).not.toEqual(emb2);
    });

    it('should return normalized vectors', () => {
      const emb = rag.generateEmbedding('test');
      const norm = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 5);
    });

    it('should generate vectors of expected dimension', () => {
      const emb = rag.generateEmbedding('test');
      expect(emb.length).toBe(384);
    });
  });

  describe('cosine similarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 0, 0];
      expect(rag.cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      expect(rag.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      expect(rag.cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });

    it('should return 0 for different length vectors', () => {
      expect(rag.cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    });

    it('should return 0 for zero vector', () => {
      expect(rag.cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
  });

  describe('search', () => {
    it('should find relevant documents', () => {
      const docs: Document[] = [
        {
          id: 'doc-a',
          content: 'Machine learning is a subset of artificial intelligence',
          metadata: { topic: 'ML' },
          chunks: [],
        },
        {
          id: 'doc-b',
          content: 'Cooking recipes for pasta dishes',
          metadata: { topic: 'food' },
          chunks: [],
        },
      ];

      docs.forEach((doc) => {
        doc.chunks = rag.chunkDocument(doc);
      });

      const results = rag.search('artificial intelligence', docs);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe('doc-a');
    });

    it('should respect score threshold', () => {
      const docs: Document[] = [
        {
          id: 'doc-x',
          content: 'Completely unrelated content about gardening',
          metadata: {},
          chunks: [],
        },
      ];
      docs[0].chunks = rag.chunkDocument(docs[0]);

      const strictRag = new RAGSystem({ ...defaultConfig, scoreThreshold: 0.99 });
      const results = strictRag.search('artificial intelligence', docs);
      expect(results.length).toBe(0);
    });

    it('should respect topK limit', () => {
      const docs: Document[] = Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`,
        content: 'Machine learning and artificial intelligence systems',
        metadata: { index: i },
        chunks: [] as any,
      }));
      docs.forEach((doc) => {
        doc.chunks = rag.chunkDocument(doc);
      });

      const results = rag.search('machine learning', docs);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should return empty for no documents', () => {
      expect(rag.search('test', [])).toEqual([]);
    });
  });

  describe('searchWithEmbeddings', () => {
    it('should search by pre-computed embeddings', async () => {
      const chunks = [
        { id: 'c1', documentId: 'd1', content: 'test', embedding: rag.generateEmbedding('test content'), metadata: {}, tokenCount: 1 },
        { id: 'c2', documentId: 'd1', content: 'other', embedding: rag.generateEmbedding('other content'), metadata: {}, tokenCount: 1 },
      ];

      const queryEmb = rag.generateEmbedding('test');
      const results = await rag.searchWithEmbeddings(queryEmb, chunks);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should filter by score threshold', async () => {
      const chunks = [
        { id: 'c1', documentId: 'd1', content: 'a', embedding: [1, 0, 0], metadata: {}, tokenCount: 1 },
        { id: 'c2', documentId: 'd1', content: 'b', embedding: [0, 1, 0], metadata: {}, tokenCount: 1 },
      ];

      const strictRag = new RAGSystem({ ...defaultConfig, scoreThreshold: 0.99 });
      const results = await strictRag.searchWithEmbeddings([1, 0, 0], chunks);
      expect(results).toHaveLength(1);
    });
  });
});
