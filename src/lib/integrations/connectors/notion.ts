import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionConfig {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  version?: string;
}

export interface NotionPage {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { object: string; id: string };
  last_edited_by: { object: string; id: string };
  parent: NotionParent;
  archived: boolean;
  properties: Record<string, NotionProperty>;
  icon?: NotionRichTextItem;
  cover?: { type: string; external?: { url: string } };
  url: string;
}

export interface NotionParent {
  type: 'database_id' | 'page_id' | 'workspace';
  database_id?: string;
  page_id?: string;
}

export interface NotionProperty {
  id: string;
  type: string;
  rich_text?: NotionRichTextItem[];
  title?: NotionRichTextItem[];
  number?: number;
  select?: { id: string; name: string; color: string };
  multi_select?: { id: string; name: string; color: string }[];
  date?: { start: string; end?: string; time_zone?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  files?: { name: string; type: string; external?: { url: string }; file?: string }[];
  relation?: { id: string }[];
  rollup?: unknown;
  formula?: { type: string; number?: number; string?: string; boolean?: boolean; date?: unknown };
  status?: { id: string; name: string; color: string };
  people?: { id: string; object: string }[];
  created_time?: string;
  last_edited_time?: string;
  created_by?: { id: string };
  last_edited_by?: { id: string };
}

export interface NotionRichTextItem {
  type: string;
  text?: { content: string; link?: { url: string } };
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href?: string;
}

export interface NotionBlock {
  object: 'block';
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  parent: { type: string; block_id?: string; page_id?: string };
  has_children: boolean;
  archived: boolean;
  [blockType: string]: unknown;
}

export interface NotionDatabase {
  object: 'database';
  id: string;
  title: NotionRichTextItem[];
  description: NotionRichTextItem[];
  created_time: string;
  last_edited_time: string;
  properties: Record<string, { id: string; name: string; type: string }>;
  parent: NotionParent;
  url: string;
  archived: boolean;
}

export interface NotionSearchResult {
  object: 'list';
  results: (NotionPage | NotionDatabase)[];
  has_more: boolean;
  next_cursor: string | null;
}

// ---------------------------------------------------------------------------
// Notion Integration
// ---------------------------------------------------------------------------

export class NotionIntegration extends BaseIntegration {
  private config: NotionConfig;
  private apiVersion: string;

  constructor(config: NotionConfig) {
    super('https://api.notion.com/v1', config);
    this.config = config;
    this.apiVersion = config.version || '2022-06-28';
    this.rateLimitConfig = { maxRequests: 3, windowMs: 1000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.apiKey ? AT.Bearer : AT.OAuth2;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken || this.config.apiKey;
    return {
      Authorization: `Bearer ${token}`,
      'Notion-Version': this.apiVersion,
    };
  }

  getCapabilities(): string[] {
    return [
      'databases.create',
      'databases.read',
      'databases.update',
      'databases.query',
      'pages.create',
      'pages.read',
      'pages.update',
      'pages.delete',
      'blocks.read',
      'blocks.create',
      'blocks.delete',
      'search',
      'users.read',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId || '',
      redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
      response_type: 'code',
      owner: 'user',
      state: state || '',
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code }),
    });
    if (!response.ok) throw new Error(`Notion token exchange failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    this.tokenData = {
      accessToken: data.access_token as string,
      expiresAt: Date.now() + 3600000,
      tokenType: 'Bearer',
    };
    return this.tokenData;
  }

  // -- Search --------------------------------------------------------------

  async search(query: string, options?: {
    filter?: { value: string; property: string };
    sort?: { direction: string; timestamp: string };
    page_size?: number;
    start_cursor?: string;
  }): Promise<NotionSearchResult> {
    const body: Record<string, unknown> = { query };
    if (options?.filter) body.filter = options.filter;
    if (options?.sort) body.sort = options.sort;
    if (options?.page_size) body.page_size = options.page_size;
    if (options?.start_cursor) body.start_cursor = options.start_cursor;
    return this.post('/search', body);
  }

  // -- Databases -----------------------------------------------------------

  async createDatabase(parent: NotionParent, title: NotionRichTextItem[], properties: Record<string, unknown>): Promise<NotionDatabase> {
    return this.post('/databases', { parent, title, properties });
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.get(`/databases/${databaseId}`);
  }

  async updateDatabase(databaseId: string, data: {
    title?: NotionRichTextItem[];
    description?: NotionRichTextItem[];
    properties?: Record<string, unknown>;
  }): Promise<NotionDatabase> {
    return this.patch(`/databases/${databaseId}`, data);
  }

  async queryDatabase(
    databaseId: string,
    options?: {
      filter?: Record<string, unknown>;
      sorts?: { property: string; direction: 'ascending' | 'descending' }[];
      start_cursor?: string;
      page_size?: number;
    },
  ): Promise<{ object: 'list'; results: NotionPage[]; has_more: boolean; next_cursor: string | null }> {
    const body: Record<string, unknown> = {};
    if (options?.filter) body.filter = options.filter;
    if (options?.sorts) body.sorts = options.sorts;
    if (options?.start_cursor) body.start_cursor = options.start_cursor;
    if (options?.page_size) body.page_size = options.page_size;
    return this.post(`/databases/${databaseId}/query`, body);
  }

  async listAllDatabasePages(databaseId: string): Promise<NotionPage[]> {
    const allPages: NotionPage[] = [];
    let startCursor: string | undefined;
    do {
      const result = await this.queryDatabase(databaseId, { start_cursor: startCursor, page_size: 100 });
      allPages.push(...result.results);
      startCursor = result.next_cursor || undefined;
    } while (startCursor);
    return allPages;
  }

  // -- Pages ---------------------------------------------------------------

  async createPage(parent: NotionParent, properties: Record<string, NotionProperty>, children?: NotionBlock[]): Promise<NotionPage> {
    const body: Record<string, unknown> = { parent, properties };
    if (children?.length) body.children = children;
    return this.post('/pages', body);
  }

  async getPage(pageId: string): Promise<NotionPage> {
    return this.get(`/pages/${pageId}`);
  }

  async updatePage(pageId: string, properties: Record<string, NotionProperty>): Promise<NotionPage> {
    return this.patch(`/pages/${pageId}`, { properties });
  }

  async archivePage(pageId: string): Promise<NotionPage> {
    return this.patch(`/pages/${pageId}`, { archived: true });
  }

  async restorePage(pageId: string): Promise<NotionPage> {
    return this.patch(`/pages/${pageId}`, { archived: false });
  }

  // -- Blocks --------------------------------------------------------------

  async getBlockChildren(blockId: string, options?: { start_cursor?: string; page_size?: number }): Promise<{ results: NotionBlock[]; has_more: boolean; next_cursor: string | null }> {
    const params: Record<string, string | number> = {};
    if (options?.start_cursor) params.start_cursor = options.start_cursor;
    if (options?.page_size) params.page_size = options.page_size;
    return this.get(`/blocks/${blockId}/children`, params);
  }

  async getAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
    const allBlocks: NotionBlock[] = [];
    let startCursor: string | undefined;
    do {
      const result = await this.getBlockChildren(blockId, { start_cursor: startCursor, page_size: 100 });
      allBlocks.push(...result.results);
      startCursor = result.next_cursor || undefined;
    } while (startCursor);
    return allBlocks;
  }

  async appendBlockChildren(blockId: string, children: NotionBlock[]): Promise<{ results: NotionBlock[] }> {
    return this.patch(`/blocks/${blockId}/children`, { children });
  }

  async deleteBlock(blockId: string): Promise<{ object: 'block'; id: string; deleted: boolean }> {
    return this.delete(`/blocks/${blockId}`);
  }

  // -- Users ---------------------------------------------------------------

  async listUsers(): Promise<{ results: { id: string; name: string; type: string; avatar_url?: string }[] }> {
    return this.get('/users');
  }

  async getUser(userId: string): Promise<{ id: string; name: string; type: string; avatar_url?: string; email?: string }> {
    return this.get(`/users/${userId}`);
  }

  // -- Helpers -------------------------------------------------------------

  static richText(text: string, options?: { bold?: boolean; italic?: boolean; code?: boolean; color?: string }): NotionRichTextItem[] {
    return [{
      type: 'text',
      text: { content: text },
      plain_text: text,
      annotations: {
        bold: options?.bold || false,
        italic: options?.italic || false,
        strikethrough: false,
        underline: false,
        code: options?.code || false,
        color: options?.color || 'default',
      },
    }];
  }

  static heading(text: string, level: 1 | 2 | 3 = 1): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: `heading_${level}`,
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: false,
      archived: false,
      [`heading_${level}`]: {
        rich_text: NotionIntegration.richText(text),
      },
    } as unknown as NotionBlock;
  }

  static paragraph(text: string): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: 'paragraph',
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: false,
      archived: false,
      paragraph: {
        rich_text: NotionIntegration.richText(text),
      },
    } as unknown as NotionBlock;
  }

  static bulletedListItem(text: string): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: 'bulleted_list_item',
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: false,
      archived: false,
      bulleted_list_item: {
        rich_text: NotionIntegration.richText(text),
      },
    } as unknown as NotionBlock;
  }

  static toDo(text: string, checked: boolean = false): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: 'to_do',
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: false,
      archived: false,
      to_do: {
        rich_text: NotionIntegration.richText(text),
        checked,
      },
    } as unknown as NotionBlock;
  }

  static code(text: string, language?: string): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: 'code',
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: false,
      archived: false,
      code: {
        rich_text: NotionIntegration.richText(text),
        language: language || 'plain text',
      },
    } as unknown as NotionBlock;
  }

  static toggle(text: string, children?: NotionBlock[]): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: 'toggle',
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: !!children?.length,
      archived: false,
      toggle: {
        rich_text: NotionIntegration.richText(text),
      },
      children,
    } as unknown as NotionBlock;
  }

  static divider(): NotionBlock {
    return {
      object: 'block',
      id: '',
      type: 'divider',
      created_time: '',
      last_edited_time: '',
      parent: { type: 'block_id' },
      has_children: false,
      archived: false,
    } as unknown as NotionBlock;
  }
}
