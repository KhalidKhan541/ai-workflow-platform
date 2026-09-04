// ============================================================================
// Base Integration Framework
// OAuth2 (Auth Code, PKCE, Client Credentials), API Key auth, Rate limiting,
// Request/response interceptors, Token refresh, Error classification
// ============================================================================

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum AuthType {
  OAuth2 = 'oauth2',
  OAuth2PKCE = 'oauth2_pkce',
  ClientCredentials = 'client_credentials',
  ApiKey = 'api_key',
  Bearer = 'bearer',
  Basic = 'basic',
}

export enum ErrorCategory {
  Auth = 'auth',
  RateLimit = 'rate_limit',
  Server = 'server',
  Client = 'client',
  Network = 'network',
  Unknown = 'unknown',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface OAuth2Config {
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string;
}

export interface OAuth2PKCEConfig extends OAuth2Config {
  codeVerifier?: string;
  codeChallenge?: string;
}

export interface ClientCredentialsConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
}

export interface ApiKeyConfig {
  key: string;
  location: 'header' | 'query';
  name: string;
}

export interface BearerConfig {
  token: string;
}

export interface BasicConfig {
  username: string;
  password: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfter?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  timeout?: number;
}

export interface ResponseData<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface IntegrationError extends Error {
  category: ErrorCategory;
  statusCode?: number;
  retryable: boolean;
  requestId?: string;
  details?: unknown;
}

export interface InterceptorConfig {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onResponse?: <T>(response: ResponseData<T>) => ResponseData<T> | Promise<ResponseData<T>>;
  onError?: (error: IntegrationError) => IntegrationError | Promise<IntegrationError>;
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  retryAfter: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function classifyError(statusCode: number): ErrorCategory {
  if (statusCode === 401 || statusCode === 403) return ErrorCategory.Auth;
  if (statusCode === 429) return ErrorCategory.RateLimit;
  if (statusCode >= 400 && statusCode < 500) return ErrorCategory.Client;
  if (statusCode >= 500) return ErrorCategory.Server;
  return ErrorCategory.Unknown;
}

function createIntegrationError(
  message: string,
  statusCode?: number,
  details?: unknown,
  requestId?: string,
): IntegrationError {
  const category = statusCode ? classifyError(statusCode) : ErrorCategory.Network;
  const retryable = [ErrorCategory.RateLimit, ErrorCategory.Server, ErrorCategory.Network].includes(category);
  const error = new Error(message) as IntegrationError;
  error.category = category;
  error.statusCode = statusCode;
  error.retryable = retryable;
  error.requestId = requestId;
  error.details = details;
  return error;
}

// ---------------------------------------------------------------------------
// Base Integration Class
// ---------------------------------------------------------------------------

export abstract class BaseIntegration {
  protected authType: AuthType;
  protected tokenData: TokenData | null = null;
  protected rateLimitState: RateLimitState = { requests: 0, windowStart: 0, retryAfter: 0 };
  protected interceptors: InterceptorConfig = {};
  protected rateLimitConfig: RateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  protected retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  };

  constructor(protected baseUrl: string, protected authConfig: unknown) {
    this.authType = this.determineAuthType();
  }

  protected abstract determineAuthType(): AuthType;
  protected abstract getAuthHeaders(): Promise<Record<string, string>>;

  // -- Interceptors --------------------------------------------------------

  setInterceptors(interceptors: InterceptorConfig): void {
    this.interceptors = { ...this.interceptors, ...interceptors };
  }

  // -- Rate Limiting -------------------------------------------------------

  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.rateLimitState.windowStart > this.rateLimitConfig.windowMs) {
      this.rateLimitState = { requests: 0, windowStart: now, retryAfter: 0 };
    }
    if (this.rateLimitState.retryAfter > now) {
      const waitMs = this.rateLimitState.retryAfter - now;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    if (this.rateLimitState.requests >= this.rateLimitConfig.maxRequests) {
      const waitMs = this.rateLimitConfig.windowMs - (now - this.rateLimitState.windowStart);
      await new Promise(resolve => setTimeout(resolve, Math.max(waitMs, 1000)));
      this.rateLimitState = { requests: 0, windowStart: Date.now(), retryAfter: 0 };
    }
    this.rateLimitState.requests++;
  }

  protected handleRateLimitHeaders(headers: Record<string, string>): void {
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    if (remaining !== undefined && parseInt(remaining, 10) <= 0 && reset) {
      const resetTime = parseInt(reset, 10) * 1000;
      this.rateLimitState.retryAfter = resetTime;
    }
    const retryAfter = headers['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        this.rateLimitState.retryAfter = Date.now() + seconds * 1000;
      }
    }
  }

  // -- OAuth2 Flows --------------------------------------------------------

  protected getOAuth2AuthUrl(state?: string): string {
    const config = this.authConfig as OAuth2Config;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri || '',
      scope: config.scopes.join(' '),
      state: state || crypto.randomBytes(16).toString('hex'),
    });
    return `${config.authorizationUrl}?${params.toString()}`;
  }

  protected getOAuth2PKCEAuthUrl(): { url: string; codeVerifier: string } {
    const config = this.authConfig as OAuth2PKCEConfig;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri || '',
      scope: config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: crypto.randomBytes(16).toString('hex'),
    });
    return { url: `${config.authorizationUrl}?${params.toString()}`, codeVerifier };
  }

  protected async exchangeOAuth2Code(code: string): Promise<TokenData> {
    const config = this.authConfig as OAuth2Config;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri || '',
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    });
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw createIntegrationError('Token exchange failed', response.status, await response.text());
    }
    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  protected async exchangePKCECode(code: string, codeVerifier: string): Promise<TokenData> {
    const config = this.authConfig as OAuth2PKCEConfig;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri || '',
      client_id: config.clientId,
      code_verifier: codeVerifier,
    });
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw createIntegrationError('PKCE token exchange failed', response.status, await response.text());
    }
    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  protected async getClientCredentialsToken(): Promise<TokenData> {
    const config = this.authConfig as ClientCredentialsConfig;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...(config.scopes ? { scope: config.scopes.join(' ') } : {}),
    });
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw createIntegrationError('Client credentials token failed', response.status, await response.text());
    }
    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  protected async refreshAccessToken(): Promise<TokenData> {
    if (!this.tokenData?.refreshToken) {
      throw createIntegrationError('No refresh token available');
    }
    const config = this.authConfig as OAuth2Config;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokenData.refreshToken,
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    });
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw createIntegrationError('Token refresh failed', response.status, await response.text());
    }
    const data = await response.json() as Record<string, unknown>;
    this.tokenData = this.parseTokenResponse(data);
    return this.tokenData;
  }

  protected isTokenExpired(): boolean {
    if (!this.tokenData) return true;
    return Date.now() >= this.tokenData.expiresAt - 300000;
  }

  protected parseTokenResponse(data: Record<string, unknown>): TokenData {
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt: Date.now() + expiresIn * 1000,
      tokenType: (data.token_type as string) || 'Bearer',
      scope: data.scope as string | undefined,
    };
  }

  // -- Core Request Method -------------------------------------------------

  protected async request<T>(config: RequestConfig): Promise<T> {
    await this.checkRateLimit();

    const authHeaders = await this.getAuthHeaders();
    let reqConfig: RequestConfig = {
      ...config,
      headers: { ...authHeaders, ...config.headers },
    };

    if (this.interceptors.onRequest) {
      reqConfig = await this.interceptors.onRequest(reqConfig);
    }

    let lastError: IntegrationError | null = null;
    const maxAttempts = this.retryConfig.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { method, url, headers, params, body, timeout = 30000 } = reqConfig;
        let fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        if (params) {
          const qs = new URLSearchParams();
          for (const [key, value] of Object.entries(params)) {
            qs.set(key, String(value));
          }
          fullUrl += `?${qs.toString()}`;
        }

        const fetchOptions: RequestInit = {
          method,
          headers: { ...headers, 'Content-Type': headers?.['Content-Type'] || 'application/json' },
          signal: AbortSignal.timeout(timeout),
        };

        if (body && method !== HttpMethod.GET) {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(fullUrl, fetchOptions);
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });

        this.handleRateLimitHeaders(responseHeaders);

        let responseData: unknown;
        const contentType = responseHeaders['content-type'] || '';
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType.includes('text/')) {
          responseData = await response.text();
        } else {
          responseData = await response.arrayBuffer();
        }

        if (!response.ok) {
          const error = createIntegrationError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status,
            responseData,
            responseHeaders['x-request-id'],
          );
          if (error.retryable && attempt < maxAttempts) {
            lastError = error;
            const delay = Math.min(
              this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
              this.retryConfig.maxDelayMs,
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          if (this.interceptors.onError) {
            throw await this.interceptors.onError(error);
          }
          throw error;
        }

        let result: ResponseData<T> = {
          data: responseData as T,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        };

        if (this.interceptors.onResponse) {
          result = await this.interceptors.onResponse(result);
        }

        return result.data;
      } catch (error) {
        if (error instanceof Error && 'category' in error) {
          lastError = error as IntegrationError;
          if (lastError.retryable && attempt < maxAttempts) {
            const delay = Math.min(
              this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
              this.retryConfig.maxDelayMs,
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw lastError;
        }
        throw createIntegrationError(
          error instanceof Error ? error.message : 'Unknown error',
          undefined,
          error,
        );
      }
    }

    throw lastError || createIntegrationError('Max retries exceeded');
  }

  // -- Convenience methods -------------------------------------------------

  protected get<T>(url: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>({ method: HttpMethod.GET, url, params });
  }

  protected post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: HttpMethod.POST, url, body, headers });
  }

  protected put<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: HttpMethod.PUT, url, body, headers });
  }

  protected patch<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: HttpMethod.PATCH, url, body, headers });
  }

  protected delete<T>(url: string): Promise<T> {
    return this.request<T>({ method: HttpMethod.DELETE, url });
  }

  // -- Lifecycle ------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.authType === AuthType.ClientCredentials) {
      this.tokenData = await this.getClientCredentialsToken();
    }
  }

  async disconnect(): Promise<void> {
    this.tokenData = null;
    this.rateLimitState = { requests: 0, windowStart: 0, retryAfter: 0 };
  }

  abstract getCapabilities(): string[];
}
