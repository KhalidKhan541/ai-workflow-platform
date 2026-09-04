// HTTP client utilities with retry, timeout, and caching

import { generateId } from './utils';
import { cache } from './cache';

// ─── Types ───────────────────────────────────────────────
export interface HTTPConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retry?: { attempts: number; delay: number; backoff: 'linear' | 'exponential' };
  cache?: { enabled: boolean; ttl: number };
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retry?: boolean;
  cache?: boolean;
  cacheTtl?: number;
  params?: Record<string, string | number | boolean>;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';
}

export interface HTTPResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestOptions;
  requestId: string;
}

export interface HTTPError extends Error {
  status?: number;
  statusText?: string;
  data?: unknown;
  headers?: Record<string, string>;
  requestId: string;
}

export interface Interceptor {
  onRequest?: (config: RequestOptions) => RequestOptions | Promise<RequestOptions>;
  onResponse?: (response: HTTPResponse) => HTTPResponse | Promise<HTTPResponse>;
  onError?: (error: HTTPError) => HTTPError | Promise<HTTPError>;
}

// ─── Request/Response Transformation ─────────────────────
function buildUrl(baseURL: string, url: string, params?: Record<string, string | number | boolean>): string {
  let fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
  }
  return fullUrl;
}

function buildHeaders(
  defaultHeaders: Record<string, string>,
  requestHeaders?: HeadersInit
): Record<string, string> {
  const headers: Record<string, string> = { ...defaultHeaders };
  if (requestHeaders) {
    if (requestHeaders instanceof Headers) {
      requestHeaders.forEach((value, key) => { headers[key] = value; });
    } else if (Array.isArray(requestHeaders)) {
      requestHeaders.forEach(([key, value]) => { headers[key] = value; });
    } else {
      Object.assign(headers, requestHeaders);
    }
  }
  return headers;
}

async function parseResponse<T>(response: Response, responseType: string): Promise<T> {
  switch (responseType) {
    case 'json': return response.json() as Promise<T>;
    case 'text': return response.text() as unknown as T;
    case 'blob': return response.blob() as unknown as T;
    case 'arrayBuffer': return response.arrayBuffer() as unknown as T;
    default: return response.json() as Promise<T>;
  }
}

// ─── HTTP Client ─────────────────────────────────────────
class HTTPClient {
  private config: HTTPConfig;
  private interceptors: Interceptor[] = [];
  private activeRequests = new Map<string, AbortController>();

  constructor(config: HTTPConfig = {}) {
    this.config = {
      baseURL: config.baseURL || '',
      timeout: config.timeout || 30000,
      headers: config.headers || { 'Content-Type': 'application/json' },
      retry: { attempts: 3, delay: 1000, backoff: 'exponential', ...config.retry },
      cache: { enabled: false, ttl: 60000, ...config.cache },
    };
  }

  addInterceptor(interceptor: Interceptor): () => void {
    this.interceptors.push(interceptor);
    return () => {
      const idx = this.interceptors.indexOf(interceptor);
      if (idx > -1) this.interceptors.splice(idx, 1);
    };
  }

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<HTTPResponse<T>> {
    const requestId = generateId();
    let config: RequestOptions = {
      ...options,
      url,
      timeout: options.timeout || this.config.timeout,
    };

    // Apply request interceptors
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        config = await interceptor.onRequest(config);
      }
    }

    // Check cache
    const cacheKey = `http:${config.method || 'GET'}:${url}:${JSON.stringify(config.params)}`;
    if (this.config.cache?.enabled && options.cache !== false && (!config.method || config.method === 'GET')) {
      const cached = await cache.get<HTTPResponse<T>>(cacheKey);
      if (cached) return cached;
    }

    // Create abort controller for timeout/cancellation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    this.activeRequests.set(requestId, controller);

    try {
      const fullUrl = buildUrl(this.config.baseURL || '', url, config.params);
      const headers = buildHeaders(this.config.headers || {}, config.headers);

      let lastError: Error | null = null;
      const maxAttempts = config.retry === false ? 1 : (this.config.retry?.attempts || 1);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await fetch(fullUrl, {
            ...config,
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          this.activeRequests.delete(requestId);

          const data = await parseResponse<T>(response, config.responseType || 'json');
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => { responseHeaders[key] = value; });

          let httpResponse: HTTPResponse<T> = {
            data,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            config,
            requestId,
          };

          // Apply response interceptors
          for (const interceptor of this.interceptors) {
            if (interceptor.onResponse) {
              httpResponse = await interceptor.onResponse(httpResponse);
            }
          }

          // Cache successful GET responses
          if (this.config.cache?.enabled && config.cache !== false && (!config.method || config.method === 'GET')) {
            await cache.set(cacheKey, httpResponse, this.config.cache.ttl);
          }

          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as HTTPError;
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = data;
            error.headers = responseHeaders;
            error.requestId = requestId;
            throw error;
          }

          return httpResponse;
        } catch (error) {
          lastError = error as Error;

          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${config.timeout}ms`);
          }

          if (attempt < maxAttempts - 1) {
            const delay = (this.config.retry?.delay || 1000) *
              (this.config.retry?.backoff === 'exponential' ? Math.pow(2, attempt) : 1);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      throw lastError;
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);

      let httpError: HTTPError;
      if (error instanceof Error && 'status' in error) {
        httpError = error as HTTPError;
      } else {
        httpError = Object.assign(error as Error, { requestId }) as HTTPError;
      }

      // Apply error interceptors
      for (const interceptor of this.interceptors) {
        if (interceptor.onError) {
          httpError = await interceptor.onError(httpError);
        }
      }

      throw httpError;
    }
  }

  async get<T = unknown>(url: string, options?: RequestOptions): Promise<HTTPResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<HTTPResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body: data ? JSON.stringify(data) : undefined });
  }

  async put<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<HTTPResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body: data ? JSON.stringify(data) : undefined });
  }

  async patch<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<HTTPResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body: data ? JSON.stringify(data) : undefined });
  }

  async delete<T = unknown>(url: string, options?: RequestOptions): Promise<HTTPResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  cancelAllRequests(): void {
    this.activeRequests.forEach((controller) => controller.abort());
    this.activeRequests.clear();
  }
}

// ─── Singleton HTTP Client ───────────────────────────────
const globalHttp = globalThis as unknown as { __httpClient?: HTTPClient };
export const httpClient = globalHttp.__httpClient || new HTTPClient();
if (process.env.NODE_ENV !== 'production') {
  globalHttp.__httpClient = httpClient;
}

// ─── Convenience Functions ───────────────────────────────
export async function httpGet<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
  const response = await httpClient.get<T>(url, options);
  return response.data;
}

export async function httpPost<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
  const response = await httpClient.post<T>(url, data, options);
  return response.data;
}

export async function httpPut<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
  const response = await httpClient.put<T>(url, data, options);
  return response.data;
}

export async function httpDelete<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
  const response = await httpClient.delete<T>(url, options);
  return response.data;
}

export { HTTPClient };
