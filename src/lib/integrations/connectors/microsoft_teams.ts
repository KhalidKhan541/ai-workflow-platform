import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamsConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri?: string;
  scopes?: string[];
}

export interface TeamsMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  chatId?: string;
  channelId?: string;
  teamId?: string;
  from: { application?: { id: string; displayName: string }; user?: { id: string; displayName: string; userIdentityType: string } };
  body: { contentType: string; content: string };
  importance: string;
  subject?: string;
  attachments?: TeamsAttachment[];
  mentions?: TeamsMention[];
}

export interface TeamsAttachment {
  id: string;
  contentType: string;
  content?: string;
  contentUrl?: string;
  name?: string;
}

export interface TeamsMention {
  id: number;
  mentionText: string;
  mentioned: { application?: { id: string; displayName: string }; user?: { id: string; displayName: string; userIdentityType: string } };
}

export interface TeamsChannel {
  id: string;
  createdDateTime: string;
  displayName: string;
  description?: string;
  email?: string;
  webUrl: string;
  membershipType: string;
}

export interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
  isArchived: boolean;
  webUrl: string;
  createdDateTime: string;
}

export interface TeamsConversationMember {
  id: string;
  displayName: string;
  email?: string;
  roles: string[];
  userIdentityType: string;
}

export interface TeamsMeeting {
  id: string;
  subject: string;
  body?: { contentType: string; content: string };
  startDateTime: string;
  endDateTime: string;
  joinUrl: string;
  joinWebUrl: string;
  participants?: { organizer?: { user?: { id: string; displayName: string } }; attendees?: { upn?: string; role?: string }[] };
  isCancelled: boolean;
  onlineMeetingProvider: string;
}

export interface TeamsListResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

export interface TeamsAdaptiveCard {
  type: string;
  $schema?: string;
  version?: string;
  body: unknown[];
  actions?: unknown[];
}

// ---------------------------------------------------------------------------
// Microsoft Teams Integration
// ---------------------------------------------------------------------------

export class MicrosoftTeamsIntegration extends BaseIntegration {
  private config: TeamsConfig;

  constructor(config: TeamsConfig) {
    super('https://graph.microsoft.com/v1.0', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 60, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.ClientCredentials;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken;
    if (!token) {
      this.tokenData = await this.getClientCredentialsTokenForTeams();
    }
    return { Authorization: `Bearer ${this.tokenData!.accessToken}` };
  }

  private async getClientCredentialsTokenForTeams(): Promise<TokenData> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    });
    if (!response.ok) throw new Error(`Teams auth failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  getCapabilities(): string[] {
    return [
      'messages.send',
      'messages.read',
      'messages.reply',
      'channels.create',
      'channels.read',
      'channels.delete',
      'teams.read',
      'teams.create',
      'members.read',
      'meetings.create',
      'meetings.read',
      'adaptive_cards.send',
      'files.upload',
      'tabs.create',
      'webhooks',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    const scopes = this.config.scopes || [
      'ChannelMessage.Send',
      'ChannelMessage.Read.All',
      'Channel.Create',
      'Channel.ReadBasic.All',
      'Team.ReadBasic.All',
      'Team.Create',
      'Group.ReadWrite.All',
      'OnlineMeetings.ReadWrite',
      'Calendars.ReadWrite',
    ];
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: scopes.join(' '),
      redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
      response_type: 'code',
      state: state || '',
    });
    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const response = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
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
    if (!response.ok) throw new Error(`Teams token exchange failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    this.tokenData = this.parseTokenResponse(data);
    return this.tokenData;
  }

  // -- Messages ------------------------------------------------------------

  async sendMessage(teamId: string, channelId: string, message: {
    body: string;
    contentType?: string;
    attachments?: TeamsAttachment[];
    mentions?: TeamsMention[];
  }): Promise<TeamsMessage> {
    return this.post(`/teams/${teamId}/channels/${channelId}/messages`, {
      body: {
        contentType: message.contentType || 'html',
        content: message.body,
      },
      attachments: message.attachments,
      mentions: message.mentions,
    });
  }

  async replyToMessage(teamId: string, channelId: string, messageId: string, body: string): Promise<TeamsMessage> {
    return this.post(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, {
      body: { contentType: 'html', content: body },
    });
  }

  async getMessage(teamId: string, channelId: string, messageId: string): Promise<TeamsMessage> {
    return this.get(`/teams/${teamId}/channels/${channelId}/messages/${messageId}`);
  }

  async listMessages(teamId: string, channelId: string, options?: { top?: number; skip?: number }): Promise<TeamsListResponse<TeamsMessage>> {
    return this.get(`/teams/${teamId}/channels/${channelId}/messages`, options || {});
  }

  async deleteMessage(teamId: string, channelId: string, messageId: string): Promise<void> {
    await this.delete(`/teams/${teamId}/channels/${channelId}/messages/${messageId}`);
  }

  async sendCard(teamId: string, channelId: string, card: TeamsAdaptiveCard): Promise<TeamsMessage> {
    return this.post(`/teams/${teamId}/channels/${channelId}/messages`, {
      body: {
        contentType: 'html',
        content: JSON.stringify(card),
      },
    });
  }

  // -- Channels ------------------------------------------------------------

  async listChannels(teamId: string): Promise<TeamsListResponse<TeamsChannel>> {
    return this.get(`/teams/${teamId}/channels`);
  }

  async getChannel(teamId: string, channelId: string): Promise<TeamsChannel> {
    return this.get(`/teams/${teamId}/channels/${channelId}`);
  }

  async createChannel(teamId: string, displayName: string, description?: string): Promise<TeamsChannel> {
    return this.post(`/teams/${teamId}/channels`, {
      displayName,
      description,
      membershipType: 'standard',
    });
  }

  async updateChannel(teamId: string, channelId: string, data: { displayName?: string; description?: string }): Promise<TeamsChannel> {
    return this.patch(`/teams/${teamId}/channels/${channelId}`, data);
  }

  async deleteChannel(teamId: string, channelId: string): Promise<void> {
    await this.delete(`/teams/${teamId}/channels/${channelId}`);
  }

  // -- Teams ----------------------------------------------------------------

  async listTeams(): Promise<TeamsListResponse<TeamsTeam>> {
    return this.get('/me/joinedTeams');
  }

  async getTeam(teamId: string): Promise<TeamsTeam> {
    return this.get(`/teams/${teamId}`);
  }

  async getTeamChannels(teamId: string): Promise<TeamsListResponse<TeamsChannel>> {
    return this.get(`/teams/${teamId}/channels`);
  }

  // -- Members -------------------------------------------------------------

  async listMembers(teamId: string, channelId?: string): Promise<TeamsListResponse<TeamsConversationMember>> {
    if (channelId) {
      return this.get(`/teams/${teamId}/channels/${channelId}/members`);
    }
    return this.get(`/teams/${teamId}/members`);
  }

  async addMember(teamId: string, userId: string, roles: string[] = ['member']): Promise<TeamsConversationMember> {
    return this.post(`/teams/${teamId}/members`, {
      '@odata.type': '#microsoft.graph.aadUserConversationMember',
      roles,
      'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${userId}`,
    });
  }

  async removeMember(teamId: string, memberId: string): Promise<void> {
    await this.delete(`/teams/${teamId}/members/${memberId}`);
  }

  // -- Meetings ------------------------------------------------------------

  async createMeeting(data: {
    subject: string;
    body?: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: { upn: string; role?: string }[];
    allowMeetingChat?: boolean;
    allowTranscription?: boolean;
    recordAutomatically?: boolean;
  }): Promise<TeamsMeeting> {
    return this.post('/me/onlineMeetings', {
      subject: data.subject,
      body: data.body ? { contentType: 'text', content: data.body } : undefined,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
      participants: {
        attendees: data.attendees?.map(a => ({
          upn: a.upn,
          role: a.role || 'attendee',
        })),
      },
      allowMeetingChat: data.allowMeetingChat,
      allowTranscription: data.allowTranscription,
      recordAutomatically: data.recordAutomatically,
    });
  }

  async getMeeting(meetingId: string): Promise<TeamsMeeting> {
    return this.get(`/me/onlineMeetings/${meetingId}`);
  }

  async listMeetings(options?: { top?: number }): Promise<TeamsListResponse<TeamsMeeting>> {
    return this.get('/me/onlineMeetings', options || {});
  }

  async updateMeeting(meetingId: string, data: { subject?: string; startDateTime?: string; endDateTime?: string }): Promise<TeamsMeeting> {
    return this.patch(`/me/onlineMeetings/${meetingId}`, data);
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    await this.delete(`/me/onlineMeetings/${meetingId}`);
  }

  async getMeetingRecording(meetingId: string): Promise<{ id: string; createdDateTime: string; video: { mediaType: string }; detail: { statusCode: number } }> {
    return this.get(`/me/onlineMeetings/${meetingId}/recording`);
  }

  // -- Files ----------------------------------------------------------------

  async uploadFile(teamId: string, channelId: string, fileName: string, content: Buffer): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('file', new Blob([content]), fileName);
    const headers = await this.getAuthHeaders();
    delete headers['Content-Type'];
    const response = await fetch(`${this.baseUrl}/teams/${teamId}/channels/${channelId}/files/root:/children`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error(`File upload failed: ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  async listFiles(teamId: string, channelId: string): Promise<TeamsListResponse<Record<string, unknown>>> {
    return this.get(`/teams/${teamId}/channels/${channelId}/files/root/children`);
  }

  // -- Tabs ----------------------------------------------------------------

  async createTab(teamId: string, channelId: string, data: {
    displayName: string;
    teamsAppId: string;
    contentUrl?: string;
    entityId?: string;
  }): Promise<Record<string, unknown>> {
    return this.post(`/teams/${teamId}/channels/${channelId}/tabs`, {
      displayName: data.displayName,
      teamsAppId: data.teamsAppId,
      configuration: {
        contentUrl: data.contentUrl,
        entityId: data.entityId,
      },
    });
  }

  async listTabs(teamId: string, channelId: string): Promise<TeamsListResponse<Record<string, unknown>>> {
    return this.get(`/teams/${teamId}/channels/${channelId}/tabs`);
  }

  async deleteTab(teamId: string, channelId: string, tabId: string): Promise<void> {
    await this.delete(`/teams/${teamId}/channels/${channelId}/tabs/${tabId}`);
  }

  // -- Proactive Messages --------------------------------------------------

  async sendProactiveMessage(chatId: string, body: string, contentType: string = 'html'): Promise<TeamsMessage> {
    return this.post(`/chats/${chatId}/messages`, {
      body: { contentType, content: body },
    });
  }

  async sendToAllTeamMembers(teamId: string, body: string): Promise<void> {
    const members = await this.listMembers(teamId);
    for (const member of members.value) {
      const chat = await this.post<{ id: string }>('/users/' + (member as any).userId + '/chats', {
        chatType: 'oneOnOne',
        members: [
          { '@odata.type': '#microsoft.graph.aadUserConversationMember', roles: ['owner'], 'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${(member as any).userId}` },
        ],
      });
      await this.sendProactiveMessage(chat.id, body);
    }
  }

  // -- Helpers -------------------------------------------------------------

  static adaptiveCard(title: string, body: unknown[], actions?: unknown[]): TeamsAdaptiveCard {
    return {
      type: 'message',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.4',
      body,
      actions,
    };
  }

  static cardTextBlock(text: string, style?: string, weight?: string, size?: string): Record<string, unknown> {
    return { type: 'TextBlock', text, style, weight, size, wrap: true };
  }

  static cardAction(actionType: string, title: string, url?: string, data?: Record<string, unknown>): Record<string, unknown> {
    return { type: actionType, title, url, data };
  }
}
