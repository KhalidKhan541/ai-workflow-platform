import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackConfig {
  clientId: string;
  clientSecret: string;
  signingSecret?: string;
  botToken?: string;
  userToken?: string;
  scopes?: string[];
}

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: unknown[];
  attachments?: unknown[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  as_user?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  created: number;
  creator: string;
  num_members?: number;
  topic?: { value: string; creator: string; last_set: number };
  purpose?: { value: string; creator: string; last_set: number };
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  real_name: string;
  tz?: string;
  tz_label?: string;
  profile?: {
    avatar_hash?: string;
    status_text?: string;
    status_emoji?: string;
    real_name?: string;
    display_name?: string;
    email?: string;
    image_original?: string;
  };
}

export interface SlackFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  url_private: string;
  url_private_download: string;
  permalink: string;
  created: number;
  size: number;
}

export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    [key: string]: unknown;
  };
  type: string;
  event_id: string;
  event_time: number;
}

export interface SlackApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  warnings?: string[];
  response_metadata?: { next_cursor?: string };
  data?: T;
}

// ---------------------------------------------------------------------------
// Slack Integration
// ---------------------------------------------------------------------------

export class SlackIntegration extends BaseIntegration {
  private config: SlackConfig;
  private accessToken: string;

  constructor(config: SlackConfig) {
    super('https://slack.com/api', config);
    this.config = config;
    this.accessToken = config.botToken || '';
    this.rateLimitConfig = { maxRequests: 50, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.botToken ? AT.Bearer : AT.OAuth2;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken || this.accessToken;
    return { Authorization: `Bearer ${token}` };
  }

  getCapabilities(): string[] {
    return [
      'messages.send',
      'messages.read',
      'channels.create',
      'channels.read',
      'files.upload',
      'users.read',
      'reactions.add',
      'reactions.remove',
      'pins.add',
      'pins.remove',
      'conversations.list',
      'search.messages',
      'events.subscribe',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    const scopes = this.config.scopes || [
      'chat:write',
      'channels:read',
      'channels:manage',
      'files:write',
      'users:read',
      'reactions:read',
      'reactions:write',
    ];
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: scopes.join(' '),
      redirect_uri: '',
      state: state || '',
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });
    const data = await response.json() as SlackApiResponse & {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      team?: { id: string; name: string };
    };
    if (!data.ok) throw new Error(`Slack OAuth failed: ${data.error}`);
    this.tokenData = {
      accessToken: data.access_token || '',
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      tokenType: data.token_type || 'Bearer',
    };
    this.accessToken = this.tokenData.accessToken;
    return this.tokenData;
  }

  // -- Messages ------------------------------------------------------------

  async sendMessage(message: SlackMessage): Promise<SlackApiResponse> {
    return this.post<SlackApiResponse>('/chat.postMessage', message);
  }

  async sendToChannel(channel: string, text: string, options?: Partial<SlackMessage>): Promise<SlackApiResponse> {
    return this.sendMessage({ channel, text, ...options });
  }

  async sendToThread(channel: string, text: string, threadTs: string): Promise<SlackApiResponse> {
    return this.sendMessage({ channel, text, thread_ts: threadTs });
  }

  async sendDM(userId: string, text: string): Promise<SlackApiResponse> {
    const conv = await this.post<SlackApiResponse & { channel?: { id: string } }>(
      '/conversations.open',
      { users: userId },
    );
    if (!conv.ok || !conv.channel) throw new Error(`Failed to open DM: ${conv.error}`);
    return this.sendMessage({ channel: conv.channel.id, text });
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<SlackApiResponse> {
    return this.post<SlackApiResponse>('/chat.update', { channel, ts, text });
  }

  async deleteMessage(channel: string, ts: string): Promise<SlackApiResponse> {
    return this.post<SlackApiResponse>('/chat.delete', { channel, ts });
  }

  async scheduleMessage(channel: string, text: string, postAt: number): Promise<SlackApiResponse> {
    return this.post<SlackApiResponse>('/chat.scheduleMessage', { channel, text, post_at: postAt });
  }

  async getThreadReplies(channel: string, threadTs: string): Promise<SlackApiResponse> {
    return this.get<SlackApiResponse>('/conversations.replies', {
      channel,
      ts: threadTs,
    });
  }

  // -- Channels ------------------------------------------------------------

  async listChannels(types: string = 'public_channel,private_channel'): Promise<SlackApiResponse & { channels?: SlackChannel[] }> {
    return this.get('/conversations.list', { types, limit: 200 });
  }

  async createChannel(name: string, isPrivate: boolean = false): Promise<SlackApiResponse & { channel?: SlackChannel }> {
    return this.post('/conversations.create', { name, is_private: isPrivate });
  }

  async getChannelInfo(channel: string): Promise<SlackApiResponse & { channel?: SlackChannel }> {
    return this.get('/conversations.info', { channel });
  }

  async joinChannel(channel: string): Promise<SlackApiResponse> {
    return this.post('/conversations.join', { channel });
  }

  async leaveChannel(channel: string): Promise<SlackApiResponse> {
    return this.post('/conversations.leave', { channel });
  }

  async archiveChannel(channel: string): Promise<SlackApiResponse> {
    return this.post('/conversations.archive', { channel });
  }

  async inviteToChannel(channel: string, users: string[]): Promise<SlackApiResponse> {
    return this.post('/conversations.invite', { channel, users: users.join(',') });
  }

  // -- Files ---------------------------------------------------------------

  async uploadFile(
    channels: string[],
    file: Buffer,
    filename: string,
    options?: { title?: string; initial_comment?: string; thread_ts?: string },
  ): Promise<SlackApiResponse & { file?: SlackFile }> {
    const formData = new FormData();
    formData.append('channels', channels.join(','));
    formData.append('filename', filename);
    if (options?.title) formData.append('title', options.title);
    if (options?.initial_comment) formData.append('initial_comment', options.initial_comment);
    if (options?.thread_ts) formData.append('thread_ts', options.thread_ts);
    formData.append('file', new Blob([file]), filename);

    const token = this.tokenData?.accessToken || this.accessToken;
    const response = await fetch('https://slack.com/api/files.upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return response.json() as Promise<SlackApiResponse & { file?: SlackFile }>;
  }

  async listFiles(user?: string, channel?: string, tsFrom?: number, tsTo?: number): Promise<SlackApiResponse> {
    const params: Record<string, string | number> = {};
    if (user) params.user = user;
    if (channel) params.channel = channel;
    if (tsFrom) params.ts_from = tsFrom;
    if (tsTo) params.ts_to = tsTo;
    return this.get('/files.list', params);
  }

  async deleteFile(file: string): Promise<SlackApiResponse> {
    return this.post('/files.delete', { file });
  }

  // -- Users ---------------------------------------------------------------

  async listUsers(cursor?: string): Promise<SlackApiResponse & { members?: SlackUser[]; response_metadata?: { next_cursor?: string } }> {
    return this.get('/users.list', { limit: 200, ...(cursor ? { cursor } : {}) });
  }

  async getUserInfo(user: string): Promise<SlackApiResponse & { user?: SlackUser }> {
    return this.get('/users.info', { user });
  }

  async lookupByEmail(email: string): Promise<SlackApiResponse & { user?: SlackUser }> {
    return this.get('/users.lookupByEmail', { email });
  }

  // -- Reactions -----------------------------------------------------------

  async addReaction(name: string, channel: string, timestamp: string): Promise<SlackApiResponse> {
    return this.post('/reactions.add', { name, channel, timestamp });
  }

  async removeReaction(name: string, channel: string, timestamp: string): Promise<SlackApiResponse> {
    return this.post('/reactions.remove', { name, channel, timestamp });
  }

  // -- Search --------------------------------------------------------------

  async searchMessages(query: string, options?: { sort?: string; sort_dir?: string; count?: number }): Promise<SlackApiResponse> {
    return this.get('/search.messages', { query, ...options });
  }

  // -- Event Verification --------------------------------------------------

  verifyEventSignature(timestamp: string, body: string, signature: string): boolean {
    if (!this.config.signingSecret) return false;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.config.signingSecret);
    const baseString = `v0:${timestamp}:${body}`;
    const computed = `v0=${hmac.update(baseString).digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }

  // -- Conversations History ------------------------------------------------

  async getConversationHistory(channel: string, limit: number = 100, cursor?: string): Promise<SlackApiResponse> {
    return this.get('/conversations.history', { channel, limit, ...(cursor ? { cursor } : {}) });
  }

  async getConversationReplies(channel: string, ts: string, limit: number = 100): Promise<SlackApiResponse> {
    return this.get('/conversations.replies', { channel, ts, limit });
  }

  // -- Bookmarks & Pins ----------------------------------------------------

  async pinMessage(channel: string, timestamp: string): Promise<SlackApiResponse> {
    return this.post('/pins.add', { channel, timestamp });
  }

  async unpinMessage(channel: string, timestamp: string): Promise<SlackApiResponse> {
    return this.post('/pins.remove', { channel, timestamp });
  }

  async getPins(channel: string): Promise<SlackApiResponse> {
    return this.get('/pins.list', { channel });
  }

  // -- Reminders -----------------------------------------------------------

  async addReminder(text: string, channel: string, time: string): Promise<SlackApiResponse> {
    return this.post('/reminders.add', { text, channel, time });
  }

  async listReminders(): Promise<SlackApiResponse> {
    return this.get('/reminders.list');
  }
}
