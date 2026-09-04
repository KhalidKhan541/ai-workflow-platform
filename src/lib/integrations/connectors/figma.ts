import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FigmaConfig {
  accessToken: string;
  teamId?: string;
}

export interface FigmaFile {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  pages: FigmaPage[];
  document: FigmaNode;
}

export interface FigmaPage {
  id: string;
  name: string;
  type: string;
  children: FigmaNode[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  blendMode?: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  effects?: FigmaEffect[];
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  characters?: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    fills?: FigmaPaint[];
    textAlignHorizontal?: string;
    textAlignVertical?: string;
  };
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  relativeTransform?: number[][];
  constraints?: { vertical: string; horizontal: string };
  clipsContent?: boolean;
  componentId?: string;
  componentName?: string;
  exportSettings?: FigmaExportSetting[];
}

export interface FigmaPaint {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
  visible?: boolean;
  blendMode?: string;
  scaleMode?: string;
  imageRef?: string;
}

export interface FigmaEffect {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
  visible?: boolean;
}

export interface FigmaExportSetting {
  suffix: string;
  format: string;
  constraint: { type: string; value: number };
}

export interface FigmaComponent {
  key: string;
  file_key: string;
  node_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  containing_frame?: { name: string; id: string };
}

export interface FigmaComponentSet {
  key: string;
  name: string;
  description: string;
  file_key: string;
  node_id: string;
  created_at: string;
  updated_at: string;
}

export interface FigmaComment {
  id: string;
  message: string;
  file_key: string;
  parent_id?: string;
  user: FigmaUser;
  created_at: string;
  resolved_at?: string;
  order_id: string;
  client_meta?: { page_id: string; node_id: string; node_offset: { x: number; y: number } };
}

export interface FigmaUser {
  handle: string;
  img_url: string;
  id: string;
}

export interface FigmaWebhookEvent {
  event_type: string;
  passcode: string;
  timestamp: string;
  payload: {
    key: string;
    name: string;
    page_id?: string;
    user_id: string;
    timestamp: string;
  };
}

export interface FigmaFileVersion {
  id: string;
  created_at: string;
  label?: string;
  description?: string;
  user: FigmaUser;
}

export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  style_type: string;
  created_at: string;
  updated_at: string;
  created_by: FigmaUser;
  updated_by: FigmaUser;
  contexts: { fill_geometry?: unknown[]; text?: string; node_id: string }[];
}

// ---------------------------------------------------------------------------
// Figma Integration
// ---------------------------------------------------------------------------

export class FigmaIntegration extends BaseIntegration {
  private config: FigmaConfig;

  constructor(config: FigmaConfig) {
    super('https://api.figma.com/v1', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return { 'X-Figma-Token': this.config.accessToken };
  }

  getCapabilities(): string[] {
    return [
      'files.read',
      'files.export',
      'components.read',
      'component_sets.read',
      'styles.read',
      'comments.read',
      'comments.create',
      'comments.delete',
      'webhooks.create',
      'webhooks.read',
      'webhooks.delete',
      'users.read',
      'teams.read',
      'projects.read',
      'versions.read',
    ];
  }

  // -- Files ---------------------------------------------------------------

  async getFile(fileKey: string, options?: {
    ids?: string[];
    geometry?: string;
    plugin_data?: string;
    depth?: number;
    node_ids?: string[];
  }): Promise<FigmaFile> {
    const params: Record<string, string> = {};
    if (options?.ids) params.ids = options.ids.join(',');
    if (options?.geometry) params.geometry = options.geometry;
    if (options?.plugin_data) params.plugin_data = options.plugin_data;
    if (options?.depth) params.depth = String(options.depth);
    if (options?.node_ids) params.node_ids = options.node_ids.join(',');
    return this.get(`/files/${fileKey}`, params);
  }

  async getFileNodes(fileKey: string, nodeIds: string[], options?: {
    geometry?: string;
    plugin_data?: string;
  }): Promise<{ nodes: Record<string, { document: FigmaNode }> }> {
    const params: Record<string, string> = { ids: nodeIds.join(',') };
    if (options?.geometry) params.geometry = options.geometry;
    if (options?.plugin_data) params.plugin_data = options.plugin_data;
    return this.get(`/files/${fileKey}/nodes`, params);
  }

  async getFileStyles(fileKey: string): Promise<{ meta: { styles: FigmaStyle[] } }> {
    return this.get(`/files/${fileKey}/styles`);
  }

  async getFileComponents(fileKey: string): Promise<{ meta: { components: Record<string, FigmaComponent> } }> {
    return this.get(`/files/${fileKey}/components`);
  }

  async getFileComponentSets(fileKey: string): Promise<{ meta: { component_sets: Record<string, FigmaComponentSet> } }> {
    return this.get(`/files/${fileKey}/component_sets`);
  }

  async getVersions(fileKey: string): Promise<{ versions: FigmaFileVersion[] }> {
    return this.get(`/files/${fileKey}/versions`);
  }

  async getSpecificVersion(fileKey: string, versionId: string): Promise<FigmaFileVersion> {
    return this.get(`/files/${fileKey}/versions/${versionId}`);
  }

  // -- Export --------------------------------------------------------------

  async exportImage(fileKey: string, options: {
    ids?: string[];
    scale?: number;
    format?: 'jpg' | 'png' | 'svg' | 'pdf';
    svg_include_id?: boolean;
    svg_simplify_stroke?: boolean;
    use_absolute_bounds?: boolean;
    viewer_ids?: string[];
    node_ids?: string[];
  }): Promise<{ images: Record<string, string | null> }> {
    const params: Record<string, string> = {};
    if (options.ids) params.ids = options.ids.join(',');
    if (options.node_ids) params.ids = options.node_ids.join(',');
    if (options.scale) params.scale = String(options.scale);
    if (options.format) params.format = options.format;
    if (options.svg_include_id) params.svg_include_id = 'true';
    if (options.svg_simplify_stroke) params.svg_simplify_stroke = 'true';
    if (options.use_absolute_bounds) params.use_absolute_bounds = 'true';
    if (options.viewer_ids) params.viewer_ids = options.viewer_ids.join(',');
    return this.get(`/images/${fileKey}`, params);
  }

  async exportImageFills(fileKey: string, options?: {
    ids?: string[];
    scale?: number;
    format?: 'jpg' | 'png';
  }): Promise<{ images: Record<string, string | null> }> {
    const params: Record<string, string> = {};
    if (options?.ids) params.ids = options.ids.join(',');
    if (options?.scale) params.scale = String(options.scale);
    if (options?.format) params.format = options.format;
    return this.get(`/files/${fileKey}/images`, params);
  }

  // -- Comments ------------------------------------------------------------

  async getComments(fileKey: string): Promise<{ comments: FigmaComment[] }> {
    return this.get(`/files/${fileKey}/comments`);
  }

  async postComment(fileKey: string, message: string, options?: {
    client_meta?: { node_id: string; node_offset?: { x: number; y: number } };
  }): Promise<FigmaComment> {
    const body: Record<string, unknown> = { message };
    if (options?.client_meta) body.client_meta = options.client_meta;
    return this.post(`/files/${fileKey}/comments`, body);
  }

  async replyToComment(fileKey: string, commentId: string, message: string): Promise<FigmaComment> {
    return this.post(`/files/${fileKey}/comments`, {
      message,
      comment_id: commentId,
    });
  }

  async deleteComment(fileKey: string, commentId: string): Promise<void> {
    await this.delete(`/files/${fileKey}/comments/${commentId}`);
  }

  async resolveComment(fileKey: string, commentId: string): Promise<FigmaComment> {
    return this.request({
      method: 'POST' as any,
      url: `/files/${fileKey}/comments/${commentId}/resolve`,
    });
  }

  // -- Components ----------------------------------------------------------

  async getLocalComponents(fileKey: string): Promise<FigmaComponent[]> {
    const result = await this.getFileComponents(fileKey);
    return Object.values(result.meta.components);
  }

  async getLocalComponentSets(fileKey: string): Promise<FigmaComponentSet[]> {
    const result = await this.getFileComponentSets(fileKey);
    return Object.values(result.meta.component_sets);
  }

  // -- Styles --------------------------------------------------------------

  async getLocalStyles(fileKey: string): Promise<FigmaStyle[]> {
    const result = await this.getFileStyles(fileKey);
    return result.meta.styles;
  }

  // -- Users ---------------------------------------------------------------

  async getCurrentUser(): Promise<FigmaUser> {
    return this.get('/me');
  }

  async getTeamProjects(teamId: string): Promise<{ projects: { id: string; name: string }[] }> {
    return this.get(`/teams/${teamId}/projects`);
  }

  async getProjectFiles(projectId: string): Promise<{ files: { key: string; name: string; lastModified: string }[] }> {
    return this.get(`/projects/${projectId}/files`);
  }

  // -- Webhooks ------------------------------------------------------------

  async createWebhook(options: {
    event_type: string;
    team_id: string;
    endpoint: string;
    passcode: string;
    description?: string;
  }): Promise<{ id: string; team_id: string; event_type: string; endpoint: string; passcode: string; status: string; description: string }> {
    return this.post('/webhooks', options);
  }

  async listWebhooks(teamId: string): Promise<{ webhooks: { id: string; event_type: string; endpoint: string; status: string }[] }> {
    return this.get(`/teams/${teamId}/webhooks`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.delete(`/webhooks/${webhookId}`);
  }

  async getWebhook(webhookId: string): Promise<{ id: string; event_type: string; endpoint: string; status: string }> {
    return this.get(`/webhooks/${webhookId}`);
  }

  // -- Webhook Verification ------------------------------------------------

  verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  // -- Plugin Data ---------------------------------------------------------

  async getPluginData(fileKey: string, nodeIds: string[], pluginId: string): Promise<Record<string, Record<string, unknown>>> {
    return this.get(`/files/${fileKey}/plugin_data`, { ids: nodeIds.join(','), plugin_id: pluginId });
  }

  async setPluginData(fileKey: string, nodeId: string, pluginId: string, data: Record<string, unknown>): Promise<void> {
    await this.request({
      method: 'POST' as any,
      url: `/files/${fileKey}/plugin_data`,
      body: { plugin_id: pluginId, node_id: nodeId, data },
    });
  }

  // -- Node Utilities ------------------------------------------------------

  getNodeById(file: FigmaFile, nodeId: string): FigmaNode | null {
    const search = (nodes: FigmaNode[]): FigmaNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    for (const page of file.pages) {
      if (page.id === nodeId) return page;
      const found = search(page.children || []);
      if (found) return found;
    }
    return null;
  }

  getNodeByName(file: FigmaFile, name: string): FigmaNode | null {
    const search = (nodes: FigmaNode[]): FigmaNode | null => {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    for (const page of file.pages) {
      if (page.name === name) return page;
      const found = search(page.children || []);
      if (found) return found;
    }
    return null;
  }

  getNodesByType(file: FigmaFile, type: string): FigmaNode[] {
    const results: FigmaNode[] = [];
    const search = (nodes: FigmaNode[]) => {
      for (const node of nodes) {
        if (node.type === type) results.push(node);
        if (node.children) search(node.children);
      }
    };
    for (const page of file.pages) search(page.children || []);
    return results;
  }

  flattenNodes(node: FigmaNode): FigmaNode[] {
    const flat: FigmaNode[] = [node];
    if (node.children) {
      for (const child of node.children) {
        flat.push(...this.flattenNodes(child));
      }
    }
    return flat;
  }

  getBoundingBox(node: FigmaNode): { x: number; y: number; width: number; height: number } | null {
    return node.absoluteBoundingBox || null;
  }

  // -- Design Token Extraction ---------------------------------------------

  extractColors(file: FigmaFile): string[] {
    const colors = new Set<string>();
    const extractFromNode = (node: FigmaNode) => {
      if (node.fills) {
        for (const fill of node.fills) {
          if (fill.color) {
            const { r, g, b, a } = fill.color;
            const hex = `#${[r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
            colors.add(hex);
          }
        }
      }
      if (node.children) node.children.forEach(extractFromNode);
    };
    for (const page of file.pages) page.children?.forEach(extractFromNode);
    return Array.from(colors);
  }

  extractTextStyles(file: FigmaFile): { fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number }[] {
    const styles = new Map<string, { fontFamily: string; fontSize: number; fontWeight: number; lineHeight: number }>();
    const extractFromNode = (node: FigmaNode) => {
      if (node.type === 'TEXT' && node.style) {
        const key = `${node.style.fontFamily}-${node.style.fontSize}-${node.style.fontWeight}`;
        styles.set(key, {
          fontFamily: node.style.fontFamily || '',
          fontSize: node.style.fontSize || 16,
          fontWeight: node.style.fontWeight || 400,
          lineHeight: node.style.lineHeightPx || 0,
        });
      }
      if (node.children) node.children.forEach(extractFromNode);
    };
    for (const page of file.pages) page.children?.forEach(extractFromNode);
    return Array.from(styles.values());
  }

  extractSpacing(file: FigmaFile): number[] {
    const spacings = new Set<number>();
    const extractFromNode = (node: FigmaNode) => {
      if (node.itemSpacing) spacings.add(node.itemSpacing);
      if (node.paddingLeft) spacings.add(node.paddingLeft);
      if (node.children) node.children.forEach(extractFromNode);
    };
    for (const page of file.pages) page.children?.forEach(extractFromNode);
    return Array.from(spacings).sort((a, b) => a - b);
  }
}
