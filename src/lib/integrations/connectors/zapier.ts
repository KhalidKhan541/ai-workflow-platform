import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZapierConfig {
  apiKey?: string;
  webhookUrl?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export interface ZapierWebhookPayload {
  [key: string]: unknown;
}

export interface ZapierTaskData {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface ZapierWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
  trigger_url?: string;
  tasks: ZapierTask[];
}

export interface ZapierTask {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

export interface ZapierTriggerResponse {
  id?: string;
  [key: string]: unknown;
}

export interface ZapierActionResult {
  success: boolean;
  id?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface ZapierSearchResult {
  results: Record<string, unknown>[];
  has_more?: boolean;
}

export interface ZapierOAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export interface ZapierAuthState {
  state: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Zapier Integration
// ---------------------------------------------------------------------------

export class ZapierIntegration extends BaseIntegration {
  private config: ZapierConfig;

  constructor(config: ZapierConfig) {
    super(config.webhookUrl || 'https://hooks.zapier.com', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 30, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.apiKey ? AT.ApiKey : AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.tokenData?.accessToken || this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.tokenData?.accessToken || this.config.accessToken}`;
    }
    return headers;
  }

  getCapabilities(): string[] {
    return [
      'webhooks.send',
      'webhooks.receive',
      'tasks.execute',
      'workflows.list',
      'workflows.create',
      'workflows.update',
      'auth.oauth',
      'auth.api_key',
      'search.records',
      'create.records',
      'update.records',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    if (!this.config.clientId) throw new Error('Client ID required for OAuth');
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: 'http://localhost:3000/callback/zapier',
      state: state || '',
      response_type: 'code',
    });
    return `https://zapier.com/partner/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<ZapierOAuthTokens> {
    const response = await fetch('https://zapier.com/api/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
        redirect_uri: 'http://localhost:3000/callback/zapier',
      }).toString(),
    });
    if (!response.ok) throw new Error(`Zapier OAuth failed: ${response.status}`);
    const data = await response.json() as ZapierOAuthTokens;
    this.tokenData = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
    return data;
  }

  // -- Webhook Operations --------------------------------------------------

  async sendToWebhook(url: string, data: ZapierWebhookPayload): Promise<{ status: string; data: ZapierWebhookPayload }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Webhook send failed: ${response.status}`);
    const result = await response.json() as ZapierWebhookPayload;
    return { status: 'success', data: result };
  }

  async sendToZapierHook(data: ZapierWebhookPayload): Promise<{ status: string }> {
    if (!this.config.webhookUrl) throw new Error('Webhook URL required');
    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Zapier hook failed: ${response.status}`);
    return { status: 'success' };
  }

  // -- Zapier Platform API -------------------------------------------------

  async listZaps(options?: { limit?: number; status?: string }): Promise<{ zaps: ZapierWorkflow[] }> {
    return this.get('/api/v1/zaps', options || {});
  }

  async getZap(zapId: string): Promise<ZapierWorkflow> {
    return this.get(`/api/v1/zaps/${zapId}`);
  }

  async enableZap(zapId: string): Promise<{ success: boolean }> {
    return this.post(`/api/v1/zaps/${zapId}/enable`);
  }

  async disableZap(zapId: string): Promise<{ success: boolean }> {
    return this.post(`/api/v1/zaps/${zapId}/disable`);
  }

  async runZap(zapId: string, data?: ZapierWebhookPayload): Promise<ZapierTriggerResponse> {
    return this.post(`/api/v1/zaps/${zapId}/run`, data || {});
  }

  // -- Task Operations (Custom Actions) ------------------------------------

  async executeTask(taskType: string, data: ZapierTaskData): Promise<ZapierActionResult> {
    return this.post(`/api/v1/tasks/${taskType}`, data);
  }

  async searchRecords(endpoint: string, query?: Record<string, unknown>): Promise<ZapierSearchResult> {
    return this.post(`/api/v1/search/${endpoint}`, query || {});
  }

  async createRecord(endpoint: string, data: Record<string, unknown>): Promise<ZapierActionResult> {
    return this.post(`/api/v1/create/${endpoint}`, data);
  }

  async updateRecord(endpoint: string, id: string, data: Record<string, unknown>): Promise<ZapierActionResult> {
    return this.put(`/api/v1/update/${endpoint}/${id}`, data);
  }

  // -- Authentication Status -----------------------------------------------

  async getAuthStatus(): Promise<{ connected: boolean; auth_type: string; scopes?: string }> {
    return this.get('/api/v1/auth/status');
  }

  async refreshAuthToken(): Promise<ZapierOAuthTokens> {
    if (!this.tokenData?.refreshToken) throw new Error('No refresh token available');
    const response = await fetch('https://zapier.com/api/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokenData.refreshToken,
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
      }).toString(),
    });
    if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);
    const data = await response.json() as ZapierOAuthTokens;
    this.tokenData.accessToken = data.access_token;
    this.tokenData.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    if (data.refresh_token) this.tokenData.refreshToken = data.refresh_token;
    return data;
  }

  // -- Datastore Operations ------------------------------------------------

  async datastoreList(storeId: string, query?: Record<string, unknown>): Promise<{ records: Record<string, unknown>[] }> {
    return this.post(`/api/v1/datastores/${storeId}/list`, query || {});
  }

  async datastoreGet(storeId: string, key: string): Promise<{ value: unknown }> {
    return this.get(`/api/v1/datastores/${storeId}/get?key=${encodeURIComponent(key)}`);
  }

  async datastoreSet(storeId: string, key: string, value: unknown): Promise<{ success: boolean }> {
    return this.post(`/api/v1/datastores/${storeId}/set`, { key, value });
  }

  async datastoreDelete(storeId: string, key: string): Promise<{ success: boolean }> {
    return this.post(`/api/v1/datastores/${storeId}/delete`, { key });
  }

  // -- Zapier CLI Commands (for development) -------------------------------

  async getZapMetadata(zapId: string): Promise<Record<string, unknown>> {
    return this.get(`/api/v1/zaps/${zapId}/metadata`);
  }

  async getTaskHistory(zapId: string, options?: { limit?: number; status?: string }): Promise<{ tasks: ZapierTask[] }> {
    return this.get(`/api/v1/zaps/${zapId}/history`, options || {});
  }

  // -- Helpers -------------------------------------------------------------

  static buildWebhookUrl(hookId: string): string {
    return `https://hooks.zapier.com/hooks/catch/${hookId}/`;
  }

  static formatPayload(data: Record<string, unknown>, fieldMapping?: Record<string, string>): Record<string, unknown> {
    if (!fieldMapping) return data;
    const formatted: Record<string, unknown> = {};
    for (const [source, target] of Object.entries(fieldMapping)) {
      if (data[source] !== undefined) {
        formatted[target] = data[source];
      }
    }
    return formatted;
  }

  static createSearchPayload(filters: Record<string, unknown>): Record<string, unknown> {
    return {
      filters: Object.entries(filters).map(([field, value]) => ({
        field,
        operator: typeof value === 'string' ? 'contains' : 'equals',
        value,
      })),
    };
  }

  static createActionPayload(action: string, data: Record<string, unknown>): Record<string, unknown> {
    return {
      action,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
