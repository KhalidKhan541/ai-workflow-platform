// Analytics and event tracking utilities

import { generateId } from './utils';
import { cache } from './cache';

// ─── Types ───────────────────────────────────────────────
export interface AnalyticsEvent {
  id: string;
  event: string;
  userId?: string;
  orgId?: string;
  properties?: Record<string, unknown>;
  timestamp: Date;
  source?: string;
  sessionId?: string;
}

export interface FunnelStep {
  name: string;
  event: string;
  filter?: Record<string, unknown>;
}

export interface FunnelResult {
  steps: Array<{
    name: string;
    event: string;
    count: number;
    conversionRate: number;
    dropoffRate: number;
  }>;
  totalConversion: number;
}

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number;
}

export interface ABTestResult {
  testId: string;
  variant: string;
  userId: string;
}

export interface MetricsAggregation {
  metric: string;
  value: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

// ─── Event Tracking ──────────────────────────────────────
class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private abTests = new Map<string, { variants: ABTestVariant[]; assignments: Map<string, string> }>();

  async track(event: string, properties?: Record<string, unknown>, options?: { userId?: string; orgId?: string; source?: string; sessionId?: string }): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      id: generateId(),
      event,
      userId: options?.userId,
      orgId: options?.orgId,
      properties,
      timestamp: new Date(),
      source: options?.source,
      sessionId: options?.sessionId,
    };

    this.events.push(analyticsEvent);

    // In production, send to analytics pipeline
    console.log(`[Analytics] ${event}`, properties);
  }

  async trackPageView(page: string, userId?: string): Promise<void> {
    await this.track('page_view', { page }, { userId });
  }

  async trackAction(action: string, category: string, label?: string, value?: number, userId?: string): Promise<void> {
    await this.track('action', { action, category, label, value }, { userId });
  }

  async trackError(error: Error, context?: Record<string, unknown>, userId?: string): Promise<void> {
    await this.track('error', { message: error.message, stack: error.stack, ...context }, { userId });
  }

  getEvents(options?: { event?: string; userId?: string; orgId?: string; since?: Date; limit?: number }): AnalyticsEvent[] {
    let filtered = this.events;

    if (options?.event) filtered = filtered.filter((e) => e.event === options.event);
    if (options?.userId) filtered = filtered.filter((e) => e.userId === options.userId);
    if (options?.orgId) filtered = filtered.filter((e) => e.orgId === options.orgId);
    if (options?.since) filtered = filtered.filter((e) => e.timestamp >= options.since!);
    if (options?.limit) filtered = filtered.slice(-options.limit);

    return filtered;
  }

  // ─── User Activity Logging ─────────────────────────────
  async logActivity(userId: string, action: string, resource: string, resourceId?: string, details?: Record<string, unknown>): Promise<void> {
    await this.track('activity', { action, resource, resourceId, ...details }, { userId });
  }

  async getUserActivity(userId: string, options?: { since?: Date; limit?: number }): Promise<AnalyticsEvent[]> {
    return this.getEvents({ userId, since: options?.since, limit: options?.limit });
  }

  // ─── Funnel Analysis ───────────────────────────────────
  async analyzeFunnel(
    funnel: FunnelStep[],
    options?: { userId?: string; orgId?: string; startDate?: Date; endDate?: Date }
  ): Promise<FunnelResult> {
    const steps: FunnelResult['steps'] = [];
    let previousCount = 0;

    for (let i = 0; i < funnel.length; i++) {
      const step = funnel[i];
      let count = this.events.filter((e) => {
        if (e.event !== step.event) return false;
        if (options?.userId && e.userId !== options.userId) return false;
        if (options?.orgId && e.orgId !== options.orgId) return false;
        if (options?.startDate && e.timestamp < options.startDate) return false;
        if (options?.endDate && e.timestamp > options.endDate) return false;
        if (step.filter) {
          for (const [key, value] of Object.entries(step.filter)) {
            if (e.properties?.[key] !== value) return false;
          }
        }
        return true;
      }).length;

      const conversionRate = previousCount > 0 ? count / previousCount : i === 0 ? 1 : 0;
      const dropoffRate = 1 - conversionRate;

      steps.push({ name: step.name, event: step.event, count, conversionRate, dropoffRate });
      previousCount = count;
    }

    const totalConversion = steps.length > 0 ? steps[steps.length - 1].count / (steps[0].count || 1) : 0;

    return { steps, totalConversion };
  }

  // ─── A/B Testing ───────────────────────────────────────
  createABTest(testId: string, variants: ABTestVariant[]): void {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error('Variant weights must sum to 1');
    }
    this.abTests.set(testId, { variants, assignments: new Map() });
  }

  assignVariant(testId: string, userId: string): string {
    const test = this.abTests.get(testId);
    if (!test) throw new Error(`A/B test '${testId}' not found`);

    const existing = test.assignments.get(userId);
    if (existing) return existing;

    // Deterministic assignment based on userId hash
    const hash = simpleHash(userId + testId);
    const normalized = hash % 1000 / 1000;

    let cumulative = 0;
    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (normalized < cumulative) {
        test.assignments.set(userId, variant.id);
        return variant.id;
      }
    }

    return test.variants[0].id;
  }

  getABTestResults(testId: string): Record<string, { assignments: number; conversions: number }> {
    const test = this.abTests.get(testId);
    if (!test) return {};

    const results: Record<string, { assignments: number; conversions: number }> = {};
    for (const variant of test.variants) {
      const assignments = Array.from(test.assignments.values()).filter((v) => v === variant.id).length;
      const conversions = this.events.filter((e) => e.event === `ab_test_${testId}_convert` && test.assignments.get(e.userId || '') === variant.id).length;
      results[variant.id] = { assignments, conversions };
    }

    return results;
  }

  // ─── Metrics Aggregation ───────────────────────────────
  aggregateMetric(metric: string, values: number[]): MetricsAggregation {
    if (values.length === 0) {
      return { metric, value: 0, count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      metric,
      value: sum,
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  async getMetricsAggregation(metric: string, options?: { since?: Date; userId?: string }): Promise<MetricsAggregation> {
    const events = this.getEvents({ event: metric, since: options?.since, userId: options?.userId });
    const values = events.map((e) => (e.properties?.value as number) || 0);
    return this.aggregateMetric(metric, values);
  }
}

// ─── Helpers ─────────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Singleton ───────────────────────────────────────────
const globalAnalytics = globalThis as unknown as { __analyticsService?: AnalyticsService };
export const analytics = globalAnalytics.__analyticsService || new AnalyticsService();
if (process.env.NODE_ENV !== 'production') {
  globalAnalytics.__analyticsService = analytics;
}

// ─── Convenience Functions ───────────────────────────────
export async function trackEvent(event: string, properties?: Record<string, unknown>, userId?: string): Promise<void> {
  return analytics.track(event, properties, { userId });
}

export async function trackPageView(page: string, userId?: string): Promise<void> {
  return analytics.trackPageView(page, userId);
}
