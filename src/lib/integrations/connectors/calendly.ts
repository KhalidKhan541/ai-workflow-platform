import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendlyConfig {
  accessToken: string;
  webhookSigningKey?: string;
}

export interface CalendlyUser {
  resource: {
    uri: string;
    name: string;
    slug: string;
    email: string;
    scheduling_url: string;
    timezone: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
  };
}

export interface CalendlyEventType {
  resource: {
    uri: string;
    name: string;
    active: boolean;
    scheduling_url: string;
    booking_url: string;
    slug: string;
    description_html?: string;
    description_plain?: string;
    duration: number;
    kind: string;
    pool?: { kind: string; uri: string };
    status: string;
    created_at: string;
    updated_at: string;
    profile?: { type: string; name: string };
    secret?: boolean;
    tags?: string[];
    custom_questions?: CalendlyCustomQuestion[];
  };
}

export interface CalendlyCustomQuestion {
  name: string;
  type: string;
  required: boolean;
  answer_choices?: string[];
  include_other?: boolean;
  enabled?: boolean;
  order?: number;
}

export interface CalendlyScheduledEvent {
  resource: {
    uri: string;
    name: string;
    status: string;
    start_time: string;
    end_time: string;
    event_type: string;
    created_at: string;
    updated_at: string;
    cancellation?: { canceler_type: string; canceler_name: string; reason?: string; created_at: string };
    location?: { type: string; location?: string; join_url?: string; phone?: string };
    invitees_counter: { total: number;
    active: number;
    limit: number;
  };
    event_guests?: { uri: string; email: string; name?: string; time_zone?: string; created_at: string; updated_at: string }[];
    event_memberships?: { user: string; email: string; name: string; time_zone: string; created_at: string; updated_at: string }[];
    calendar_event?: { external_id: string; kind: string; status: string };
    tracking?: { utm_campaign?: string; utm_source?: string; utm_medium?: string; utm_term?: string; utm_content?: string; salesforce_uuid?: string };
    marketing?: { referred_by?: string };
    created_by: string;
    calendar_event?: { external_id: string; kind: string; status: string };
    uri: string;
  };
}

export interface CalendlyInvitee {
  resource: {
    uri: string;
    name: string;
    email: string;
    timezone: string;
    created_at: string;
    updated_at: string;
    tracking?: { utm_campaign?: string; utm_source?: string; utm_medium?: string; utm_term?: string; utm_content?: string };
    text_reminder_number?: string;
    questions_and_answers?: { question: string; answer: string; position: number }[];
    scheduled_event?: { uri: string; name: string; status: string; start_time: string; end_time: string };
    canceler_name?: string;
    cancellation?: { canceler_type: string; canceler_name: string; reason?: string; created_at: string };
    reschedule_url?: string;
    cancellation_url?: string;
    new_invitee?: string;
    old_invitee?: string;
    uri: string;
  };
}

export interface CalendlyOrganization {
  resource: {
    uri: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
  };
}

export interface CalendlyWebhookSubscription {
  resource: {
    uri: string;
    callback_url: string;
    created_at: string;
    updated_at: string;
    retry: boolean;
    scope: string;
    signing_key: string;
    organization: string;
    user?: string;
    state?: string;
  };
}

export interface CalendlyListResponse<T> {
  collection: T[];
  pagination: {
    count: number;
    next_page?: string;
    previous_page?: string;
    next_page_token?: string;
    previous_page_token?: string;
  };
}

export interface CalendlyWebhookPayload {
  event: string;
  payload: {
    event: string;
    created_at: string;
    updated_at: string;
    data: CalendlyScheduledEvent['resource'] | CalendlyInvitee['resource'];
  };
}

// ---------------------------------------------------------------------------
// Calendly Integration
// ---------------------------------------------------------------------------

export class CalendlyIntegration extends BaseIntegration {
  private config: CalendlyConfig;

  constructor(config: CalendlyConfig) {
    super('https://api.calendly.com', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  getCapabilities(): string[] {
    return [
      'users.read',
      'event_types.read',
      'scheduled_events.read',
      'scheduled_events.cancel',
      'invitees.read',
      'invitees.create',
      'organizations.read',
      'webhooks.create',
      'webhooks.read',
      'webhooks.delete',
      'scheduling_links.create',
      'availability.read',
      'routing_forms.read',
    ];
  }

  // -- Users ---------------------------------------------------------------

  async getCurrentUser(): Promise<CalendlyUser> {
    return this.get('/users/me');
  }

  async getUser(userUri: string): Promise<CalendlyUser> {
    const encodedUri = encodeURIComponent(userUri);
    return this.get(`/users/${encodedUri}`);
  }

  // -- Event Types ---------------------------------------------------------

  async listEventTypes(options?: { user?: string; active?: boolean; count?: number; page_token?: string }): Promise<CalendlyListResponse<CalendlyEventType>> {
    const params: Record<string, string> = {};
    if (options?.user) params.user = options.user;
    if (options?.active !== undefined) params.active = String(options.active);
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    return this.get('/event_types', params);
  }

  async getEventType(eventTypeUri: string): Promise<CalendlyEventType> {
    const encodedUri = encodeURIComponent(eventTypeUri);
    return this.get(`/event_types/${encodedUri}`);
  }

  async listAllEventTypes(user?: string): Promise<CalendlyEventType[]> {
    const allTypes: CalendlyEventType[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.listEventTypes({ user, count: 100, page_token: pageToken });
      allTypes.push(...response.collection);
      pageToken = response.pagination.next_page_token;
    } while (pageToken);
    return allTypes;
  }

  // -- Scheduled Events ----------------------------------------------------

  async listScheduledEvents(options?: {
    user?: string;
    organization?: string;
    status?: string;
    min_start_time?: string;
    max_start_time?: string;
    count?: number;
    page_token?: string;
  }): Promise<CalendlyListResponse<CalendlyScheduledEvent>> {
    const params: Record<string, string> = {};
    if (options?.user) params.user = options.user;
    if (options?.organization) params.organization = options.organization;
    if (options?.status) params.status = options.status;
    if (options?.min_start_time) params.min_start_time = options.min_start_time;
    if (options?.max_start_time) params.max_start_time = options.max_start_time;
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    return this.get('/scheduled_events', params);
  }

  async getScheduledEvent(eventUri: string): Promise<CalendlyScheduledEvent> {
    const encodedUri = encodeURIComponent(eventUri);
    return this.get(`/scheduled_events/${encodedUri}`);
  }

  async listAllScheduledEvents(options?: { user?: string; status?: string; min_start_time?: string; max_start_time?: string }): Promise<CalendlyScheduledEvent[]> {
    const allEvents: CalendlyScheduledEvent[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.listScheduledEvents({ ...options, count: 100, page_token: pageToken });
      allEvents.push(...response.collection);
      pageToken = response.pagination.next_page_token;
    } while (pageToken);
    return allEvents;
  }

  async cancelScheduledEvent(eventUri: string, reason?: string): Promise<CalendlyScheduledEvent> {
    const encodedUri = encodeURIComponent(eventUri);
    return this.post(`/scheduled_events/${encodedUri}/cancellation`, { reason });
  }

  // -- Invitees ------------------------------------------------------------

  async listInvitees(eventUri: string, options?: { status?: string; count?: number; page_token?: string }): Promise<CalendlyListResponse<CalendlyInvitee>> {
    const encodedUri = encodeURIComponent(eventUri);
    const params: Record<string, string> = {};
    if (options?.status) params.status = options.status;
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    return this.get(`/scheduled_events/${encodedUri}/invitees`, params);
  }

  async getInvitee(inviteeUri: string): Promise<CalendlyInvitee> {
    const encodedUri = encodeURIComponent(inviteeUri);
    return this.get(`/invitees/${encodedUri}`);
  }

  async listAllInvitees(eventUri: string, status?: string): Promise<CalendlyInvitee[]> {
    const allInvitees: CalendlyInvitee[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.listInvitees(eventUri, { status, count: 100, page_token: pageToken });
      allInvitees.push(...response.collection);
      pageToken = response.pagination.next_page_token;
    } while (pageToken);
    return allInvitees;
  }

  // -- Scheduling Links ----------------------------------------------------

  async createSchedulingLink(options: {
    max_event_count?: number;
    owner: string;
    owner_type: string;
  }): Promise<{ resource: { booking_url: string } }> {
    return this.post('/scheduling_links', {
      max_event_count: options.max_event_count || 1,
      owner: options.owner,
      owner_type: options.owner_type,
    });
  }

  // -- Organizations -------------------------------------------------------

  async getOrganization(orgUri: string): Promise<CalendlyOrganization> {
    const encodedUri = encodeURIComponent(orgUri);
    return this.get(`/organizations/${encodedUri}`);
  }

  async listOrganizationMemberships(options?: { organization?: string; user?: string; count?: number; page_token?: string }): Promise<CalendlyListResponse<Record<string, unknown>>> {
    const params: Record<string, string> = {};
    if (options?.organization) params.organization = options.organization;
    if (options?.user) params.user = options.user;
    if (options?.count) params.count = String(options.count);
    if (options?.page_token) params.page_token = options.page_token;
    return this.get('/organization_memberships', params);
  }

  // -- Webhooks ------------------------------------------------------------

  async createWebhook(callbackUrl: string, events: string[], organizationUri: string, userUri?: string, signingKey?: string): Promise<CalendlyWebhookSubscription> {
    return this.post('/webhook_subscriptions', {
      callback_url: callbackUrl,
      events,
      organization: organizationUri,
      user: userUri,
      signing_key: signingKey,
      scope: userUri ? 'user' : 'organization',
    });
  }

  async listWebhooks(organizationUri: string): Promise<CalendlyListResponse<CalendlyWebhookSubscription>> {
    return this.get('/webhook_subscriptions', { organization: organizationUri });
  }

  async deleteWebhook(webhookUri: string): Promise<void> {
    const encodedUri = encodeURIComponent(webhookUri);
    await this.delete(`/webhook_subscriptions/${encodedUri}`);
  }

  async getWebhook(webhookUri: string): Promise<CalendlyWebhookSubscription> {
    const encodedUri = encodeURIComponent(webhookUri);
    return this.get(`/webhook_subscriptions/${encodedUri}`);
  }

  // -- Webhook Verification ------------------------------------------------

  verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
    if (!this.config.webhookSigningKey) return false;
    const crypto = require('crypto');
    const payload = `${timestamp}${this.config.webhookSigningKey}`;
    const expectedSignature = crypto.createHmac('sha256', payload).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  // -- Availability --------------------------------------------------------

  async getAvailabilitySchedules(userUri: string): Promise<{ resource: { schedules: { uri: string; name: string; type: string }[] } }> {
    const encodedUri = encodeURIComponent(userUri);
    return this.get(`/users/${encodedUri}/availability_schedules`);
  }

  async getAvailabilitySchedule(scheduleUri: string): Promise<{ resource: { name: string; type: string; rules: { type: string; intervals: { from: string; to: string }[]; days: string[] }[] } }> {
    const encodedUri = encodeURIComponent(scheduleUri);
    return this.get(`/availability_schedules/${encodedUri}`);
  }

  // -- Routing Forms -------------------------------------------------------

  async listRoutingForms(userUri: string): Promise<CalendlyListResponse<Record<string, unknown>>> {
    return this.get('/routing_forms', { user: userUri });
  }

  // -- Helpers -------------------------------------------------------------

  static parseWebhookBody(body: string): CalendlyWebhookPayload {
    return JSON.parse(body);
  }

  static formatEventTime(isoString: string): { date: string; time: string; timezone: string } {
    const date = new Date(isoString);
    return {
      date: date.toISOString().split('T')[0],
      time: date.toTimeString().split(' ')[0],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  static getEventDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  static isWithinTimeRange(eventTime: string, startTime: string, endTime: string): boolean {
    const event = new Date(eventTime);
    const start = new Date(startTime);
    const end = new Date(endTime);
    return event >= start && event <= end;
  }
}
