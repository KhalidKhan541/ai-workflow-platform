import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  refreshToken?: string;
  accessToken?: string;
  scopes?: string[];
}

export interface GmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: GmailAttachment[];
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  labels?: string[];
}

export interface GmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface GmailParsedMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: GmailPayload;
  internalDate: string;
  sizeEstimate: number;
}

export interface GmailPayload {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers: GmailHeader[];
  body?: GmailBody;
  parts?: GmailPayload[];
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailBody {
  size: number;
  data?: string;
  attachmentId?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailListResponse<T = GmailParsedMessage> {
  messages: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

// ---------------------------------------------------------------------------
// Gmail Integration
// ---------------------------------------------------------------------------

export class GmailIntegration extends BaseIntegration {
  private config: GmailConfig;
  private accessToken: string;

  constructor(config: GmailConfig) {
    super('https://gmail.googleapis.com/gmail/v1', config);
    this.config = config;
    this.accessToken = config.accessToken || '';
    this.rateLimitConfig = { maxRequests: 250, windowMs: 100000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.accessToken ? AT.Bearer : AT.OAuth2;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken || this.accessToken;
    return { Authorization: `Bearer ${token}` };
  }

  getCapabilities(): string[] {
    return [
      'emails.send',
      'emails.read',
      'emails.search',
      'emails.list',
      'emails.modify',
      'emails.delete',
      'labels.read',
      'labels.create',
      'labels.update',
      'labels.delete',
      'threads.read',
      'threads.modify',
      'attachments.read',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    const scopes = this.config.scopes || [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/gmail.metadata',
      'https://www.googleapis.com/auth/userinfo.email',
    ];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || '',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!response.ok) {
      throw new Error(`Gmail token exchange failed: ${response.status}`);
    }
    const data = await response.json() as Record<string, unknown>;
    this.tokenData = this.parseTokenResponse(data);
    this.accessToken = this.tokenData.accessToken;
    if (data.refresh_token) {
      this.tokenData.refreshToken = data.refresh_token as string;
    }
    return this.tokenData;
  }

  // -- Send ----------------------------------------------------------------

  private encodeMessage(message: GmailMessage): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const lines: string[] = [];

    lines.push(`From: me`);
    lines.push(`To: ${message.to.join(', ')}`);
    if (message.cc?.length) lines.push(`Cc: ${message.cc.join(', ')}`);
    if (message.bcc?.length) lines.push(`Bcc: ${message.bcc.join(', ')}`);
    lines.push(`Subject: ${message.subject}`);
    if (message.inReplyTo) lines.push(`In-Reply-To: ${message.inReplyTo}`);
    if (message.references?.length) lines.push(`References: ${message.references.join(' ')}`);
    if (message.labels?.length) lines.push(`X-Gmail-Labels: ${message.labels.join(',')}`);

    if (message.attachments?.length) {
      lines.push('MIME-Version: 1.0');
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
    }

    if (message.isHtml) {
      lines.push('Content-Type: text/html; charset="UTF-8"');
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"');
    }
    lines.push('Content-Transfer-Encoding: quoted-printable');
    lines.push('');
    lines.push(message.body);

    if (message.attachments?.length) {
      for (const attachment of message.attachments) {
        lines.push('');
        lines.push(`--${boundary}`);
        const contentType = attachment.contentType || 'application/octet-stream';
        lines.push(`Content-Type: ${contentType}; name="${attachment.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        lines.push('');
        const content = typeof attachment.content === 'string'
          ? attachment.content
          : attachment.content.toString('base64');
        // Wrap base64 at 76 chars
        lines.push(content.replace(/(.{76})/g, '$1\n'));
      }
      lines.push('');
      lines.push(`--${boundary}--`);
    }

    const raw = lines.join('\r\n');
    return Buffer.from(raw).toString('base64url');
  }

  async sendEmail(message: GmailMessage): Promise<{ id: string; threadId: string; labelIds: string[] }> {
    const raw = this.encodeMessage(message);
    const body: Record<string, unknown> = { raw };
    if (message.threadId) body.threadId = message.threadId;
    if (message.labels) body.labelIds = message.labels;

    const response = await this.post<{ id: string; threadId: string; labelIds: string[] }>(
      '/users/me/messages/send',
      body,
    );
    return response;
  }

  // -- Read ----------------------------------------------------------------

  async getMessage(id: string, format: string = 'full'): Promise<GmailParsedMessage> {
    return this.get(`/users/me/messages/${id}`, { format });
  }

  async listMessages(
    options: {
      query?: string;
      labelIds?: string[];
      maxResults?: number;
      pageToken?: string;
      includeSpamTrash?: boolean;
      userId?: string;
    } = {},
  ): Promise<GmailListResponse> {
    const params: Record<string, string | number | boolean> = {
      maxResults: options.maxResults || 100,
    };
    if (options.query) params.q = options.query;
    if (options.labelIds?.length) params.labelIds = options.labelIds.join(',');
    if (options.pageToken) params.pageToken = options.pageToken;
    if (options.includeSpamTrash) params.includeSpamTrash = true;
    return this.get(`/users/${options.userId || 'me'}/messages`, params);
  }

  async listAllMessages(query?: string, labelIds?: string[]): Promise<GmailParsedMessage[]> {
    const allMessages: GmailParsedMessage[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.listMessages({ query, labelIds, pageToken, maxResults: 100 });
      for (const msg of response.messages || []) {
        allMessages.push(await this.getMessage(msg.id));
      }
      pageToken = response.nextPageToken;
    } while (pageToken);
    return allMessages;
  }

  async searchMessages(query: string, maxResults: number = 100): Promise<GmailListResponse> {
    return this.listMessages({ query, maxResults });
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<{ data: string; size: number }> {
    return this.get(`/users/me/messages/${messageId}/attachments/${attachmentId}`);
  }

  // -- Modify --------------------------------------------------------------

  async modifyMessage(id: string, addLabelIds: string[], removeLabelIds: string[]): Promise<GmailParsedMessage> {
    return this.post(`/users/me/messages/${id}/modify`, { addLabelIds, removeLabelIds });
  }

  async trashMessage(id: string): Promise<GmailParsedMessage> {
    return this.post(`/users/me/messages/${id}/trash`);
  }

  async untrashMessage(id: string): Promise<GmailParsedMessage> {
    return this.post(`/users/me/messages/${id}/untrash`);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.delete(`/users/me/messages/${id}`);
  }

  async batchModify(ids: string[], addLabelIds: string[], removeLabelIds: string[]): Promise<void> {
    await this.post('/users/me/messages/batchModify', { ids, addLabelIds, removeLabelIds });
  }

  async batchDelete(ids: string[]): Promise<void> {
    await this.post('/users/me/messages/batchDelete', { ids });
  }

  // -- Labels --------------------------------------------------------------

  async listLabels(): Promise<{ labels: GmailLabel[] }> {
    return this.get('/users/me/labels');
  }

  async getLabel(id: string): Promise<GmailLabel> {
    return this.get(`/users/me/labels/${id}`);
  }

  async createLabel(name: string, options?: { listVisibility?: string; labelListVisibility?: string }): Promise<GmailLabel> {
    return this.post('/users/me/labels', {
      name,
      listVisibility: options?.listVisibility || 'labelShow',
      labelListVisibility: options?.labelListVisibility || 'labelShow',
    });
  }

  async updateLabel(id: string, name: string): Promise<GmailLabel> {
    return this.put(`/users/me/labels/${id}`, { name });
  }

  async deleteLabel(id: string): Promise<void> {
    await this.delete(`/users/me/labels/${id}`);
  }

  async updateMessageLabels(messageId: string, labelIds: string[]): Promise<GmailParsedMessage> {
    return this.modifyMessage(messageId, labelIds, []);
  }

  // -- Threads -------------------------------------------------------------

  async getThread(id: string): Promise<{ id: string; messages: GmailParsedMessage[]; historyId: string }> {
    return this.get(`/users/me/threads/${id}`);
  }

  async listThreads(query?: string, maxResults: number = 100): Promise<{ threads: { id: string }[]; nextPageToken?: string; resultSizeEstimate: number }> {
    const params: Record<string, string | number> = { maxResults };
    if (query) params.q = query;
    return this.get('/users/me/threads', params);
  }

  async modifyThread(id: string, addLabelIds: string[], removeLabelIds: string[]): Promise<void> {
    await this.post(`/users/me/threads/${id}/modify`, { addLabelIds, removeLabelIds });
  }

  // -- Watch ---------------------------------------------------------------

  async watch(query?: string, labelIds?: string[]): Promise<{ historyId: string; expiration: string }> {
    const body: Record<string, unknown> = {
      topicName: 'projects/my-project/topics/gmail',
    };
    if (query) body.labelFilterQuery = query;
    if (labelIds?.length) body.labelIds = labelIds;
    return this.post('/users/me/watch', body);
  }

  // -- Profile -------------------------------------------------------------

  async getProfile(): Promise<{ emailAddress: string; historyId: string; messagesTotal: number; threadsTotal: number }> {
    return this.get('/users/me/profile');
  }

  // -- Helpers -------------------------------------------------------------

  extractBody(payload: GmailPayload): { text: string; html: string } {
    let text = '';
    let html = '';
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
      if (payload.mimeType === 'text/plain') text += decoded;
      if (payload.mimeType === 'text/html') html += decoded;
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const inner = this.extractBody(part);
        text += inner.text;
        html += inner.html;
      }
    }
    return { text, html };
  }

  extractHeaders(payload: GmailPayload): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const h of payload.headers || []) {
      headers[h.name.toLowerCase()] = h.value;
    }
    return headers;
  }
}
