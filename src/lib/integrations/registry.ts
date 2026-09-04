// ============================================================================
// Integration Registry
// Register/unregister, category management, search/filter, capability matching
// ============================================================================

import { BaseIntegration, AuthType } from './base';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum IntegrationCategory {
  Communication = 'communication',
  CRM = 'crm',
  Productivity = 'productivity',
  DevOps = 'devops',
  Finance = 'finance',
  Storage = 'storage',
  AI = 'ai',
  Design = 'design',
  Scheduling = 'scheduling',
  Automation = 'automation',
  Analytics = 'analytics',
  Other = 'other',
}

export interface IntegrationMetadata {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  version: string;
  authType: AuthType;
  baseUrl: string;
  icon?: string;
  documentationUrl?: string;
  tags: string[];
  capabilities: string[];
}

export interface IntegrationInstance {
  id: string;
  metadata: IntegrationMetadata;
  integration: BaseIntegration;
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  config: Record<string, unknown>;
}

export interface IntegrationFilter {
  category?: IntegrationCategory;
  tags?: string[];
  capabilities?: string[];
  search?: string;
  authType?: AuthType;
}

export interface IntegrationSearchResult {
  total: number;
  results: IntegrationInstance[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class IntegrationRegistry {
  private static instance: IntegrationRegistry;
  private integrations: Map<string, IntegrationInstance> = new Map();
  private categories: Map<IntegrationCategory, Set<string>> = new Map();
  private tags: Map<string, Set<string>> = new Map();
  private capabilities: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): IntegrationRegistry {
    if (!IntegrationRegistry.instance) {
      IntegrationRegistry.instance = new IntegrationRegistry();
    }
    return IntegrationRegistry.instance;
  }

  // -- Registration --------------------------------------------------------

  register(
    metadata: IntegrationMetadata,
    integration: BaseIntegration,
    config: Record<string, unknown> = {},
  ): IntegrationInstance {
    if (this.integrations.has(metadata.id)) {
      throw new Error(`Integration '${metadata.id}' is already registered`);
    }

    const instance: IntegrationInstance = {
      id: metadata.id,
      metadata,
      integration,
      isActive: true,
      createdAt: new Date(),
      config,
    };

    this.integrations.set(metadata.id, instance);

    // Index by category
    if (!this.categories.has(metadata.category)) {
      this.categories.set(metadata.category, new Set());
    }
    this.categories.get(metadata.category)!.add(metadata.id);

    // Index by tags
    for (const tag of metadata.tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(metadata.id);
    }

    // Index by capabilities
    for (const capability of metadata.capabilities) {
      if (!this.capabilities.has(capability)) {
        this.capabilities.set(capability, new Set());
      }
      this.capabilities.get(capability)!.add(metadata.id);
    }

    return instance;
  }

  unregister(id: string): boolean {
    const instance = this.integrations.get(id);
    if (!instance) return false;

    // Remove from category index
    this.categories.get(instance.metadata.category)?.delete(id);

    // Remove from tags index
    for (const tag of instance.metadata.tags) {
      this.tags.get(tag)?.delete(id);
      if (this.tags.get(tag)?.size === 0) this.tags.delete(tag);
    }

    // Remove from capabilities index
    for (const cap of instance.metadata.capabilities) {
      this.capabilities.get(cap)?.delete(id);
      if (this.capabilities.get(cap)?.size === 0) this.capabilities.delete(cap);
    }

    this.integrations.delete(id);
    return true;
  }

  // -- Lookup --------------------------------------------------------------

  get(id: string): IntegrationInstance | undefined {
    return this.integrations.get(id);
  }

  has(id: string): boolean {
    return this.integrations.has(id);
  }

  getAll(): IntegrationInstance[] {
    return Array.from(this.integrations.values());
  }

  getActive(): IntegrationInstance[] {
    return this.getAll().filter(i => i.isActive);
  }

  // -- Category Management -------------------------------------------------

  getByCategory(category: IntegrationCategory): IntegrationInstance[] {
    const ids = this.categories.get(category) || new Set();
    return Array.from(ids)
      .map(id => this.integrations.get(id)!)
      .filter(Boolean);
  }

  getCategories(): IntegrationCategory[] {
    return Array.from(this.categories.keys());
  }

  getCategoryCount(category: IntegrationCategory): number {
    return this.categories.get(category)?.size || 0;
  }

  // -- Tag Management ------------------------------------------------------

  getByTag(tag: string): IntegrationInstance[] {
    const ids = this.tags.get(tag) || new Set();
    return Array.from(ids)
      .map(id => this.integrations.get(id)!)
      .filter(Boolean);
  }

  getTags(): string[] {
    return Array.from(this.tags.keys()).sort();
  }

  // -- Capability Matching -------------------------------------------------

  getByCapability(capability: string): IntegrationInstance[] {
    const ids = this.capabilities.get(capability) || new Set();
    return Array.from(ids)
      .map(id => this.integrations.get(id)!)
      .filter(Boolean);
  }

  getCapabilities(): string[] {
    return Array.from(this.capabilities.keys()).sort();
  }

  findIntegrationsWithCapabilities(required: string[]): IntegrationInstance[] {
    return this.getActive().filter(instance =>
      required.every(cap => instance.metadata.capabilities.includes(cap)),
    );
  }

  findBestIntegrationForCapabilities(required: string[]): IntegrationInstance | null {
    const candidates = this.findIntegrationsWithCapabilities(required);
    if (candidates.length === 0) return null;
    // Sort by most matching capabilities, then by fewest total capabilities (most specific)
    candidates.sort((a, b) => {
      const aScore = required.filter(c => a.metadata.capabilities.includes(c)).length;
      const bScore = required.filter(c => b.metadata.capabilities.includes(c)).length;
      if (bScore !== aScore) return bScore - aScore;
      return a.metadata.capabilities.length - b.metadata.capabilities.length;
    });
    return candidates[0];
  }

  // -- Search & Filtering --------------------------------------------------

  search(filter: IntegrationFilter = {}): IntegrationSearchResult {
    let results = this.getAll();

    if (filter.category) {
      results = results.filter(i => i.metadata.category === filter.category);
    }

    if (filter.authType) {
      results = results.filter(i => i.metadata.authType === filter.authType);
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(i =>
        filter.tags!.some(tag => i.metadata.tags.includes(tag)),
      );
    }

    if (filter.capabilities && filter.capabilities.length > 0) {
      results = results.filter(i =>
        filter.capabilities!.every(cap => i.metadata.capabilities.includes(cap)),
      );
    }

    if (filter.search) {
      const term = filter.search.toLowerCase();
      results = results.filter(
        i =>
          i.metadata.name.toLowerCase().includes(term) ||
          i.metadata.description.toLowerCase().includes(term) ||
          i.metadata.tags.some(t => t.toLowerCase().includes(term)),
      );
    }

    return { total: results.length, results };
  }

  // -- Lifecycle -----------------------------------------------------------

  async initializeAll(): Promise<void> {
    const active = this.getActive();
    await Promise.allSettled(active.map(i => i.integration.initialize()));
  }

  async disconnectAll(): Promise<void> {
    const active = this.getActive();
    await Promise.allSettled(active.map(i => i.integration.disconnect()));
  }

  setActive(id: string, active: boolean): void {
    const instance = this.integrations.get(id);
    if (instance) {
      instance.isActive = active;
    }
  }

  updateLastUsed(id: string): void {
    const instance = this.integrations.get(id);
    if (instance) {
      instance.lastUsedAt = new Date();
    }
  }

  // -- Stats ---------------------------------------------------------------

  getStats(): {
    total: number;
    active: number;
    byCategory: Record<string, number>;
    byAuthType: Record<string, number>;
  } {
    const all = this.getAll();
    const active = this.getActive();

    const byCategory: Record<string, number> = {};
    for (const cat of this.getCategories()) {
      byCategory[cat] = this.getCategoryCount(cat);
    }

    const byAuthType: Record<string, number> = {};
    for (const i of all) {
      byAuthType[i.metadata.authType] = (byAuthType[i.metadata.authType] || 0) + 1;
    }

    return { total: all.length, active: active.length, byCategory, byAuthType };
  }
}

export const registry = IntegrationRegistry.getInstance();
