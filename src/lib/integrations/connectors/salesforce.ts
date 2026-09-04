import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  securityToken?: string;
  refreshToken?: string;
  loginUrl?: string;
  apiVersion?: string;
  instanceUrl?: string;
}

export interface SalesforceRecord {
  Id: string;
  [field: string]: unknown;
}

export interface SalesforceQueryResult<T = SalesforceRecord> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

export interface SalesforceMetadata {
  name: string;
  label: string;
  fields: {
    name: string;
    label: string;
    type: string;
    required: boolean;
    length?: number;
    decimalPlaces?: number;
    referenceTo?: string[];
   picklistValues?: { label: string; value: string }[];
    unique?: boolean;
    externalId?: boolean;
    createable?: boolean;
    updateable?: boolean;
    calculated?: boolean;
  }[];
}

export interface SalesforceDescribeResult {
  name: string;
  label: string;
  labelPlural: string;
  fields: {
    name: string;
    label: string;
    type: string;
    required: boolean;
    length?: number;
    referenceTo?: string[];
    picklistValues?: { label: string; value: string; active: boolean }[];
    createable?: boolean;
    updateable?: boolean;
    custom?: boolean;
  }[];
  childRelationships: { childSObject: string; field: string }[];
}

export interface SalesforceBulkJob {
  id: string;
  operation: string;
  object: string;
  state: 'Open' | 'UploadComplete' | 'InProgress' | 'JobComplete' | 'Failed' | 'Aborted';
  createdDate: string;
  systemModstamp: string;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
}

export interface SalesforceFlowDefinition {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  ActiveVersionId?: string;
  Description?: string;
}

export interface SalesforceError {
  message: string;
  errorCode: string;
  fields?: string[];
}

export interface SalesforceApiLimit {
  Max: number;
  Used: number;
  Remaining: number;
}

// ---------------------------------------------------------------------------
// Salesforce Integration
// ---------------------------------------------------------------------------

export class SalesforceIntegration extends BaseIntegration {
  private config: SalesforceConfig;
  private accessToken: string = '';
  private instanceUrl: string = '';

  constructor(config: SalesforceConfig) {
    super(config.loginUrl || 'https://login.salesforce.com', config);
    this.config = config;
    this.instanceUrl = config.instanceUrl || '';
    this.rateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.accessToken) await this.authenticate();
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private get apiVersion(): string {
    return this.config.apiVersion || 'v58.0';
  }

  private get baseUrl(): string {
    return `${this.instanceUrl}/services/data/${this.apiVersion}`;
  }

  getCapabilities(): string[] {
    return [
      'records.create',
      'records.read',
      'records.update',
      'records.delete',
      'records.query',
      'records.search',
      'records.undelete',
      'bulk.create',
      'bulk.read',
      'bulk.update',
      'bulk.delete',
      'metadata.describe',
      'metadata.read',
      'flows.trigger',
      'limits.read',
      'apex.execute',
    ];
  }

  // -- Authentication ------------------------------------------------------

  async authenticate(): Promise<TokenData> {
    if (this.config.username && this.config.password) {
      return this.authenticateWithCredentials();
    } else if (this.config.refreshToken) {
      return this.authenticateWithRefreshToken();
    }
    throw new Error('No authentication method available');
  }

  private async authenticateWithCredentials(): Promise<TokenData> {
    const response = await fetch(`${this.config.loginUrl || 'https://login.salesforce.com'}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        username: this.config.username!,
        password: `${this.config.password}${this.config.securityToken || ''}`,
      }).toString(),
    });
    if (!response.ok) throw new Error(`Salesforce auth failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    this.accessToken = data.access_token as string;
    this.instanceUrl = data.instance_url as string;
    this.tokenData = {
      accessToken: this.accessToken,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt: Date.now() + (data.expires_in as number || 3600) * 1000,
      tokenType: 'Bearer',
    };
    return this.tokenData;
  }

  private async authenticateWithRefreshToken(): Promise<TokenData> {
    const response = await fetch(`${this.config.loginUrl || 'https://login.salesforce.com'}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken!,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });
    if (!response.ok) throw new Error(`Salesforce token refresh failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    this.accessToken = data.access_token as string;
    this.instanceUrl = data.instance_url as string;
    this.tokenData = {
      accessToken: this.accessToken,
      refreshToken: this.config.refreshToken,
      expiresAt: Date.now() + (data.expires_in as number || 3600) * 1000,
      tokenType: 'Bearer',
    };
    return this.tokenData;
  }

  // -- SOQL Queries --------------------------------------------------------

  async query(soql: string): Promise<SalesforceQueryResult> {
    return this.get('/query', { q: soql });
  }

  async queryAll(soql: string): Promise<SalesforceRecord[]> {
    const allRecords: SalesforceRecord[] = [];
    let result = await this.query(soql);
    allRecords.push(...result.records);

    while (!result.done && result.nextRecordsUrl) {
      result = await this.get(result.nextRecordsUrl.replace(this.baseUrl, ''));
      allRecords.push(...result.records);
    }

    return allRecords;
  }

  async queryMore(nextRecordsUrl: string): Promise<SalesforceQueryResult> {
    return this.get(nextRecordsUrl.replace(this.baseUrl, ''));
  }

  async search(sosl: string): Promise<{ searchRecords: SalesforceRecord[] }> {
    return this.get('/search', { q: sosl });
  }

  // -- CRUD Operations -----------------------------------------------------

  async create(sobjectType: string, data: Record<string, unknown>): Promise<{ id: string; success: boolean; errors: SalesforceError[] }> {
    return this.post(`/${sobjectType}`, data);
  }

  async retrieve(sobjectType: string, id: string, fields?: string[]): Promise<SalesforceRecord> {
    const params: Record<string, string> = {};
    if (fields?.length) params.fields = fields.join(',');
    return this.get(`/${sobjectType}/${id}`, params);
  }

  async update(sobjectType: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.patch(`/${sobjectType}/${id}`, data);
  }

  async delete(sobjectType: string, id: string): Promise<{ id: string; success: boolean; errors: SalesforceError[] }> {
    return this.delete(`/${sobjectType}/${id}`);
  }

  async undelete(ids: string[]): Promise<{ id: string; success: boolean }[]> {
    return this.post('/sobjects/undelete', { ids });
  }

  async upsert(sobjectType: string, externalIdField: string, externalId: string, data: Record<string, unknown>): Promise<{ id: string; created: boolean }> {
    return this.request({ method: 'PATCH' as any, url: `/${sobjectType}/${externalIdField}/${externalId}`, body: data });
  }

  // -- Bulk Operations -----------------------------------------------------

  async createBulkJob(sobjectType: string, operation: 'insert' | 'update' | 'upsert' | 'delete' | 'hardDelete'): Promise<SalesforceBulkJob> {
    return this.post('/jobs', {
      object: sobjectType,
      operation,
      contentType: 'CSV',
    });
  }

  async uploadBulkData(jobId: string, csvData: string): Promise<{ id: string; state: string; numberRecordsProcessed: number }> {
    return this.request({
      method: 'PUT' as any,
      url: `/jobs/${jobId}`,
      body: csvData,
      headers: { 'Content-Type': 'text/csv' },
    });
  }

  async closeBulkJob(jobId: string): Promise<SalesforceBulkJob> {
    return this.request({ method: 'POST' as any, url: `/jobs/${jobId}`, body: { state: 'UploadComplete' } });
  }

  async getBulkJob(jobId: string): Promise<SalesforceBulkJob> {
    return this.get(`/jobs/${jobId}`);
  }

  async listBulkJobs(): Promise<SalesforceBulkJob[]> {
    return this.get('/jobs');
  }

  async getBulkJobResults(jobId: string): Promise<{ records: SalesforceRecord[] }> {
    return this.get(`/jobs/${jobId}/results`);
  }

  async deleteBulkJob(jobId: string): Promise<void> {
    await this.delete(`/jobs/${jobId}`);
  }

  // -- Metadata ------------------------------------------------------------

  async describeSObject(sobjectType: string): Promise<SalesforceDescribeResult> {
    return this.get(`/sobjects/${sobjectType}/describe`);
  }

  async listSObjects(): Promise<{ name: string; label: string; labelPlural: string; custom: boolean }[]> {
    return this.get('/sobjects');
  }

  async getSObjectMetadata(sobjectType: string): Promise<SalesforceMetadata> {
    return this.get(`/sobjects/${sobjectType}`);
  }

  // -- Flows ---------------------------------------------------------------

  async triggerFlow(flowApiName: string, inputs?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.post(`/actions/custom/flow/${flowApiName}`, { inputs: inputs || {} });
  }

  async listFlows(): Promise<SalesforceFlowDefinition[]> {
    return this.get('/tooling/query', { q: 'SELECT Id, DeveloperName, MasterLabel, Description FROM FlowDefinition WHERE ActiveVersionId != null' });
  }

  // -- Apex ----------------------------------------------------------------

  async executeAnonymousApex(apexCode: string): Promise<{ compilationSuccess: boolean; debugInfo?: string; exceptionMessage?: string; success: boolean }> {
    return this.get('/executeAnonymous', { anonymousBody: apexCode });
  }

  // -- Limits --------------------------------------------------------------

  async getLimits(): Promise<Record<string, SalesforceApiLimit>> {
    return this.get('/limits');
  }

  // -- Record Types --------------------------------------------------------

  async getRecordTypes(sobjectType: string): Promise<{ recordTypeInfos: { recordTypeId: string; name: string; available: boolean; defaultRecordTypeMapping: boolean }[] }> {
    return this.get(`/sobjects/${sobjectType}/describe`);
  }

  // -- Compact Layouts -----------------------------------------------------

  async getCompactLayouts(sobjectType: string): Promise<Record<string, unknown>> {
    return this.get(`/sobjects/${sobjectType}/compactLayouts`);
  }

  // -- Recent Items --------------------------------------------------------

  async getRecentItems(): Promise<{ id: string; name: string; type: string; url: string }[]> {
    return this.get('/recent');
  }

  // -- Approval Process ----------------------------------------------------

  async submitForApproval(recordId: string, comment?: string): Promise<void> {
    await this.post('/approval/submit', { approvalName: '', contextId: recordId, comments: comment || '' });
  }

  // -- Helpers -------------------------------------------------------------

  static buildSOQL(fields: string[], from: string, where?: string, options?: { orderBy?: string; limit?: number; offset?: number }): string {
    let soql = `SELECT ${fields.join(', ')} FROM ${from}`;
    if (where) soql += ` WHERE ${where}`;
    if (options?.orderBy) soql += ` ORDER BY ${options.orderBy}`;
    if (options?.limit) soql += ` LIMIT ${options.limit}`;
    if (options?.offset) soql += ` OFFSET ${options.offset}`;
    return soql;
  }

  static fieldList(metadata: SalesforceMetadata): string[] {
    return metadata.fields.map(f => f.name);
  }

  static requiredFields(metadata: SalesforceMetadata): string[] {
    return metadata.fields.filter(f => f.required).map(f => f.name);
  }
}
