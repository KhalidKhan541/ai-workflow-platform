import { BaseIntegration, AuthType, AuthType as AT } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StripeConfig {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
  apiVersion?: string;
}

export interface StripeCustomer {
  id: string;
  object: 'customer';
  name?: string;
  email?: string;
  phone?: string;
  description?: string;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  currency?: string;
  delinquent?: boolean;
  discount?: StripeDiscount | null;
}

export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  customer?: string;
  description?: string;
  metadata: Record<string, string>;
  payment_method?: string;
  payment_method_types: string[];
  client_secret: string;
  created: number;
  livemode: boolean;
  capture_method: string;
  confirmation_method: string;
  latest_charge?: string;
}

export interface StripeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
  items: {
    id: string;
    price: StripePrice;
    quantity: number;
  }[];
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
  created: number;
  metadata: Record<string, string>;
}

export interface StripePrice {
  id: string;
  object: 'price';
  unit_amount: number;
  currency: string;
  recurring?: { interval: string; interval_count: number };
  product?: string;
  active: boolean;
  metadata: Record<string, string>;
}

export interface StripeProduct {
  id: string;
  object: 'product';
  name: string;
  description?: string;
  active: boolean;
  metadata: Record<string, string>;
  images: string[];
  created: number;
  default_price?: string;
}

export interface StripeInvoice {
  id: string;
  object: 'invoice';
  customer: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  payment_intent?: string;
  subscription?: string;
  created: number;
  period_start: number;
  period_end: number;
  metadata: Record<string, string>;
}

export interface StripeCharge {
  id: string;
  object: 'charge';
  amount: number;
  currency: string;
  customer?: string;
  description?: string;
  paid: boolean;
  status: 'succeeded' | 'pending' | 'failed';
  receipt_url?: string;
  created: number;
}

export interface StripeDiscount {
  id: string;
  coupon: { id: string; amount_off?: number; percent_off?: number; duration: string };
  start: number;
  end?: number;
}

export interface StripeListResponse<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  url: string;
}

export interface StripeBalance {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
  connect_reserved: { amount: number; currency: string }[];
}

// ---------------------------------------------------------------------------
// Stripe Integration
// ---------------------------------------------------------------------------

export class StripeIntegration extends BaseIntegration {
  private config: StripeConfig;

  constructor(config: StripeConfig) {
    super('https://api.stripe.com/v1', config);
    this.config = config;
    this.rateLimitConfig = { maxRequests: 100, windowMs: 1000 };
  }

  protected determineAuthType(): AuthType {
    return AT.Bearer;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${this.config.secretKey}` };
  }

  getCapabilities(): string[] {
    return [
      'customers.create',
      'customers.read',
      'customers.update',
      'customers.delete',
      'payment_intents.create',
      'payment_intents.read',
      'payment_intents.update',
      'subscriptions.create',
      'subscriptions.read',
      'subscriptions.update',
      'subscriptions.cancel',
      'invoices.read',
      'invoices.create',
      'invoices.finalize',
      'products.create',
      'products.read',
      'products.update',
      'prices.create',
      'prices.read',
      'charges.read',
      'refunds.create',
      'balance.read',
      'webhooks',
    ];
  }

  // -- Customers -----------------------------------------------------------

  async createCustomer(data: {
    name?: string;
    email?: string;
    phone?: string;
    description?: string;
    metadata?: Record<string, string>;
    address?: Record<string, string>;
    payment_method?: string;
    invoice_settings?: { default_payment_method?: string };
  }): Promise<StripeCustomer> {
    return this.post('/customers', this.formEncode(data));
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    return this.get(`/customers/${customerId}`);
  }

  async listCustomers(params?: {
    email?: string;
    created?: { gt?: number; gte?: number; lt?: number; lte?: number };
    limit?: number;
    starting_after?: string;
  }): Promise<StripeListResponse<StripeCustomer>> {
    return this.get('/customers', this.formEncode(params || {}));
  }

  async updateCustomer(customerId: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    description?: string;
    metadata?: Record<string, string>;
    address?: Record<string, string>;
  }): Promise<StripeCustomer> {
    return this.post(`/customers/${customerId}`, this.formEncode(data));
  }

  async deleteCustomer(customerId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.delete(`/customers/${customerId}`);
  }

  async searchCustomers(query: string, limit: number = 10): Promise<StripeListResponse<StripeCustomer>> {
    return this.get('/customers/search', { query, limit });
  }

  // -- Payment Intents -----------------------------------------------------

  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    customer?: string;
    description?: string;
    metadata?: Record<string, string>;
    payment_method_types?: string[];
    receipt_email?: string;
    setup_future_usage?: 'off_session' | 'on_session';
    automatic_payment_methods?: { enabled: boolean };
    confirm?: boolean;
    payment_method?: string;
    return_url?: string;
  }): Promise<StripePaymentIntent> {
    return this.post('/payment_intents', this.formEncode(data));
  }

  async getPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent> {
    return this.get(`/payment_intents/${paymentIntentId}`);
  }

  async listPaymentIntents(params?: {
    customer?: string;
    created?: { gt?: number; gte?: number };
    limit?: number;
    starting_after?: string;
  }): Promise<StripeListResponse<StripePaymentIntent>> {
    return this.get('/payment_intents', this.formEncode(params || {}));
  }

  async confirmPaymentIntent(paymentIntentId: string, data?: {
    payment_method?: string;
    return_url?: string;
  }): Promise<StripePaymentIntent> {
    return this.post(`/payment_intents/${paymentIntentId}/confirm`, this.formEncode(data || {}));
  }

  async capturePaymentIntent(paymentIntentId: string, data?: { amount_to_capture?: number }): Promise<StripePaymentIntent> {
    return this.post(`/payment_intents/${paymentIntentId}/capture`, this.formEncode(data || {}));
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent> {
    return this.post(`/payment_intents/${paymentIntentId}/cancel`);
  }

  // -- Subscriptions -------------------------------------------------------

  async createSubscription(data: {
    customer: string;
    items: { price?: string; price_data?: Record<string, unknown>; quantity?: number }[];
    trial_period_days?: number;
    metadata?: Record<string, string>;
    cancel_at_period_end?: boolean;
    payment_behavior?: string;
    proration_behavior?: string;
  }): Promise<StripeSubscription> {
    return this.post('/subscriptions', this.formEncode(data));
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return this.get(`/subscriptions/${subscriptionId}`);
  }

  async listSubscriptions(params?: {
    customer?: string;
    status?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<StripeListResponse<StripeSubscription>> {
    return this.get('/subscriptions', this.formEncode(params || {}));
  }

  async updateSubscription(subscriptionId: string, data: {
    items?: { id?: string; deleted?: boolean; price?: string; quantity?: number }[];
    metadata?: Record<string, string>;
    cancel_at_period_end?: boolean;
    proration_behavior?: string;
  }): Promise<StripeSubscription> {
    return this.post(`/subscriptions/${subscriptionId}`, this.formEncode(data));
  }

  async cancelSubscription(subscriptionId: string, params?: { invoice_now?: boolean; prorate?: boolean }): Promise<StripeSubscription> {
    return this.del(`/subscriptions/${subscriptionId}`, this.formEncode(params || {}));
  }

  async resumeSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return this.post(`/subscriptions/${subscriptionId}/resume`);
  }

  // -- Invoices ------------------------------------------------------------

  async getInvoice(invoiceId: string): Promise<StripeInvoice> {
    return this.get(`/invoices/${invoiceId}`);
  }

  async listInvoices(params?: {
    customer?: string;
    subscription?: string;
    status?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<StripeListResponse<StripeInvoice>> {
    return this.get('/invoices', this.formEncode(params || {}));
  }

  async createInvoice(data: { customer: string; description?: string; metadata?: Record<string, string> }): Promise<StripeInvoice> {
    return this.post('/invoices', this.formEncode(data));
  }

  async finalizeInvoice(invoiceId: string): Promise<StripeInvoice> {
    return this.post(`/invoices/${invoiceId}/finalize`);
  }

  async payInvoice(invoiceId: string): Promise<StripeInvoice> {
    return this.post(`/invoices/${invoiceId}/pay`);
  }

  async voidInvoice(invoiceId: string): Promise<StripeInvoice> {
    return this.post(`/invoices/${invoiceId}/void`);
  }

  // -- Products & Prices ---------------------------------------------------

  async createProduct(data: { name: string; description?: string; active?: boolean; metadata?: Record<string, string>; images?: string[] }): Promise<StripeProduct> {
    return this.post('/products', this.formEncode(data));
  }

  async getProduct(productId: string): Promise<StripeProduct> {
    return this.get(`/products/${productId}`);
  }

  async listProducts(params?: { active?: boolean; limit?: number; starting_after?: string }): Promise<StripeListResponse<StripeProduct>> {
    return this.get('/products', this.formEncode(params || {}));
  }

  async updateProduct(productId: string, data: { name?: string; description?: string; active?: boolean; metadata?: Record<string, string> }): Promise<StripeProduct> {
    return this.post(`/products/${productId}`, this.formEncode(data));
  }

  async createPrice(data: {
    product: string;
    unit_amount: number;
    currency: string;
    recurring?: { interval: string; interval_count?: number };
    metadata?: Record<string, string>;
  }): Promise<StripePrice> {
    return this.post('/prices', this.formEncode(data));
  }

  async listPrices(params?: { product?: string; active?: boolean; limit?: number }): Promise<StripeListResponse<StripePrice>> {
    return this.get('/prices', this.formEncode(params || {}));
  }

  // -- Charges & Refunds ---------------------------------------------------

  async getCharge(chargeId: string): Promise<StripeCharge> {
    return this.get(`/charges/${chargeId}`);
  }

  async listCharges(params?: { customer?: string; created?: { gt?: number }; limit?: number }): Promise<StripeListResponse<StripeCharge>> {
    return this.get('/charges', this.formEncode(params || {}));
  }

  async createRefund(data: { charge: string; amount?: number; reason?: string }): Promise<{ id: string; amount: number; status: string }> {
    return this.post('/refunds', this.formEncode(data));
  }

  // -- Balance -------------------------------------------------------------

  async getBalance(): Promise<StripeBalance> {
    return this.get('/balance');
  }

  // -- Checkout Sessions ---------------------------------------------------

  async createCheckoutSession(data: {
    line_items?: { price: string; quantity: number }[];
    mode: 'payment' | 'subscription' | 'setup';
    success_url: string;
    cancel_url: string;
    customer?: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string; url: string }> {
    return this.post('/checkout/sessions', this.formEncode(data));
  }

  // -- Webhooks ------------------------------------------------------------

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) return false;
    const crypto = require('crypto');
    const elements = signature.split(',').reduce((acc: Record<string, string>, item) => {
      const [key, value] = item.split('=');
      acc[key] = value;
      return acc;
    }, {});
    const timestamp = elements['t'];
    const expectedSignature = elements['v1'];
    const signedPayload = `${timestamp}.${payload}`;
    const computed = crypto.createHmac('sha256', this.config.webhookSecret).update(signedPayload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedSignature));
  }

  // -- Helpers -------------------------------------------------------------

  private formEncode(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;
      if (value === null || value === undefined) continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.formEncode(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            Object.assign(result, this.formEncode(item as Record<string, unknown>, `${fullKey}[${index}]`));
          } else {
            result[`${fullKey}[${index}]`] = String(item);
          }
        });
      } else {
        result[fullKey] = String(value);
      }
    }
    return result;
  }

  private async del<T>(url: string, body?: Record<string, string>): Promise<T> {
    if (body) {
      return this.request<T>({ method: 'DELETE' as any, url, body: new URLSearchParams(body).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    }
    return this.request<T>({ method: 'DELETE' as any, url });
  }
}
