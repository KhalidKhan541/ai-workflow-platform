// Email service with template engine and retry logic

import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  tracking?: { opens?: boolean; clicks?: boolean };
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface EmailResult {
  id: string;
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface BulkEmailOptions {
  emails: EmailOptions[];
  batchSize?: number;
  delayBetweenBatches?: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
  variables: string[];
}

export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  from?: string;
  maxRetries?: number;
  retryDelay?: number;
}

// ─── Template Engine ─────────────────────────────────────
const templates = new Map<string, EmailTemplate>();

export function registerTemplate(template: EmailTemplate): void {
  templates.set(template.name, template);
}

export function getTemplate(name: string): EmailTemplate | undefined {
  return templates.get(name);
}

export function renderTemplate(templateName: string, data: Record<string, unknown>): {
  subject: string;
  html: string;
  text?: string;
} {
  const template = templates.get(templateName);
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  const interpolate = (str: string) =>
    str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
      const keys = path.split('.');
      let value: unknown = data;
      for (const key of keys) {
        value = (value as Record<string, unknown>)?.[key];
        if (value === undefined) return `{{${path}}}`;
      }
      return String(value);
    });

  return {
    subject: interpolate(template.subject),
    html: interpolate(template.html),
    text: template.text ? interpolate(template.text) : undefined,
  };
}

// ─── Email Sender (In-Memory Implementation) ─────────────
class EmailService {
  private config: EmailConfig;
  private sentEmails: Array<{ id: string; options: EmailOptions; timestamp: Date }> = [];
  private unsubscribed = new Set<string>();

  constructor(config?: EmailConfig) {
    this.config = {
      host: config?.host || process.env.SMTP_HOST || 'localhost',
      port: config?.port || parseInt(process.env.SMTP_PORT || '587'),
      secure: config?.secure ?? false,
      auth: config?.auth || (process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! } : undefined),
      from: config?.from || process.env.EMAIL_FROM || 'noreply@workflow.io',
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000,
    };
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const id = generateId();
    const retries = this.config.maxRetries || 3;

    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const from = options.from || this.config.from!;

    // Check unsubscribe list
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const filteredRecipients = recipients.filter((r) => !this.unsubscribed.has(r.toLowerCase()));

    if (filteredRecipients.length === 0) {
      return { id, success: false, error: 'All recipients unsubscribed', timestamp: new Date() };
    }

    // Render template if provided
    let { subject, html, text } = options;
    if (options.template && options.templateData) {
      const rendered = renderTemplate(options.template, options.templateData);
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    // Retry logic
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // In production, this would use Nodemailer
        // For now, we simulate sending
        const messageId = `<${id}@workflow.io>`;

        this.sentEmails.push({ id, options, timestamp: new Date() });

        // Track for analytics
        if (options.tracking?.opens) {
          this.trackOpen(id);
        }
        if (options.tracking?.clicks) {
          this.trackClick(id);
        }

        return { id, success: true, messageId, timestamp: new Date() };
      } catch (error) {
        if (attempt === retries - 1) {
          return {
            id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          };
        }
        await new Promise((r) => setTimeout(r, (this.config.retryDelay || 1000) * (attempt + 1)));
      }
    }

    return { id, success: false, error: 'Max retries exceeded', timestamp: new Date() };
  }

  async sendBulk(options: BulkEmailOptions): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    const { emails, batchSize = 50, delayBetweenBatches = 1000, onProgress } = options;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((email) => this.send(email)));
      results.push(...batchResults);

      onProgress?.(Math.min(i + batchSize, emails.length), emails.length);

      if (i + batchSize < emails.length) {
        await new Promise((r) => setTimeout(r, delayBetweenBatches));
      }
    }

    return results;
  }

  async sendWithTemplate(
    to: string | string[],
    templateName: string,
    data: Record<string, unknown>,
    options?: Partial<EmailOptions>
  ): Promise<EmailResult> {
    const template = templates.get(templateName);
    if (!template) {
      return { id: generateId(), success: false, error: `Template '${templateName}' not found`, timestamp: new Date() };
    }

    return this.send({ to, template: templateName, templateData: data, ...options });
  }

  private trackOpen(id: string): void {
    // In production, this would create a tracking pixel
    console.log(`Email ${id} open tracking enabled`);
  }

  private trackClick(id: string): void {
    // In production, this would rewrite links for tracking
    console.log(`Email ${id} click tracking enabled`);
  }

  async unsubscribe(email: string): Promise<void> {
    this.unsubscribed.add(email.toLowerCase());
  }

  async isUnsubscribed(email: string): Promise<boolean> {
    return this.unsubscribed.has(email.toLowerCase());
  }

  getSentEmails(): Array<{ id: string; options: EmailOptions; timestamp: Date }> {
    return [...this.sentEmails];
  }
}

// ─── Singleton Email Service ─────────────────────────────
const globalEmail = globalThis as unknown as { __emailService?: EmailService };
export const emailService = globalEmail.__emailService || new EmailService();
if (process.env.NODE_ENV !== 'production') {
  globalEmail.__emailService = emailService;
}

// ─── Built-in Email Templates ────────────────────────────
registerTemplate({
  name: 'welcome',
  subject: 'Welcome to {{appName}}!',
  html: `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a;">Welcome, {{name}}!</h1>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Thank you for joining <strong>{{appName}}</strong>. We're excited to have you on board.
      </p>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Get started by creating your first workflow or exploring our templates.
      </p>
      <a href="{{dashboardUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Go to Dashboard
      </a>
    </body>
    </html>
  `,
  text: 'Welcome, {{name}}! Thank you for joining {{appName}}.',
  variables: ['name', 'appName', 'dashboardUrl'],
});

registerTemplate({
  name: 'email-verification',
  subject: 'Verify your email address',
  html: `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a;">Verify your email</h1>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Please use the following code to verify your email address:
      </p>
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">{{code}}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This code expires in {{expiresIn}} minutes.
      </p>
    </body>
    </html>
  `,
  text: 'Your verification code is: {{code}}',
  variables: ['code', 'expiresIn'],
});

registerTemplate({
  name: 'password-reset',
  subject: 'Reset your password',
  html: `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a;">Password Reset</h1>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Hi {{name}}, we received a request to reset your password.
      </p>
      <a href="{{resetUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #6b7280; font-size: 14px;">
        This link expires in {{expiresIn}} hours. If you didn't request this, please ignore this email.
      </p>
    </body>
    </html>
  `,
  text: 'Hi {{name}}, reset your password: {{resetUrl}}',
  variables: ['name', 'resetUrl', 'expiresIn'],
});

registerTemplate({
  name: 'notification',
  subject: '{{title}}',
  html: `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a;">{{title}}</h1>
      <div style="color: #4a4a4a; line-height: 1.6;">
        {{message}}
      </div>
      {{#if actionUrl}}
      <a href="{{actionUrl}}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        {{actionText}}
      </a>
      {{/if}}
    </body>
    </html>
  `,
  text: '{{title}}\n\n{{message}}',
  variables: ['title', 'message', 'actionUrl', 'actionText'],
});

// ─── Convenience Functions ───────────────────────────────
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  return emailService.send(options);
}

export async function sendBulkEmails(options: BulkEmailOptions): Promise<EmailResult[]> {
  return emailService.sendBulk(options);
}

export async function sendTemplatedEmail(
  to: string | string[],
  templateName: string,
  data: Record<string, unknown>,
  options?: Partial<EmailOptions>
): Promise<EmailResult> {
  return emailService.sendWithTemplate(to, templateName, data, options);
}

export { emailService as email };
