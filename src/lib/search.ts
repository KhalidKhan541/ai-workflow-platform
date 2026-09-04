// Search engine utilities with full-text and faceted search

import { generateId } from './utils';
import { cache, cacheAside } from './cache';

// ─── Types ───────────────────────────────────────────────
export interface SearchIndex<T = Record<string, unknown>> {
  id: string;
  name: string;
  fields: SearchField[];
  documents: Map<string, T>;
  createdAt: Date;
}

export interface SearchField {
  name: string;
  type: 'text' | 'keyword' | 'number' | 'date' | 'boolean';
  searchable?: boolean;
  facetable?: boolean;
  sortable?: boolean;
}

export interface SearchQuery {
  query: string;
  filters?: Record<string, unknown>;
  facets?: string[];
  highlight?: boolean;
  highlightFields?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T = Record<string, unknown>> {
  items: SearchResultItem<T>[];
  total: number;
  page: number;
  pageSize: number;
  facets: Record<string, FacetResult>;
  tookMs: number;
}

export interface SearchResultItem<T = Record<string, unknown>> {
  id: string;
  score: number;
  data: T;
  highlights?: Record<string, string>;
}

export interface FacetResult {
  field: string;
  values: Array<{ value: string | number; count: number }>;
}

export interface SearchAnalytics {
  totalQueries: number;
  topQueries: Array<{ query: string; count: number }>;
  averageResults: number;
  zeroResultQueries: Array<{ query: string; count: number }>;
}

// ─── Search Index ────────────────────────────────────────
class SearchIndexManager {
  private indexes = new Map<string, SearchIndex>();
  private analytics: SearchAnalytics = { totalQueries: 0, topQueries: [], averageResults: 0, zeroResultQueries: [] };

  createIndex<T = Record<string, unknown>>(name: string, fields: SearchField[]): SearchIndex<T> {
    if (this.indexes.has(name)) {
      throw new Error(`Index '${name}' already exists`);
    }

    const index: SearchIndex<T> = {
      id: generateId(),
      name,
      fields,
      documents: new Map(),
      createdAt: new Date(),
    };

    this.indexes.set(name, index);
    return index;
  }

  getIndex(name: string): SearchIndex | undefined {
    return this.indexes.get(name);
  }

  deleteIndex(name: string): boolean {
    return this.indexes.delete(name);
  }

  async addDocument<T extends Record<string, unknown>>(indexName: string, id: string, data: T): Promise<void> {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index '${indexName}' not found`);
    index.documents.set(id, data);
  }

  async addDocuments<T extends Record<string, unknown>>(indexName: string, documents: Array<{ id: string; data: T }>): Promise<void> {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index '${indexName}' not found`);
    for (const doc of documents) {
      index.documents.set(doc.id, doc.data);
    }
  }

  async updateDocument<T extends Record<string, unknown>>(indexName: string, id: string, data: Partial<T>): Promise<void> {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index '${indexName}' not found`);
    const existing = index.documents.get(id);
    if (!existing) throw new Document(`Document '${id}' not found in index '${indexName}'`);
    index.documents.set(id, { ...existing, ...data } as T);
  }

  async deleteDocument(indexName: string, id: string): Promise<boolean> {
    const index = this.indexes.get(indexName);
    if (!index) return false;
    return index.documents.delete(id);
  }

  async search<T extends Record<string, unknown>>(indexName: string, query: SearchQuery): Promise<SearchResult<T>> {
    const startTime = Date.now();
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index '${indexName}' not found`);

    let results = Array.from(index.documents.entries()).map(([id, data]) => ({
      id,
      score: 1,
      data: data as T,
    }));

    // Text search
    if (query.query) {
      const searchTerms = query.query.toLowerCase().split(/\s+/);
      results = results
        .map((item) => {
          let score = 0;
          for (const field of index.fields) {
            if (field.type !== 'text' || field.searchable === false) continue;
            const value = String((item.data as Record<string, unknown>)[field.name] || '').toLowerCase();
            for (const term of searchTerms) {
              if (value.includes(term)) {
                score += value.startsWith(term) ? 10 : value.includes(term) ? 5 : 1;
              }
            }
          }
          return { ...item, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
    }

    // Apply filters
    if (query.filters) {
      results = results.filter((item) => {
        for (const [key, value] of Object.entries(query.filters!)) {
          const itemValue = (item.data as Record<string, unknown>)[key];
          if (itemValue !== value) return false;
        }
        return true;
      });
    }

    // Calculate facets
    const facets: Record<string, FacetResult> = {};
    if (query.facets) {
      for (const facetField of query.facets) {
        const counts = new Map<string | number, number>();
        for (const item of results) {
          const value = (item.data as Record<string, unknown>)[facetField];
          if (value !== undefined && value !== null) {
            const key = typeof value === 'object' ? JSON.stringify(value) : value as string | number;
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
        facets[facetField] = {
          field: facetField,
          values: Array.from(counts.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count),
        };
      }
    }

    // Sort
    if (query.sortBy) {
      const order = query.sortOrder === 'asc' ? 1 : -1;
      results.sort((a, b) => {
        const aVal = (a.data as Record<string, unknown>)[query.sortBy!];
        const bVal = (b.data as Record<string, unknown>)[query.sortBy!];
        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        return 0;
      });
    }

    const total = results.length;

    // Pagination
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedResults = results.slice(start, start + pageSize);

    // Highlight
    if (query.highlight && query.query) {
      const searchTerms = query.query.toLowerCase().split(/\s+/);
      for (const item of paginatedResults) {
        item.highlights = {};
        for (const fieldName of query.highlightFields || index.fields.filter((f) => f.type === 'text').map((f) => f.name)) {
          const value = String((item.data as Record<string, unknown>)[fieldName] || '');
          let highlighted = value;
          for (const term of searchTerms) {
            const regex = new RegExp(`(${term})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
          }
          if (highlighted !== value) {
            item.highlights[fieldName] = highlighted;
          }
        }
      }
    }

    const tookMs = Date.now() - startTime;

    // Update analytics
    this.analytics.totalQueries++;
    this.analytics.topQueries.push({ query: query.query, count: 1 });
    if (total === 0) {
      this.analytics.zeroResultQueries.push({ query: query.query, count: 1 });
    }

    return { items: paginatedResults, total, page, pageSize, facets, tookMs };
  }

  getAnalytics(): SearchAnalytics {
    // Deduplicate and sort
    const queryCounts = new Map<string, number>();
    for (const entry of this.analytics.topQueries) {
      queryCounts.set(entry.query, (queryCounts.get(entry.query) || 0) + entry.count);
    }
    this.analytics.topQueries = Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return this.analytics;
  }

  listIndexes(): string[] {
    return Array.from(this.indexes.keys());
  }
}

// ─── Singleton ───────────────────────────────────────────
const globalSearch = globalThis as unknown as { __searchManager?: SearchIndexManager };
export const searchManager = globalSearch.__searchManager || new SearchIndexManager();
if (process.env.NODE_ENV !== 'production') {
  globalSearch.__searchManager = searchManager;
}

// ─── Highlight Matching ──────────────────────────────────
export function highlightText(text: string, query: string, highlightClass: string = 'highlight'): string {
  if (!query) return text;
  const terms = query.toLowerCase().split(/\s+/);
  let result = text;
  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    result = result.replace(regex, `<span class="${highlightClass}">$1</span>`);
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Convenience Functions ───────────────────────────────
export function createIndex<T extends Record<string, unknown>>(name: string, fields: SearchField[]): SearchIndex<T> {
  return searchManager.createIndex<T>(name, fields);
}

export function search<T extends Record<string, unknown>>(indexName: string, query: SearchQuery): Promise<SearchResult<T>> {
  return searchManager.search<T>(indexName, query);
}
