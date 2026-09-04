// Billing and subscription utilities with Stripe integration

import { generateId, formatDate } from './utils';

// ─── Types ───────────────────────────────────────────────
export type PlanInterval = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: PlanInterval;
  features: string[];
  limits: PlanLimits;
  stripePriceId: string;
}

export interface PlanLimits {
  workflows: number;
  executions: number;
  integrations: number;
  teamMembers: number;
  storage: number; // bytes
  apiCalls: number;
}

export interface Subscription {
  id: string;
  orgId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  trialEnd?: Date;
  stripeSubscriptionId: string;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void';
  dueDate: Date;
  paidAt?: Date;
  stripeInvoiceId: string;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metric: string;
  quantity: number;
  timestamp: Date;
}

export interface BillingEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  processedAt: Date;
}

// ─── Plans Configuration ─────────────────────────────────
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For individuals and small projects',
    price: 0,
    currency: 'USD',
    interval: 'monthly',
    features: ['5 workflows', '100 executions/month', '2 integrations', 'Community support'],
    limits: { workflows: 5, executions: 100, integrations: 2, teamMembers: 1, storage: 100 * 1024 * 1024, apiCalls: 1000 },
    stripePriceId: '',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For growing teams',
    price: 49,
    currency: 'USD',
    interval: 'monthly',
    features: ['Unlimited workflows', '10,000 executions/month', 'Unlimited integrations', 'Priority support'],
    limits: { workflows: -1, executions: 10000, integrations: -1, teamMembers: 10, storage: 5 * 1024 * 1024 * 1024, apiCalls: 100000 },
    stripePriceId: 'price_pro_monthly',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 199,
    currency: 'USD',
    interval: 'monthly',
    features: ['Everything in Pro', 'Unlimited executions', 'SSO & SAML', 'Dedicated support', 'SLA guarantee'],
    limits: { workflows: -1, executions: -1, integrations: -1, teamMembers: -1, storage: 50 * 1024 * 1024 * 1024, apiCalls: 1000000 },
    stripePriceId: 'price_enterprise_monthly',
  },
];

// ─── Stripe Integration (Stub) ───────────────────────────
class StripeService {
  private subscriptions = new Map<string, Subscription>();
  private invoices = new Map<string, Invoice>();
  private usageRecords: UsageRecord[] = [];

  async createCheckoutSession(orgId: string, planId: string): Promise<{ sessionId: string; url: string }> {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw new Error(`Plan '${planId}' not found`);

    const sessionId = `cs_${generateId()}`;
    // In production, use Stripe API
    return { sessionId, url: `https://checkout.stripe.com/pay/${sessionId}` };
  }

  async createSubscription(orgId: string, planId: string, stripeSubscriptionId?: string): Promise<Subscription> {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw new Error(`Plan '${planId}' not found`);

    const now = new Date();
    const subscription: Subscription = {
      id: generateId(),
      orgId,
      planId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      stripeSubscriptionId: stripeSubscriptionId || `sub_${generateId()}`,
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<Subscription> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    sub.status = 'canceled';
    sub.cancelAt = immediate ? new Date() : sub.currentPeriodEnd;

    this.subscriptions.set(subscriptionId, sub);
    return sub;
  }

  async changePlan(subscriptionId: string, newPlanId: string): Promise<Subscription> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const plan = PLANS.find((p) => p.id === newPlanId);
    if (!plan) throw new Error(`Plan '${newPlanId}' not found`);

    sub.planId = newPlanId;
    this.subscriptions.set(subscriptionId, sub);
    return sub;
  }

  async getSubscription(orgId: string): Promise<Subscription | null> {
    return Array.from(this.subscriptions.values()).find((s) => s.orgId === orgId) || null;
  }

  async recordUsage(subscriptionId: string, metric: string, quantity: number): Promise<UsageRecord> {
    const record: UsageRecord = {
      id: generateId(),
      subscriptionId,
      metric,
      quantity,
      timestamp: new Date(),
    };
    this.usageRecords.push(record);
    return record;
  }

  async getUsage(subscriptionId: string, metric: string, startDate: Date, endDate: Date): Promise<number> {
    return this.usageRecords
      .filter((r) => r.subscriptionId === subscriptionId && r.metric === metric && r.timestamp >= startDate && r.timestamp <= endDate)
      .reduce((sum, r) => sum + r.quantity, 0);
  }

  async getInvoices(subscriptionId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter((i) => i.subscriptionId === subscriptionId);
  }

  async generateInvoice(subscriptionId: string, amount: number): Promise<Invoice> {
    const invoice: Invoice = {
      id: generateId(),
      subscriptionId,
      amount,
      currency: 'USD',
      status: 'open',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      stripeInvoiceId: `in_${generateId()}`,
    };
    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  async handleWebhook(event: BillingEvent): Promise<void> {
    switch (event.type) {
      case 'invoice.paid': {
        const invoiceId = event.payload.invoiceId as string;
        const invoice = this.invoices.get(invoiceId);
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
        }
        break;
      }
      case 'subscription.updated': {
        const subId = event.payload.subscriptionId as string;
        const sub = this.subscriptions.get(subId);
        if (sub) {
          sub.status = event.payload.status as SubscriptionStatus;
        }
        break;
      }
    }
  }
}

// ─── Plan Limits Enforcement ─────────────────────────────
export function checkPlanLimits(
  subscription: Subscription | null,
  metric: keyof PlanLimits,
  currentUsage: number
): { allowed: boolean; limit: number; remaining: number } {
  if (!subscription) {
    const freePlan = PLANS.find((p) => p.id === 'free')!;
    const limit = freePlan.limits[metric];
    return { allowed: currentUsage < limit, limit, remaining: Math.max(0, limit - currentUsage) };
  }

  const plan = PLANS.find((p) => p.id === subscription.planId);
  if (!plan) return { allowed: false, limit: 0, remaining: 0 };

  const limit = plan.limits[metric];
  if (limit === -1) return { allowed: true, limit: -1, remaining: -1 };

  return { allowed: currentUsage < limit, limit, remaining: Math.max(0, limit - currentUsage) };
}

// ─── Singleton ───────────────────────────────────────────
const globalBilling = globalThis as unknown as { __stripeService?: StripeService };
export const stripeService = globalBilling.__stripeService || new StripeService();
if (process.env.NODE_ENV !== 'production') {
  globalBilling.__stripeService = stripeService;
}

// ─── Convenience Functions ───────────────────────────────
export function getPlan(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getPlans(): Plan[] {
  return [...PLANS];
}
