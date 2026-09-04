import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HubSpotConfig {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  refreshToken?: string;
  scopes?: string[];
  baseUrl?: string;
}

export interface HubSpotContact {
  id: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archivedAt?: string;
  properties: Record<string, string>;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
}

export interface HubSpotCompany {
  id: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  properties: Record<string, string>;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
}

export interface HubSpotDeal {
  id: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  properties: Record<string, string>;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
}

export interface HubSpotTicket {
  id: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  properties: Record<string, string>;
}

export interface HubSpotEngagement {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, string>;
}

export interface HubSpotPipeline {
  id: string;
  label: string;
  displayOrder: number;
  stages: HubSpotPipelineStage[];
}

export interface HubSpotPipelineStage {
  id: string;
  label: string;
  displayOrder: number;
  probability: number;
  winProbabilityStage?: boolean;
  active: boolean;
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number;
  archived: boolean;
}

export interface HubSpotListResponse<T> {
  results: T[];
  paging?: { next?: { after: string; link: string } };
}

export interface HubSpotSearchRequest {
  filterGroups?: { filters: { propertyName: string; operator: string; value: string }[] }[];
  query?: string;
  properties?: string[];
  sorts?: { propertyName: string; direction: 'ASCENDING' | 'DESCENDING' }[];
  limit?: number;
  after?: string;
}

export interface HubSpotEmail {
  id: string;
  createdAt: string;
  updatedAt: string;
  properties: {
    hs_email_direction: string;
    hs_email_from?: string;
    hs_email_to?: string;
    hs_email_subject?: string;
    hs_email_text?: string;
    hs_email_html?: string;
    hs_timestamp?: string;
    hs_email_status?: string;
  };
}

// ---------------------------------------------------------------------------
// HubSpot CRM Integration
// ---------------------------------------------------------------------------

export class HubSpotIntegration extends BaseIntegration {
  private config: HubSpotConfig;

  constructor(config: HubSpotConfig) {
    super(config.baseUrl || 'https://api.hubapi.com/v3', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 100, windowMs: 10000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.accessToken ? AT.Bearer : AT.OAuth2;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken || this.config.accessToken;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  getCapabilities(): string[] {
    return [
      'contacts.create',
      'contacts.read',
      'contacts.update',
      'contacts.delete',
      'contacts.search',
      'companies.create',
      'companies.read',
      'companies.update',
      'companies.delete',
      'deals.create',
      'deals.read',
      'deals.update',
      'deals.delete',
      'tickets.create',
      'tickets.read',
      'tickets.update',
      'pipelines.read',
      'pipelines.update',
      'engagements.create',
      'engagements.read',
      'owners.read',
      'email.send',
      'email.track',
      'properties.manage',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    const scopes = this.config.scopes || [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'tickets',
      'eautomation',
    ];
    const params = new URLSearchParams({
      client_id: this.config.clientId || '',
      redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
      scope: scopes.join(' '),
      state: state || '',
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
        redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
      }).toString(),
    });
    if (!response.ok) throw new Error(`HubSpot token exchange failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    this.tokenData = {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
      tokenType: 'Bearer',
      scope: data.scope as string,
    };
    return this.tokenData;
  }

  // -- Contacts ------------------------------------------------------------

  async createContact(properties: Record<string, string>): Promise<HubSpotContact> {
    return this.post('/crm/v3/objects/contacts', { properties });
  }

  async getContact(contactId: string, properties?: string[]): Promise<HubSpotContact> {
    const params: Record<string, string> = {};
    if (properties?.length) params.properties = properties.join(',');
    return this.get(`/crm/v3/objects/contacts/${contactId}`, params);
  }

  async listContacts(options?: { limit?: number; after?: string; properties?: string[] }): Promise<HubSpotListResponse<HubSpotContact>> {
    const params: Record<string, string | number> = { limit: options?.limit || 100 };
    if (options?.after) params.after = options.after;
    if (options?.properties?.length) params.properties = options.properties.join(',');
    return this.get('/crm/v3/objects/contacts', params);
  }

  async updateContact(contactId: string, properties: Record<string, string>): Promise<HubSpotContact> {
    return this.patch(`/crm/v3/objects/contacts/${contactId}`, { properties });
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.delete(`/crm/v3/objects/contacts/${contactId}`);
  }

  async searchContacts(searchRequest: HubSpotSearchRequest): Promise<HubSpotListResponse<HubSpotContact>> {
    return this.post('/crm/v3/objects/contacts/search', searchRequest);
  }

  async batchCreateContacts(records: { properties: Record<string, string> }[]): Promise<{ results: HubSpotContact[] }> {
    return this.post('/crm/v3/objects/contacts/batch/create', { inputs: records });
  }

  async batchUpdateContacts(records: { id: string; properties: Record<string, string> }[]): Promise<{ results: HubSpotContact[] }> {
    return this.post('/crm/v3/objects/contacts/batch/update', { inputs: records });
  }

  // -- Companies -----------------------------------------------------------

  async createCompany(properties: Record<string, string>): Promise<HubSpotCompany> {
    return this.post('/crm/v3/objects/companies', { properties });
  }

  async getCompany(companyId: string, properties?: string[]): Promise<HubSpotCompany> {
    const params: Record<string, string> = {};
    if (properties?.length) params.properties = properties.join(',');
    return this.get(`/crm/v3/objects/companies/${companyId}`, params);
  }

  async listCompanies(options?: { limit?: number; after?: string; properties?: string[] }): Promise<HubSpotListResponse<HubSpotCompany>> {
    const params: Record<string, string | number> = { limit: options?.limit || 100 };
    if (options?.after) params.after = options.after;
    if (options?.properties?.length) params.properties = options.properties.join(',');
    return this.get('/crm/v3/objects/companies', params);
  }

  async updateCompany(companyId: string, properties: Record<string, string>): Promise<HubSpotCompany> {
    return this.patch(`/crm/v3/objects/companies/${companyId}`, { properties });
  }

  async deleteCompany(companyId: string): Promise<void> {
    await this.delete(`/crm/v3/objects/companies/${companyId}`);
  }

  async searchCompanies(searchRequest: HubSpotSearchRequest): Promise<HubSpotListResponse<HubSpotCompany>> {
    return this.post('/crm/v3/objects/companies/search', searchRequest);
  }

  async associateCompanyToContact(companyId: string, contactId: string, associationType: string = 'contact_to_company'): Promise<void> {
    await this.put(`/crm/v3/objects/companies/${companyId}/associations/contacts/${contactId}/${associationType}`);
  }

  // -- Deals ---------------------------------------------------------------

  async createDeal(properties: Record<string, string>): Promise<HubSpotDeal> {
    return this.post('/crm/v3/objects/deals', { properties });
  }

  async getDeal(dealId: string, properties?: string[]): Promise<HubSpotDeal> {
    const params: Record<string, string> = {};
    if (properties?.length) params.properties = properties.join(',');
    return this.get(`/crm/v3/objects/deals/${dealId}`, params);
  }

  async listDeals(options?: { limit?: number; after?: string; properties?: string[] }): Promise<HubSpotListResponse<HubSpotDeal>> {
    const params: Record<string, string | number> = { limit: options?.limit || 100 };
    if (options?.after) params.after = options.after;
    if (options?.properties?.length) params.properties = options.properties.join(',');
    return this.get('/crm/v3/objects/deals', params);
  }

  async updateDeal(dealId: string, properties: Record<string, string>): Promise<HubSpotDeal> {
    return this.patch(`/crm/v3/objects/deals/${dealId}`, { properties });
  }

  async deleteDeal(dealId: string): Promise<void> {
    await this.delete(`/crm/v3/objects/deals/${dealId}`);
  }

  async searchDeals(searchRequest: HubSpotSearchRequest): Promise<HubSpotListResponse<HubSpotDeal>> {
    return this.post('/crm/v3/objects/deals/search', searchRequest);
  }

  async associateDealToCompany(dealId: string, companyId: string): Promise<void> {
    await this.put(`/crm/v3/objects/deals/${dealId}/associations/companies/${companyId}/deal_to_company`);
  }

  async associateDealToContact(dealId: string, contactId: string): Promise<void> {
    await this.put(`/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`);
  }

  // -- Tickets -------------------------------------------------------------

  async createTicket(properties: Record<string, string>): Promise<HubSpotTicket> {
    return this.post('/crm/v3/objects/tickets', { properties });
  }

  async getTicket(ticketId: string): Promise<HubSpotTicket> {
    return this.get(`/crm/v3/objects/tickets/${ticketId}`);
  }

  async listTickets(options?: { limit?: number; after?: string }): Promise<HubSpotListResponse<HubSpotTicket>> {
    const params: Record<string, string | number> = { limit: options?.limit || 100 };
    if (options?.after) params.after = options.after;
    return this.get('/crm/v3/objects/tickets', params);
  }

  async updateTicket(ticketId: string, properties: Record<string, string>): Promise<HubSpotTicket> {
    return this.patch(`/crm/v3/objects/tickets/${ticketId}`, { properties });
  }

  async deleteTicket(ticketId: string): Promise<void> {
    await this.delete(`/crm/v3/objects/tickets/${ticketId}`);
  }

  // -- Pipelines -----------------------------------------------------------

  async listPipelines(objectType: 'deals' | 'tickets'): Promise<HubSpotPipeline[]> {
    return this.get(`/crm/v3/pipelines/${objectType}`);
  }

  async getPipeline(objectType: 'deals' | 'tickets', pipelineId: string): Promise<HubSpotPipeline> {
    return this.get(`/crm/v3/pipelines/${objectType}/${pipelineId}`);
  }

  async createPipeline(objectType: 'deals' | 'tickets', data: { label: string; stages: { label: string; probability?: number; displayOrder?: number }[] }): Promise<HubSpotPipeline> {
    return this.post(`/crm/v3/pipelines/${objectType}`, data);
  }

  async updatePipeline(objectType: 'deals' | 'tickets', pipelineId: string, data: { label?: string }): Promise<HubSpotPipeline> {
    return this.patch(`/crm/v3/pipelines/${objectType}/${pipelineId}`, data);
  }

  async reorderPipelineStages(objectType: 'deals' | 'tickets', pipelineId: string, stageIds: string[]): Promise<void> {
    await this.put(`/crm/v3/pipelines/${objectType}/${pipelineId}/stages/reorder`, {
      stageIds,
    });
  }

  // -- Engagements ---------------------------------------------------------

  async createEngagement(type: string, properties: Record<string, string>): Promise<HubSpotEngagement> {
    return this.post('/crm/v3/objects/engagements', { properties, associations: [{ type, id: '' }] });
  }

  async createNote(contactId: string, body: string): Promise<HubSpotEngagement> {
    return this.post('/crm/v3/objects/engagements', {
      properties: { hs_note_body: body },
      associations: [{ type: 'contact', id: contactId }],
    });
  }

  async createActivity(dealId: string, type: string, properties: Record<string, string>): Promise<HubSpotEngagement> {
    return this.post('/crm/v3/objects/engagements', {
      properties: { hs_activity_type: type, ...properties },
      associations: [{ type: 'deal', id: dealId }],
    });
  }

  // -- Owners --------------------------------------------------------------

  async listOwners(): Promise<HubSpotOwner[]> {
    return this.get('/crm/v3/owners');
  }

  async getOwner(ownerId: string): Promise<HubSpotOwner> {
    return this.get(`/crm/v3/owners/${ownerId}`);
  }

  // -- Email Tracking ------------------------------------------------------

  async sendEmail(data: {
    from: string;
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{ id: string }> {
    return this.post('/crm/v3/objects/emails', {
      properties: {
        hs_email_direction: 'OUTBOUND',
        hs_email_from: data.from,
        hs_email_to: data.to,
        hs_email_subject: data.subject,
        hs_email_text: data.body,
        hs_email_html: data.html || data.body,
        hs_timestamp: new Date().toISOString(),
      },
    });
  }

  // -- Properties Management -----------------------------------------------

  async listProperties(objectType: 'contacts' | 'companies' | 'deals' | 'tickets'): Promise<{ results: { name: string; label: string; type: string; groupName: string }[] }> {
    return this.get(`/crm/v3/properties/${objectType}`);
  }

  async getProperty(objectType: string, propertyName: string): Promise<{ name: string; label: string; type: string }> {
    return this.get(`/crm/v3/properties/${objectType}/${propertyName}`);
  }

  async createProperty(objectType: string, property: {
    name: string;
    label: string;
    type: string;
    groupName?: string;
    options?: { label: string; value: string; displayOrder: number }[];
  }): Promise<void> {
    await this.post(`/crm/v3/properties/${objectType}`, property);
  }

  async updateProperty(objectType: string, propertyName: string, updates: { label?: string; groupName?: string }): Promise<void> {
    await this.patch(`/crm/v3/properties/${objectType}/${propertyName}`, updates);
  }

  async deleteProperty(objectType: string, propertyName: string): Promise<void> {
    await this.delete(`/crm/v3/properties/${objectType}/${propertyName}`);
  }

  // -- Associations --------------------------------------------------------

  async getAssociations(objectType: string, objectId: string, toObjectType: string): Promise<{ results: { id: string; type: string }[] }> {
    return this.get(`/crm/v3/objects/${objectType}/${objectId}/associations/${toObjectType}`);
  }

  async createAssociation(fromType: string, fromId: string, toType: string, toId: string, associationType: string): Promise<void> {
    await this.put(`/crm/v3/objects/${fromType}/${fromId}/associations/${toType}/${toId}/${associationType}`);
  }

  async deleteAssociation(fromType: string, fromId: string, toType: string, toId: string, associationType: string): Promise<void> {
    await this.delete(`/crm/v3/objects/${fromType}/${fromId}/associations/${toType}/${toId}/${associationType}`);
  }
}
