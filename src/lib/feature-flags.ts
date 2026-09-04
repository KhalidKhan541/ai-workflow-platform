// Feature flags system with user targeting and percentage rollouts

import { generateId, simpleHash } from './utils';
import { cache } from './cache';

// ─── Types ───────────────────────────────────────────────
export type FlagValue = boolean | string | number;

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  defaultValue: FlagValue;
  rules?: TargetingRule[];
  variants?: ABTestVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetingRule {
  id: string;
  attribute: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'gt' | 'lt' | 'regex';
  value: unknown;
  percentage?: number;
  variant?: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  value: FlagValue;
  weight: number;
}

export interface FlagContext {
  userId?: string;
  orgId?: string;
  email?: string;
  attributes?: Record<string, unknown>;
}

export interface FlagEvaluation {
  flag: string;
  value: FlagValue;
  reason: string;
  variant?: string;
}

// ─── Feature Flags Service ───────────────────────────────
class FeatureFlagsService {
  private flags = new Map<string, FeatureFlag>();
  private overrides = new Map<string, Map<string, FlagValue>>();

  registerFlag(flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): FeatureFlag {
    const existing = this.flags.get(flag.key);
    if (existing) {
      const updated: FeatureFlag = { ...existing, ...flag, updatedAt: new Date() };
      this.flags.set(flag.key, updated);
      return updated;
    }

    const newFlag: FeatureFlag = {
      ...flag,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.flags.set(flag.key, newFlag);
    return newFlag;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  setFlag(key: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(key);
    if (flag) {
      this.flags.set(key, { ...flag, ...updates, updatedAt: new Date() });
    }
  }

  deleteFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  listFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  // ─── Flag Evaluation ───────────────────────────────────
  evaluate(key: string, context: FlagContext = {}): FlagEvaluation {
    const flag = this.flags.get(key);

    // Check override
    const override = this.overrides.get(context.userId || '')?.get(key);
    if (override !== undefined) {
      return { flag: key, value: override, reason: 'override' };
    }

    if (!flag) {
      return { flag: key, value: false, reason: 'not_found' };
    }

    if (!flag.enabled) {
      return { flag: key, value: flag.defaultValue, reason: 'disabled' };
    }

    // Check targeting rules
    if (flag.rules && context.userId) {
      for (const rule of flag.rules) {
        if (this.matchRule(rule, context)) {
          if (rule.percentage !== undefined) {
            const hash = simpleHash(`${context.userId}:${key}`);
            const normalized = hash % 1000 / 1000;
            if (normalized * 100 < rule.percentage) {
              return { flag: key, value: rule.variant ? this.getVariantValue(flag, rule.variant) : flag.defaultValue, reason: 'rule_match_percentage', variant: rule.variant };
            }
          } else {
            return { flag: key, value: rule.variant ? this.getVariantValue(flag, rule.variant) : flag.defaultValue, reason: 'rule_match', variant: rule.variant };
          }
        }
      }
    }

    // Check percentage rollout
    if (context.userId) {
      const hash = simpleHash(`${context.userId}:${key}`);
      const normalized = hash % 1000 / 1000;
      return { flag: key, value: flag.defaultValue, reason: 'default', variant: undefined };
    }

    return { flag: key, value: flag.defaultValue, reason: 'default' };
  }

  isEnabled(key: string, context?: FlagContext): boolean {
    const result = this.evaluate(key, context);
    return result.value === true || result.value === 'true';
  }

  getVariant(key: string, context?: FlagContext): string | undefined {
    const flag = this.flags.get(key);
    if (!flag?.variants?.length || !context?.userId) return undefined;

    const hash = simpleHash(`${context.userId}:${key}:variant`);
    const normalized = hash % 1000 / 1000;

    let cumulative = 0;
    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (normalized < cumulative) return variant.id;
    }

    return flag.variants[0].id;
  }

  // ─── User Targeting ────────────────────────────────────
  private matchRule(rule: TargetingRule, context: FlagContext): boolean {
    let attributeValue: unknown;

    if (rule.attribute === 'userId') attributeValue = context.userId;
    else if (rule.attribute === 'orgId') attributeValue = context.orgId;
    else if (rule.attribute === 'email') attributeValue = context.email;
    else attributeValue = context.attributes?.[rule.attribute];

    if (attributeValue === undefined) return false;

    switch (rule.operator) {
      case 'eq': return attributeValue === rule.value;
      case 'neq': return attributeValue !== rule.value;
      case 'in': return Array.isArray(rule.value) && rule.value.includes(attributeValue);
      case 'nin': return Array.isArray(rule.value) && !rule.value.includes(attributeValue);
      case 'contains': return String(attributeValue).includes(String(rule.value));
      case 'gt': return Number(attributeValue) > Number(rule.value);
      case 'lt': return Number(attributeValue) < Number(rule.value);
      case 'regex': return new RegExp(String(rule.value)).test(String(attributeValue));
      default: return false;
    }
  }

  private getVariantValue(flag: FeatureFlag, variantId: string): FlagValue {
    const variant = flag.variants?.find((v) => v.id === variantId);
    return variant?.value ?? flag.defaultValue;
  }

  // ─── Overrides ─────────────────────────────────────────
  setOverride(userId: string, flagKey: string, value: FlagValue): void {
    if (!this.overrides.has(userId)) {
      this.overrides.set(userId, new Map());
    }
    this.overrides.get(userId)!.set(flagKey, value);
  }

  clearOverride(userId: string, flagKey: string): void {
    this.overrides.get(userId)?.delete(flagKey);
  }

  clearAllOverrides(userId: string): void {
    this.overrides.delete(userId);
  }

  // ─── Bulk Evaluation ───────────────────────────────────
  evaluateAll(context: FlagContext = {}): Record<string, FlagEvaluation> {
    const results: Record<string, FlagEvaluation> = {};
    for (const flag of this.flags.values()) {
      results[flag.key] = this.evaluate(flag.key, context);
    }
    return results;
  }
}

// ─── Singleton ───────────────────────────────────────────
const globalFlags = globalThis as unknown as { __featureFlags?: FeatureFlagsService };
export const featureFlags = globalFlags.__featureFlags || new FeatureFlagsService();
if (process.env.NODE_ENV !== 'production') {
  globalFlags.__featureFlags = featureFlags;
}

// ─── Convenience Functions ───────────────────────────────
export function isFeatureEnabled(key: string, context?: FlagContext): boolean {
  return featureFlags.isEnabled(key, context);
}

export function getFeatureVariant(key: string, context?: FlagContext): string | undefined {
  return featureFlags.getVariant(key, context);
}

export function evaluateFlags(context?: FlagContext): Record<string, FlagEvaluation> {
  return featureFlags.evaluateAll(context);
}
