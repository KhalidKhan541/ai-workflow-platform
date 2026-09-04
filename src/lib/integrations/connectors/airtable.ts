import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AirtableConfig {
  apiKey?: string;
  baseId: string;
  personalAccessToken?: string;
  enterpriseApiKey?: string;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: {
    choices?: { id: string; name: string; color?: string }[];
    dateFormat?: { name: string };
    timeZone?: string;
    length?: number;
  };
}

export interface AirtableTable {
  id: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: AirtableView[];
}

export interface AirtableView {
  id: string;
  name: string;
  type: string;
}

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableListResponse<T = AirtableRecord> {
  records: T[];
  offset?: string;
}

export interface AirtableSelectParams {
  fields?: string[];
  filterByFormula?: string;
  maxRecords?: number;
  pageSize?: number;
  sort?: { field: string; direction: 'asc' | 'desc' }[];
  view?: string;
  offset?: string;
}

export interface AirtableBatchResponse {
  records: AirtableRecord[];
  errors?: { recordId?: string; error: { type: string; message: string } }[];
}

export interface AirtableWebhookPayload {
  webhook: { id: string };
  timestamp: string;
  created: { tableId: string; recordId: string; fields: Record<string, unknown> }[];
  changed: { tableId: string; recordId: string; currentFields: Record<string, unknown>; previousFields: Record<string, unknown> }[];
  deleted: { tableId: string; recordId: string }[];
}

// ---------------------------------------------------------------------------
// Airtable Integration
// ---------------------------------------------------------------------------

export class AirtableIntegration extends BaseIntegration {
  private config: AirtableConfig;

  constructor(config: AirtableConfig) {
    super('https://api.airtable.com/v0', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 5, windowMs: 1000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.config.personalAccessToken || this.config.apiKey;
    return { Authorization: `Bearer ${token}` };
  }

  getCapabilities(): string[] {
    return [
      'records.create',
      'records.read',
      'records.update',
      'records.delete',
      'records.batch',
      'records.search',
      'tables.create',
      'tables.read',
      'tables.update',
      'tables.delete',
      'fields.read',
      'fields.create',
      'fields.update',
      'views.read',
      'bases.read',
      'webhooks',
    ];
  }

  // -- Bases ---------------------------------------------------------------

  async listBases(): Promise<{ bases: AirtableBase[] }> {
    return this.get('/meta/bases', {});
  }

  async getBase(baseId: string): Promise<AirtableBase> {
    return this.get(`/meta/bases/${baseId}`);
  }

  async createBase(name: string, tables: { name: string; fields: { name: string; type: string }[] }[]): Promise<AirtableBase> {
    return this.post('/meta/bases', { name, tables });
  }

  async listTables(baseId: string): Promise<AirtableTable[]> {
    return this.get(`/meta/bases/${baseId}/tables`);
  }

  async getTable(baseId: string, tableId: string): Promise<AirtableTable> {
    return this.get(`/meta/bases/${baseId}/tables/${tableId}`);
  }

  // -- Records -------------------------------------------------------------

  private tableUrl(baseId: string, tableId: string): string {
    return `/${baseId}/${tableId}`;
  }

  async listRecords(baseId: string, tableId: string, params?: AirtableSelectParams): Promise<AirtableListResponse> {
    const queryParams: Record<string, string | number> = {};
    if (params?.fields?.length) queryParams.fields = JSON.stringify(params.fields);
    if (params?.filterByFormula) queryParams.filterByFormula = params.filterByFormula;
    if (params?.maxRecords) queryParams.maxRecords = params.maxRecords;
    if (params?.pageSize) queryParams.pageSize = params.pageSize;
    if (params?.sort) queryParams.sort = JSON.stringify(params.sort);
    if (params?.view) queryParams.view = params.view;
    if (params?.offset) queryParams.offset = params.offset;
    return this.get(this.tableUrl(baseId, tableId), queryParams);
  }

  async listAllRecords(baseId: string, tableId: string, params?: Omit<AirtableSelectParams, 'offset'>): Promise<AirtableRecord[]> {
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;
    do {
      const result = await this.listRecords(baseId, tableId, { ...params, offset, pageSize: params?.pageSize || 100 });
      allRecords.push(...result.records);
      offset = result.offset;
    } while (offset);
    return allRecords;
  }

  async getRecord(baseId: string, tableId: string, recordId: string): Promise<AirtableRecord> {
    return this.get(`${this.tableUrl(baseId, tableId)}/${recordId}`);
  }

  async createRecord(baseId: string, tableId: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
    return this.post(this.tableUrl(baseId, tableId), { fields });
  }

  async updateRecord(baseId: string, tableId: string, recordId: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
    return this.patch(`${this.tableUrl(baseId, tableId)}/${recordId}`, { fields });
  }

  async replaceRecord(baseId: string, tableId: string, recordId: string, fields: Record<string, unknown>): Promise<AirtableRecord> {
    return this.put(`${this.tableUrl(baseId, tableId)}/${recordId}`, { fields });
  }

  async deleteRecord(baseId: string, tableId: string, recordId: string): Promise<{ id: string; deleted: boolean }> {
    return this.delete(`${this.tableUrl(baseId, tableId)}/${recordId}`);
  }

  // -- Batch Operations ----------------------------------------------------

  async batchCreate(baseId: string, tableId: string, records: { fields: Record<string, unknown> }[]): Promise<AirtableBatchResponse> {
    return this.post(`${this.tableUrl(baseId, tableId)}`, { records });
  }

  async batchUpdate(baseId: string, tableId: string, records: { id: string; fields: Record<string, unknown> }[]): Promise<AirtableBatchResponse> {
    return this.patch(`${this.tableUrl(baseId, tableId)}`, { records });
  }

  async batchDelete(baseId: string, tableId: string, recordIds: string[]): Promise<{ records: { id: string; deleted: boolean }[] }> {
    return this.delete(this.tableUrl(baseId, tableId), { records: recordIds.map(id => ({ id })) } as unknown);
  }

  async batchUpsert(
    baseId: string,
    tableId: string,
    records: { fields: Record<string, unknown> }[],
    keyFields?: string[],
  ): Promise<AirtableBatchResponse> {
    const body: Record<string, unknown> = { records };
    if (keyFields?.length) {
      body.typecast = true;
      body.performUpsert = { keyFields };
    }
    return this.post(`${this.tableUrl(baseId, tableId)}`, body);
  }

  // -- Search --------------------------------------------------------------

  async searchRecords(
    baseId: string,
    tableId: string,
    query: string,
    options?: {
      fields?: string[];
      maxRecords?: number;
      sort?: { field: string; direction: 'asc' | 'desc' }[];
      view?: string;
    },
  ): Promise<AirtableListResponse> {
    const params: AirtableSelectParams = {
      filterByFormula: `SEARCH("${query.replace(/"/g, '\\"')}", ${options?.fields?.map(f => `{${f}}`).join(' & ') || 'CurrentValue()'})`,
      ...options,
    };
    return this.listRecords(baseId, tableId, params);
  }

  async searchRecordsWithFormula(
    baseId: string,
    tableId: string,
    formula: string,
    options?: Omit<AirtableSelectParams, 'filterByFormula'>,
  ): Promise<AirtableListResponse> {
    return this.listRecords(baseId, tableId, { filterByFormula: formula, ...options });
  }

  // -- Fields --------------------------------------------------------------

  async listFields(baseId: string, tableId: string): Promise<AirtableField[]> {
    const table = await this.getTable(baseId, tableId);
    return table.fields;
  }

  async createField(baseId: string, tableId: string, field: {
    name: string;
    type: string;
    description?: string;
    options?: Record<string, unknown>;
  }): Promise<AirtableField> {
    return this.post(`/meta/bases/${baseId}/tables/${tableId}/fields`, field);
  }

  async updateField(baseId: string, tableId: string, fieldId: string, updates: {
    name?: string;
    description?: string;
    options?: Record<string, unknown>;
  }): Promise<AirtableField> {
    return this.patch(`/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`, updates);
  }

  async deleteField(baseId: string, tableId: string, fieldId: string): Promise<{ deleted: boolean; id: string }> {
    return this.delete(`/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`);
  }

  // -- Views ---------------------------------------------------------------

  async listViews(baseId: string, tableId: string): Promise<AirtableView[]> {
    const table = await this.getTable(baseId, tableId);
    return table.views;
  }

  async createView(baseId: string, tableId: string, name: string, type: string = 'grid'): Promise<AirtableView> {
    return this.post(`/meta/bases/${baseId}/tables/${tableId}/views`, { name, type });
  }

  async updateView(baseId: string, tableId: string, viewId: string, updates: { name?: string }): Promise<AirtableView> {
    return this.patch(`/meta/bases/${baseId}/tables/${tableId}/views/${viewId}`, updates);
  }

  async deleteView(baseId: string, tableId: string, viewId: string): Promise<{ deleted: boolean; id: string }> {
    return this.delete(`/meta/bases/${baseId}/tables/${tableId}/views/${viewId}`);
  }

  async listRecordsByView(baseId: string, tableId: string, viewId: string, params?: Omit<AirtableSelectParams, 'view'>): Promise<AirtableListResponse> {
    return this.listRecords(baseId, tableId, { ...params, view: viewId });
  }

  // -- Webhooks ------------------------------------------------------------

  async createWebhook(spec: {
    notificationUrl: string;
    filterCardinals?: string[];
    includes?: Record<string, unknown>;
  }): Promise<{ id: string; url: string; isActive: boolean }> {
    return this.post('/webhooks', spec);
  }

  async listWebhooks(): Promise<{ webhooks: { id: string; url: string; isActive: boolean; lastSuccessfulNotificationAt?: string }[] }> {
    return this.get('/webhooks');
  }

  async getWebhook(webhookId: string): Promise<{ id: string; url: string; isActive: boolean }> {
    return this.get(`/webhooks/${webhookId}`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.delete(`/webhooks/${webhookId}`);
  }

  async refreshWebhook(webhookId: string): Promise<{ expirationTime: string }> {
    return this.post(`/webhooks/${webhookId}/refresh`);
  }

  // -- Helpers -------------------------------------------------------------

  static buildFormula(operator: string, ...conditions: string[]): string {
    return `${operator}(${conditions.join(', ')})`;
  }

  static fieldEquals(fieldName: string, value: string): string {
    return `{${fieldName}} = "${value}"`;
  }

  static fieldContains(fieldName: string, value: string): string {
    return `SEARCH("${value}", {${fieldName}})`;
  }

  static fieldIsEmpty(fieldName: string): string {
    return `{${fieldName}} = ""`;
  }

  static fieldIsNotEmpty(fieldName: string): string {
    return `{${fieldName}} != ""`;
  }

  static recordToJson(record: AirtableRecord): Record<string, unknown> {
    return { id: record.id, ...record.fields };
  }
}
