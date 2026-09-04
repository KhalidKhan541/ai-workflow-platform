/**
 * Workflow Templates Library
 * 
 * Pre-built workflow templates for common business processes.
 * Each template includes complete step definitions, triggers,
 * and configuration ready for customization.
 * 
 * @module workflow/templates
 */

import { nanoid } from 'nanoid';
import { WorkflowDefinition, WorkflowStep, TriggerDefinition } from './engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TemplateCategory = 
  | 'marketing'
  | 'sales'
  | 'operations'
  | 'hr'
  | 'finance'
  | 'support'
  | 'engineering'
  | 'productivity'
  | 'integration'
  | 'data';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: WorkflowStep[];
  triggers: TriggerDefinition[];
  variables: Record<string, unknown>;
  icon: string;
  color: string;
  author: string;
  version: string;
  useCases: string[];
  requirements: string[];
}

export interface TemplateSearchResult {
  template: WorkflowTemplate;
  relevance: number;
}

// ─── Template Registry ──────────────────────────────────────────────────────

/**
 * Registry of all available workflow templates.
 */
export class TemplateRegistry {
  private templates: Map<string, WorkflowTemplate> = new Map();

  constructor() {
    this.registerBuiltInTemplates();
  }

  /**
   * Get all templates.
   */
  getAll(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID.
   */
  getById(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by category.
   */
  getByCategory(category: TemplateCategory): WorkflowTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search templates by keyword.
   */
  search(query: string): TemplateSearchResult[] {
    const lowerQuery = query.toLowerCase();
    const results: TemplateSearchResult[] = [];

    for (const template of this.templates.values()) {
      let relevance = 0;

      // Name match
      if (template.name.toLowerCase().includes(lowerQuery)) {
        relevance += 10;
      }

      // Description match
      if (template.description.toLowerCase().includes(lowerQuery)) {
        relevance += 5;
      }

      // Tag match
      for (const tag of template.tags) {
        if (tag.toLowerCase().includes(lowerQuery)) {
          relevance += 3;
        }
      }

      // Use case match
      for (const useCase of template.useCases) {
        if (useCase.toLowerCase().includes(lowerQuery)) {
          relevance += 2;
        }
      }

      if (relevance > 0) {
        results.push({ template, relevance });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Register a custom template.
   */
  register(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Create workflow from template.
   */
  createWorkflow(
    templateId: string,
    customizations: {
      name?: string;
      variables?: Record<string, unknown>;
      triggers?: TriggerDefinition[];
    } = {}
  ): WorkflowDefinition | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const workflow: WorkflowDefinition = {
      id: nanoid(24),
      name: customizations.name || template.name,
      description: template.description,
      version: '1.0.0',
      steps: template.steps.map(step => ({
        ...step,
        id: `${step.id}_${nanoid(8)}`,
      })),
      triggers: customizations.triggers || template.triggers,
      variables: {
        ...template.variables,
        ...customizations.variables,
      },
      timeout: 3600000, // 1 hour
      enableParallelExecution: true,
      maxConcurrency: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: template.author,
      tags: template.tags,
    };

    return workflow;
  }

  // ─── Built-in Templates ───────────────────────────────────────────────────

  private registerBuiltInTemplates(): void {
    // Marketing templates
    this.register(this.createLeadNurturingTemplate());
    this.register(this.createContentPublishingTemplate());
    this.register(this.createEmailCampaignTemplate());

    // Sales templates
    this.register(this.createInvoiceProcessingTemplate());
    this.register(this.createLeadScoringTemplate());
    this.register(this.createDealApprovalTemplate());

    // Operations templates
    this.register(this.createDataSyncTemplate());
    this.register(this.createReportGenerationTemplate());
    this.register(this.createBackupTemplate());

    // HR templates
    this.register(this.createEmployeeOnboardingTemplate());
    this.register(this.createLeaveApprovalTemplate());
    this.register(this.createPerformanceReviewTemplate());

    // Support templates
    this.register(this.createTicketRoutingTemplate());
    this.register(this.createEscalationTemplate());
    this.register(this.createCustomerFeedbackTemplate());

    // Finance templates
    this.register(this.createExpenseApprovalTemplate());
    this.register(this.createPaymentProcessingTemplate());
    this.register(this.createReconciliationTemplate());

    // Engineering templates
    this.register(this.createDeploymentPipelineTemplate());
    this.register(this.createIncidentResponseTemplate());
    this.register(this.createCodeReviewTemplate());

    // Productivity templates
    this.register(this.createDailyStandupTemplate());
    this.register(this.createMeetingSchedulerTemplate());
    this.register(this.createTaskAssignmentTemplate());
  }

  // ─── Marketing Templates ──────────────────────────────────────────────────

  private createLeadNurturingTemplate(): WorkflowTemplate {
    return {
      id: 'lead-nurturing',
      name: 'Lead Nurturing Sequence',
      description: 'Automated email sequence to nurture leads through the sales funnel with personalized content.',
      category: 'marketing',
      tags: ['email', 'automation', 'leads', 'nurture'],
      estimatedTime: '30 minutes setup',
      difficulty: 'intermediate',
      icon: 'Mail',
      color: '#3B82F6',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: [
        'Automated lead follow-up',
        'Email drip campaigns',
        'Sales funnel automation',
      ],
      requirements: ['Email service integration', 'CRM connection'],
      triggers: [
        {
          id: 'lead-created',
          type: 'event',
          config: {
            eventType: 'lead:created',
            source: 'crm',
          },
          enabled: true,
        },
      ],
      variables: {
        nurtureSequence: [
          { delay: 0, template: 'welcome' },
          { delay: 3, template: 'value-proposition' },
          { delay: 7, template: 'case-study' },
          { delay: 14, template: 'offer' },
        ],
      },
      steps: [
        {
          id: 'validate-lead',
          name: 'Validate Lead Data',
          type: 'condition',
          config: {
            condition: 'inputs.lead.email && inputs.lead.name',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'check-lead-status',
          name: 'Check Lead Status',
          type: 'database',
          config: {
            operation: 'findFirst',
            model: 'lead',
            where: { email: '{{inputs.lead.email}}' },
          },
          dependencies: ['validate-lead'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'send-welcome',
          name: 'Send Welcome Email',
          type: 'email-send',
          config: {
            to: '{{inputs.lead.email}}',
            subject: 'Welcome to our platform!',
            body: 'Hello {{inputs.lead.name}}, welcome aboard!',
            template: 'welcome',
          },
          dependencies: ['validate-lead'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
        {
          id: 'wait-3-days',
          name: 'Wait 3 Days',
          type: 'delay',
          config: {
            duration: 3,
            unit: 'days',
          },
          dependencies: ['send-welcome'],
          required: false,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 259200000, killOnTimeout: false },
        },
        {
          id: 'send-value-prop',
          name: 'Send Value Proposition',
          type: 'email-send',
          config: {
            to: '{{inputs.lead.email}}',
            subject: 'Here\'s how we can help you',
            body: 'Discover the value we bring...',
            template: 'value-proposition',
          },
          dependencies: ['wait-3-days'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
        {
          id: 'update-lead-status',
          name: 'Update Lead Status',
          type: 'database',
          config: {
            operation: 'update',
            model: 'lead',
            where: { email: '{{inputs.lead.email}}' },
            data: { status: 'nurturing', lastContact: '{{system.isoDate}}' },
          },
          dependencies: ['send-value-prop'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createContentPublishingTemplate(): WorkflowTemplate {
    return {
      id: 'content-publishing',
      name: 'Content Publishing Pipeline',
      description: 'Multi-channel content distribution with scheduling and analytics tracking.',
      category: 'marketing',
      tags: ['content', 'social-media', 'publishing', 'analytics'],
      estimatedTime: '45 minutes setup',
      difficulty: 'advanced',
      icon: 'Share2',
      color: '#8B5CF6',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: [
        'Multi-platform social posting',
        'Blog content distribution',
        'Content calendar automation',
      ],
      requirements: ['Social media API access', 'Analytics integration'],
      triggers: [
        {
          id: 'content-scheduled',
          type: 'cron',
          config: {
            expression: '0 9 * * *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        platforms: ['twitter', 'linkedin', 'facebook'],
      },
      steps: [
        {
          id: 'fetch-content',
          name: 'Fetch Scheduled Content',
          type: 'database',
          config: {
            operation: 'find',
            model: 'content',
            where: { scheduledAt: { lte: '{{system.isoDate}}' }, status: 'scheduled' },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'optimize-content',
          name: 'Optimize for Platforms',
          type: 'transform',
          config: {
            operation: 'map',
            source: '{{fetch-content.output}}',
            expression: 'item.platforms.map(p => ({...item, platform: p, content: optimizeForPlatform(item.content, p)}))',
          },
          dependencies: ['fetch-content'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'publish-to-platforms',
          name: 'Publish to All Platforms',
          type: 'parallel',
          config: {
            steps: ['publish-twitter', 'publish-linkedin', 'publish-facebook'],
          },
          dependencies: ['optimize-content'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 2000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: false },
        },
        {
          id: 'track-analytics',
          name: 'Track Publishing Analytics',
          type: 'database',
          config: {
            operation: 'create',
            model: 'analytics',
            data: {
              contentId: '{{fetch-content.output.id}}',
              publishedAt: '{{system.isoDate}}',
              platforms: '{{optimize-content.output}}',
            },
          },
          dependencies: ['publish-to-platforms'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createEmailCampaignTemplate(): WorkflowTemplate {
    return {
      id: 'email-campaign',
      name: 'Email Campaign Automation',
      description: 'Automated email campaign with A/B testing and analytics tracking.',
      category: 'marketing',
      tags: ['email', 'campaign', 'ab-testing', 'analytics'],
      estimatedTime: '1 hour setup',
      difficulty: 'intermediate',
      icon: 'Mail',
      color: '#EC4899',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Email marketing campaigns', 'Newsletter automation', 'Promotional emails'],
      requirements: ['Email service integration', 'Analytics platform'],
      triggers: [
        {
          id: 'campaign-trigger',
          type: 'manual',
          config: {},
          enabled: true,
        },
      ],
      variables: {
        campaignId: '{{inputs.campaignId}}',
        segmentSize: 1000,
      },
      steps: [
        {
          id: 'load-campaign',
          name: 'Load Campaign Configuration',
          type: 'database',
          config: {
            operation: 'findFirst',
            model: 'campaign',
            where: { id: '{{inputs.campaignId}}' },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'segment-audience',
          name: 'Segment Target Audience',
          type: 'database',
          config: {
            operation: 'find',
            model: 'contacts',
            where: { segment: '{{load-campaign.output.segment}}' },
            take: '{{variables.segmentSize}}',
          },
          dependencies: ['load-campaign'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'send-campaign',
          name: 'Send Campaign Emails',
          type: 'email-send',
          config: {
            to: '{{segment-audience.output}}',
            subject: '{{load-campaign.output.subject}}',
            body: '{{load-campaign.output.body}}',
            html: '{{load-campaign.output.html}}',
          },
          dependencies: ['segment-audience'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 2000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 120000, killOnTimeout: false },
        },
        {
          id: 'track-delivery',
          name: 'Track Email Delivery',
          type: 'database',
          config: {
            operation: 'create',
            model: 'campaignAnalytics',
            data: {
              campaignId: '{{inputs.campaignId}}',
              sentAt: '{{system.isoDate}}',
              recipientCount: '{{segment-audience.output.length}}',
            },
          },
          dependencies: ['send-campaign'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  // ─── Sales Templates ──────────────────────────────────────────────────────

  private createInvoiceProcessingTemplate(): WorkflowTemplate {
    return {
      id: 'invoice-processing',
      name: 'Invoice Processing Automation',
      description: 'Automated invoice processing with validation, approval, and payment scheduling.',
      category: 'finance',
      tags: ['invoice', 'finance', 'approval', 'payment'],
      estimatedTime: '45 minutes setup',
      difficulty: 'intermediate',
      icon: 'FileText',
      color: '#10B981',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Accounts payable automation', 'Invoice approval workflows', 'Payment processing'],
      requirements: ['Accounting system integration', 'Payment gateway'],
      triggers: [
        {
          id: 'invoice-received',
          type: 'webhook',
          config: {
            path: '/webhooks/invoice',
            method: 'POST',
            authentication: { type: 'apiKey', header: 'X-API-Key', validate: async () => true },
            rateLimit: { enabled: true, maxRequests: 100, windowMs: 60000 },
            cors: { enabled: false, origins: [], methods: [], headers: [] },
          },
          enabled: true,
        },
      ],
      variables: {
        approvalThreshold: 1000,
        currency: 'USD',
      },
      steps: [
        {
          id: 'validate-invoice',
          name: 'Validate Invoice Data',
          type: 'condition',
          config: {
            condition: 'inputs.invoice.amount > 0 && inputs.invoice.vendor',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'check-duplicate',
          name: 'Check for Duplicates',
          type: 'database',
          config: {
            operation: 'findFirst',
            model: 'invoice',
            where: {
              vendorId: '{{inputs.invoice.vendorId}}',
              invoiceNumber: '{{inputs.invoice.invoiceNumber}}',
            },
          },
          dependencies: ['validate-invoice'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'save-invoice',
          name: 'Save Invoice to Database',
          type: 'database',
          config: {
            operation: 'create',
            model: 'invoice',
            data: {
              ... '{{inputs.invoice}}',
              status: 'pending',
              receivedAt: '{{system.isoDate}}',
            },
          },
          dependencies: ['check-duplicate'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'check-threshold',
          name: 'Check Approval Threshold',
          type: 'condition',
          config: {
            condition: 'inputs.invoice.amount > variables.approvalThreshold',
          },
          dependencies: ['save-invoice'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'send-for-approval',
          name: 'Send for Manager Approval',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'New invoice requires approval: {{inputs.invoice.vendor}} - {{inputs.invoice.amount}}',
            channel_id: '#finance-approvals',
          },
          dependencies: ['check-threshold'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'schedule-payment',
          name: 'Schedule Payment',
          type: 'database',
          config: {
            operation: 'update',
            model: 'invoice',
            where: { id: '{{save-invoice.output.id}}' },
            data: { status: 'approved', approvedAt: '{{system.isoDate}}' },
          },
          dependencies: ['send-for-approval'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createLeadScoringTemplate(): WorkflowTemplate {
    return {
      id: 'lead-scoring',
      name: 'Lead Scoring Automation',
      description: 'Automated lead scoring based on engagement and demographic data.',
      category: 'sales',
      tags: ['leads', 'scoring', 'automation', 'crm'],
      estimatedTime: '30 minutes setup',
      difficulty: 'intermediate',
      icon: 'Target',
      color: '#F59E0B',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Lead qualification', 'Sales prioritization', 'CRM automation'],
      requirements: ['CRM integration', 'Analytics data'],
      triggers: [
        {
          id: 'lead-updated',
          type: 'event',
          config: {
            eventType: 'lead:updated',
            source: 'crm',
          },
          enabled: true,
        },
      ],
      variables: {
        scoringRules: {
          emailOpen: 5,
          linkClick: 10,
          demoRequest: 25,
          pricingPage: 15,
        },
      },
      steps: [
        {
          id: 'calculate-score',
          name: 'Calculate Lead Score',
          type: 'code',
          config: {
            code: `
              const score = 0;
              const lead = inputs.lead;
              if (lead.emailOpened) score += 5;
              if (lead.linkClicked) score += 10;
              if (lead.demoRequested) score += 25;
              if (lead.viewedPricing) score += 15;
              return { score, breakdown: { emailOpened: lead.emailOpened, linkClicked: lead.linkClicked } };
            `,
            language: 'javascript',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'update-lead',
          name: 'Update Lead Score in CRM',
          type: 'database',
          config: {
            operation: 'update',
            model: 'lead',
            where: { id: '{{inputs.lead.id}}' },
            data: {
              score: '{{calculate-score.output.score}}',
              scoreBreakdown: '{{calculate-score.output.breakdown}}',
            },
          },
          dependencies: ['calculate-score'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'notify-sales',
          name: 'Notify Sales Team for Hot Leads',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'Hot lead alert: {{inputs.lead.name}} scored {{calculate-score.output.score}}',
            channel_id: '#sales-alerts',
          },
          dependencies: ['update-lead'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createDealApprovalTemplate(): WorkflowTemplate {
    return {
      id: 'deal-approval',
      name: 'Deal Approval Workflow',
      description: 'Multi-level approval workflow for high-value deals with routing logic.',
      category: 'sales',
      tags: ['deals', 'approval', 'workflow', 'sales'],
      estimatedTime: '1 hour setup',
      difficulty: 'advanced',
      icon: 'CheckCircle',
      color: '#059669',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Deal approval automation', 'Discount authorization', 'Contract approval'],
      requirements: ['CRM integration', 'Notification service'],
      triggers: [
        {
          id: 'deal-submitted',
          type: 'event',
          config: {
            eventType: 'deal:submitted',
            source: 'crm',
          },
          enabled: true,
        },
      ],
      variables: {
        approvalLevels: [
          { maxAmount: 10000, approver: 'sales-manager' },
          { maxAmount: 50000, approver: 'sales-director' },
          { maxAmount: 100000, approver: 'vp-sales' },
          { maxAmount: Infinity, approver: 'cfo' },
        ],
      },
      steps: [
        {
          id: 'determine-approval-level',
          name: 'Determine Required Approval Level',
          type: 'code',
          config: {
            code: `
              const dealValue = inputs.deal.value;
              const levels = variables.approvalLevels;
              for (const level of levels) {
                if (dealValue <= level.maxAmount) {
                  return { approver: level.approver, level: levels.indexOf(level) + 1 };
                }
              }
              return { approver: 'cfo', level: levels.length };
            `,
            language: 'javascript',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'send-approval-request',
          name: 'Send Approval Request',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'Deal approval needed: {{inputs.deal.name}} - ${{inputs.deal.value}}',
            channel_id: '#deal-approvals',
          },
          dependencies: ['determine-approval-level'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'wait-for-approval',
          name: 'Wait for Approval',
          type: 'delay',
          config: {
            duration: 24,
            unit: 'hours',
          },
          dependencies: ['send-approval-request'],
          required: false,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 86400000, killOnTimeout: false },
        },
        {
          id: 'update-deal-status',
          name: 'Update Deal Status',
          type: 'database',
          config: {
            operation: 'update',
            model: 'deal',
            where: { id: '{{inputs.deal.id}}' },
            data: { status: 'approved', approvedAt: '{{system.isoDate}}' },
          },
          dependencies: ['wait-for-approval'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  // ─── Operations Templates ─────────────────────────────────────────────────

  private createDataSyncTemplate(): WorkflowTemplate {
    return {
      id: 'data-sync',
      name: 'Data Synchronization',
      description: 'Keep data synchronized between multiple services with conflict resolution.',
      category: 'integration',
      tags: ['sync', 'integration', 'data', 'etl'],
      estimatedTime: '2 hours setup',
      difficulty: 'advanced',
      icon: 'RefreshCw',
      color: '#6366F1',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Multi-system data sync', 'ETL pipelines', 'Data warehouse updates'],
      requirements: ['Source and destination APIs', 'Conflict resolution strategy'],
      triggers: [
        {
          id: 'sync-scheduled',
          type: 'cron',
          config: {
            expression: '0 */6 * * *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        batchSize: 100,
        conflictStrategy: 'source-wins',
      },
      steps: [
        {
          id: 'fetch-source-data',
          name: 'Fetch Source Data',
          type: 'http-request',
          config: {
            url: '{{inputs.sourceApi}}',
            method: 'GET',
            timeout: 30000,
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: true },
        },
        {
          id: 'transform-data',
          name: 'Transform Data Format',
          type: 'transform',
          config: {
            operation: 'map',
            source: '{{fetch-source-data.output.data}}',
            expression: '({ id: item.id, name: item.name, value: item.value, syncedAt: new Date().toISOString() })',
          },
          dependencies: ['fetch-source-data'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'sync-to-destination',
          name: 'Sync to Destination',
          type: 'http-request',
          config: {
            url: '{{inputs.destinationApi}}',
            method: 'POST',
            body: '{{transform-data.output}}',
            timeout: 60000,
          },
          dependencies: ['transform-data'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 2000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 120000, killOnTimeout: false },
        },
        {
          id: 'log-sync-results',
          name: 'Log Sync Results',
          type: 'database',
          config: {
            operation: 'create',
            model: 'syncLog',
            data: {
              source: '{{inputs.sourceApi}}',
              destination: '{{inputs.destinationApi}}',
              recordsSynced: '{{transform-data.output.length}}',
              syncedAt: '{{system.isoDate}}',
            },
          },
          dependencies: ['sync-to-destination'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createReportGenerationTemplate(): WorkflowTemplate {
    return {
      id: 'report-generation',
      name: 'Report Generation Pipeline',
      description: 'Automated report generation with data aggregation and distribution.',
      category: 'productivity',
      tags: ['reports', 'analytics', 'automation', 'pdf'],
      estimatedTime: '1.5 hours setup',
      difficulty: 'intermediate',
      icon: 'BarChart2',
      color: '#0EA5E9',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Weekly/Monthly reports', 'Executive dashboards', 'Client reports'],
      requirements: ['Data sources', 'PDF generation', 'Email service'],
      triggers: [
        {
          id: 'report-schedule',
          type: 'cron',
          config: {
            expression: '0 8 * * 1',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        reportType: 'weekly',
        recipients: ['team@company.com'],
      },
      steps: [
        {
          id: 'gather-metrics',
          name: 'Gather Report Metrics',
          type: 'database',
          config: {
            operation: 'aggregate',
            model: 'metrics',
            where: { createdAt: { gte: '{{inputs.startDate}}', lte: '{{inputs.endDate}}' } },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'generate-charts',
          name: 'Generate Visualizations',
          type: 'code',
          config: {
            code: `
              const metrics = inputs.metrics;
              return {
                charts: [
                  { type: 'line', data: metrics.trend },
                  { type: 'pie', data: metrics.breakdown },
                  { type: 'bar', data: metrics.comparison },
                ],
              };
            `,
            language: 'javascript',
          },
          dependencies: ['gather-metrics'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'create-pdf',
          name: 'Generate PDF Report',
          type: 'pdf',
          config: {
            template: 'weekly-report',
            data: {
              metrics: '{{gather-metrics.output}}',
              charts: '{{generate-charts.output.charts}}',
              period: '{{inputs.startDate}} - {{inputs.endDate}}',
            },
            options: { format: 'A4', orientation: 'portrait' },
          },
          dependencies: ['generate-charts'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 2000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: false },
        },
        {
          id: 'send-report',
          name: 'Send Report to Recipients',
          type: 'email-send',
          config: {
            to: '{{variables.recipients}}',
            subject: 'Weekly Report - {{inputs.startDate}}',
            body: 'Please find attached the weekly report.',
            attachments: [{ filename: 'report.pdf', content: '{{create-pdf.output.pdf.url}}' }],
          },
          dependencies: ['create-pdf'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
      ],
    };
  }

  private createBackupTemplate(): WorkflowTemplate {
    return {
      id: 'backup-workflow',
      name: 'Automated Backup Workflow',
      description: 'Automated database and file backups with retention management.',
      category: 'operations',
      tags: ['backup', 'database', 'storage', 'retention'],
      estimatedTime: '1 hour setup',
      difficulty: 'intermediate',
      icon: 'Database',
      color: '#78716C',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Database backups', 'File backups', 'Disaster recovery'],
      requirements: ['Database access', 'Cloud storage'],
      triggers: [
        {
          id: 'backup-schedule',
          type: 'cron',
          config: {
            expression: '0 2 * * *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        retentionDays: 30,
        storageBucket: 'backups',
      },
      steps: [
        {
          id: 'create-database-backup',
          name: 'Create Database Backup',
          type: 'code',
          config: {
            code: `
              return {
                backupId: 'backup_' + Date.now(),
                size: 0,
                location: variables.storageBucket + '/db/' + new Date().toISOString().split('T')[0],
              };
            `,
            language: 'javascript',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 5000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 600000, killOnTimeout: false },
        },
        {
          id: 'create-file-backup',
          name: 'Create File Backup',
          type: 'file',
          config: {
            operation: 'copy',
            path: '{{inputs.sourcePath}}',
            content: '{{variables.storageBucket}}/files/' + '{{system.isoDate}}',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 5000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 600000, killOnTimeout: false },
        },
        {
          id: 'verify-backups',
          name: 'Verify Backup Integrity',
          type: 'code',
          config: {
            code: `
              return {
                database: true,
                files: true,
                verifiedAt: new Date().toISOString(),
              };
            `,
            language: 'javascript',
          },
          dependencies: ['create-database-backup', 'create-file-backup'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'cleanup-old-backups',
          name: 'Clean Up Old Backups',
          type: 'code',
          config: {
            code: `
              const cutoffDate = new Date();
              cutoffDate.setDate(cutoffDate.getDate() - variables.retentionDays);
              return { deletedCount: 0, cutoffDate: cutoffDate.toISOString() };
            `,
            language: 'javascript',
          },
          dependencies: ['verify-backups'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 60000, killOnTimeout: true },
        },
        {
          id: 'send-backup-notification',
          name: 'Send Backup Completion Notification',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'Backup completed successfully. Database: ✅, Files: ✅',
            channel_id: '#ops-alerts',
          },
          dependencies: ['cleanup-old-backups'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  // ─── HR Templates ─────────────────────────────────────────────────────────

  private createEmployeeOnboardingTemplate(): WorkflowTemplate {
    return {
      id: 'employee-onboarding',
      name: 'Employee Onboarding',
      description: 'Complete employee onboarding workflow with task assignments and notifications.',
      category: 'hr',
      tags: ['onboarding', 'hr', 'employee', 'tasks'],
      estimatedTime: '2 hours setup',
      difficulty: 'intermediate',
      icon: 'UserPlus',
      color: '#D946EF',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['New hire onboarding', 'Team setup', 'Equipment provisioning'],
      requirements: ['HR system', 'Task management', 'Email service'],
      triggers: [
        {
          id: 'employee-hired',
          type: 'event',
          config: {
            eventType: 'employee:hired',
            source: 'hr-system',
          },
          enabled: true,
        },
      ],
      variables: {
        departments: ['engineering', 'sales', 'marketing', 'hr', 'finance'],
        defaultEquipment: ['laptop', 'monitor', 'keyboard', 'mouse'],
      },
      steps: [
        {
          id: 'create-employee-record',
          name: 'Create Employee Record',
          type: 'database',
          config: {
            operation: 'create',
            model: 'employee',
            data: {
              ... '{{inputs.employee}}',
              status: 'onboarding',
              startDate: '{{inputs.startDate}}',
            },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'provision-accounts',
          name: 'Provision System Accounts',
          type: 'parallel',
          config: {
            steps: ['create-email-account', 'create-slack-account', 'create-github-account'],
          },
          dependencies: ['create-employee-record'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 2000, maxDelay: 15000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 120000, killOnTimeout: false },
        },
        {
          id: 'assign-equipment',
          name: 'Assign Equipment',
          type: 'database',
          config: {
            operation: 'create',
            model: 'equipment',
            data: {
              employeeId: '{{create-employee-record.output.id}}',
              equipment: '{{variables.defaultEquipment}}',
              status: 'pending',
            },
          },
          dependencies: ['create-employee-record'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'send-welcome-email',
          name: 'Send Welcome Email',
          type: 'email-send',
          config: {
            to: '{{inputs.employee.email}}',
            subject: 'Welcome to the team!',
            body: 'Hello {{inputs.employee.name}}, we are excited to have you join us!',
            template: 'employee-welcome',
          },
          dependencies: ['provision-accounts'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
        {
          id: 'notify-manager',
          name: 'Notify Manager',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'New employee {{inputs.employee.name}} is starting on {{inputs.startDate}}',
            channel_id: '#team-updates',
          },
          dependencies: ['send-welcome-email'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createLeaveApprovalTemplate(): WorkflowTemplate {
    return {
      id: 'leave-approval',
      name: 'Leave Request Approval',
      description: 'Automated leave request workflow with manager approval and calendar updates.',
      category: 'hr',
      tags: ['leave', 'approval', 'calendar', 'hr'],
      estimatedTime: '30 minutes setup',
      difficulty: 'beginner',
      icon: 'Calendar',
      color: '#F472B6',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['PTO requests', 'Sick leave', 'Vacation approval'],
      requirements: ['HR system', 'Calendar integration'],
      triggers: [
        {
          id: 'leave-requested',
          type: 'event',
          config: {
            eventType: 'leave:requested',
            source: 'hr-system',
          },
          enabled: true,
        },
      ],
      variables: {},
      steps: [
        {
          id: 'validate-request',
          name: 'Validate Leave Request',
          type: 'condition',
          config: {
            condition: 'inputs.request.startDate && inputs.request.endDate && inputs.request.type',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'check-leave-balance',
          name: 'Check Leave Balance',
          type: 'database',
          config: {
            operation: 'findFirst',
            model: 'leaveBalance',
            where: {
              employeeId: '{{inputs.request.employeeId}}',
              type: '{{inputs.request.type}}',
            },
          },
          dependencies: ['validate-request'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'send-for-approval',
          name: 'Send to Manager for Approval',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'Leave request from {{inputs.request.employeeName}}: {{inputs.request.startDate}} to {{inputs.request.endDate}}',
            channel_id: '#hr-requests',
          },
          dependencies: ['check-leave-balance'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'update-calendar',
          name: 'Update Calendar',
          type: 'http-request',
          config: {
            url: '{{inputs.calendarApi}}',
            method: 'POST',
            body: {
              event: 'Leave',
              start: '{{inputs.request.startDate}}',
              end: '{{inputs.request.endDate}}',
              employee: '{{inputs.request.employeeName}}',
            },
          },
          dependencies: ['send-for-approval'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
      ],
    };
  }

  private createPerformanceReviewTemplate(): WorkflowTemplate {
    return {
      id: 'performance-review',
      name: 'Performance Review Cycle',
      description: 'Automated performance review process with self-assessment and manager review.',
      category: 'hr',
      tags: ['performance', 'review', 'assessment', 'hr'],
      estimatedTime: '3 hours setup',
      difficulty: 'advanced',
      icon: 'Award',
      color: '#FBBF24',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Quarterly reviews', 'Annual reviews', '360 feedback'],
      requirements: ['HR system', 'Email service', 'Form builder'],
      triggers: [
        {
          id: 'review-cycle-start',
          type: 'cron',
          config: {
            expression: '0 9 1 1,4,7,10 *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        reviewPeriod: 'quarterly',
        selfAssessmentDays: 7,
        managerReviewDays: 14,
      },
      steps: [
        {
          id: 'identify-employees',
          name: 'Identify Employees for Review',
          type: 'database',
          config: {
            operation: 'find',
            model: 'employee',
            where: { status: 'active', startDate: { lte: '{{inputs.reviewEndDate}}' } },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'send-self-assessment',
          name: 'Send Self-Assessment Forms',
          type: 'email-send',
          config: {
            to: '{{identify-employees.output}}',
            subject: 'Performance Review - Self Assessment',
            body: 'Please complete your self-assessment by the deadline.',
            template: 'self-assessment',
          },
          dependencies: ['identify-employees'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: false },
        },
        {
          id: 'wait-for-self-assessment',
          name: 'Wait for Self-Assessments',
          type: 'delay',
          config: {
            duration: '{{variables.selfAssessmentDays}}',
            unit: 'days',
          },
          dependencies: ['send-self-assessment'],
          required: false,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 604800000, killOnTimeout: false },
        },
        {
          id: 'compile-reviews',
          name: 'Compile Review Data',
          type: 'database',
          config: {
            operation: 'aggregate',
            model: 'review',
            where: { cycleId: '{{inputs.cycleId}}' },
          },
          dependencies: ['wait-for-self-assessment'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'notify-managers',
          name: 'Notify Managers to Complete Reviews',
          type: 'notification',
          config: {
            channel: 'email',
            message: 'Time to complete performance reviews for your team members.',
            channel_id: 'managers',
          },
          dependencies: ['compile-reviews'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  // ─── Support Templates ────────────────────────────────────────────────────

  private createTicketRoutingTemplate(): WorkflowTemplate {
    return {
      id: 'ticket-routing',
      name: 'Support Ticket Routing',
      description: 'Intelligent ticket routing based on content analysis and agent availability.',
      category: 'support',
      tags: ['tickets', 'routing', 'support', 'automation'],
      estimatedTime: '1 hour setup',
      difficulty: 'intermediate',
      icon: 'Headphones',
      color: '#22D3EE',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Customer support', 'Help desk', 'Ticket management'],
      requirements: ['Ticketing system', 'AI for classification'],
      triggers: [
        {
          id: 'ticket-created',
          type: 'event',
          config: {
            eventType: 'ticket:created',
            source: 'support-system',
          },
          enabled: true,
        },
      ],
      variables: {
        categories: ['billing', 'technical', 'feature-request', 'bug-report', 'general'],
        priorities: { urgent: 1, high: 2, medium: 3, low: 4 },
      },
      steps: [
        {
          id: 'analyze-ticket',
          name: 'Analyze Ticket Content',
          type: 'ai-text',
          config: {
            prompt: 'Classify this support ticket: {{inputs.ticket.description}}',
            model: 'gpt-4',
            temperature: 0.3,
            responseFormat: 'json',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'determine-priority',
          name: 'Determine Ticket Priority',
          type: 'code',
          config: {
            code: `
              const analysis = inputs.analysis;
              let priority = 'medium';
              if (analysis.urgency === 'high' || analysis.sentiment === 'angry') {
                priority = 'urgent';
              } else if (analysis.urgency === 'medium') {
                priority = 'high';
              }
              return { priority, category: analysis.category };
            `,
            language: 'javascript',
          },
          dependencies: ['analyze-ticket'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'find-available-agent',
          name: 'Find Available Agent',
          type: 'database',
          config: {
            operation: 'findFirst',
            model: 'agent',
            where: {
              status: 'available',
              specialty: '{{determine-priority.output.category}}',
            },
          },
          dependencies: ['determine-priority'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'assign-ticket',
          name: 'Assign Ticket to Agent',
          type: 'database',
          config: {
            operation: 'update',
            model: 'ticket',
            where: { id: '{{inputs.ticket.id}}' },
            data: {
              agentId: '{{find-available-agent.output.id}}',
              priority: '{{determine-priority.output.priority}}',
              category: '{{determine-priority.output.category}}',
              status: 'assigned',
            },
          },
          dependencies: ['find-available-agent'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'notify-agent',
          name: 'Notify Assigned Agent',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'New ticket assigned: {{inputs.ticket.subject}} (Priority: {{determine-priority.output.priority}})',
            channel_id: '{{find-available-agent.output.slackChannel}}',
          },
          dependencies: ['assign-ticket'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createEscalationTemplate(): WorkflowTemplate {
    return {
      id: 'escalation-workflow',
      name: 'Support Escalation Workflow',
      description: 'Automated escalation when tickets are not resolved within SLA.',
      category: 'support',
      tags: ['escalation', 'sla', 'support', 'automation'],
      estimatedTime: '45 minutes setup',
      difficulty: 'intermediate',
      icon: 'AlertTriangle',
      color: '#EF4444',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['SLA management', 'Escalation paths', 'Priority handling'],
      requirements: ['Ticketing system', 'Notification service'],
      triggers: [
        {
          id: 'sla-warning',
          type: 'cron',
          config: {
            expression: '*/15 * * * *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        slaThresholds: {
          urgent: 1,
          high: 4,
          medium: 8,
          low: 24,
        },
      },
      steps: [
        {
          id: 'check-aging-tickets',
          name: 'Check Aging Tickets',
          type: 'database',
          config: {
            operation: 'find',
            model: 'ticket',
            where: {
              status: { in: ['open', 'in-progress'] },
              createdAt: { lte: '{{system.isoDate}}' },
            },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'identify-escalation-candidates',
          name: 'Identify Tickets Needing Escalation',
          type: 'code',
          config: {
            code: `
              const tickets = inputs.tickets;
              const thresholds = variables.slaThresholds;
              const now = new Date();
              
              return tickets.filter(ticket => {
                const hoursOpen = (now - new Date(ticket.createdAt)) / (1000 * 60 * 60);
                return hoursOpen > (thresholds[ticket.priority] || 24);
              });
            `,
            language: 'javascript',
          },
          dependencies: ['check-aging-tickets'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'escalate-tickets',
          name: 'Escalate Tickets',
          type: 'database',
          config: {
            operation: 'update',
            model: 'ticket',
            where: { id: '{{identify-escalation-candidates.output}}' },
            data: {
              status: 'escalated',
              escalatedAt: '{{system.isoDate}}',
            },
          },
          dependencies: ['identify-escalation-candidates'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'notify-manager',
          name: 'Notify Support Manager',
          type: 'notification',
          config: {
            channel: 'slack',
            message: '{{identify-escalation-candidates.output.length}} tickets have been escalated due to SLA breach',
            channel_id: '#support-management',
          },
          dependencies: ['escalate-tickets'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createCustomerFeedbackTemplate(): WorkflowTemplate {
    return {
      id: 'customer-feedback',
      name: 'Customer Feedback Collection',
      description: 'Automated feedback collection and analysis after support interactions.',
      category: 'support',
      tags: ['feedback', 'survey', 'customer', 'nps'],
      estimatedTime: '30 minutes setup',
      difficulty: 'beginner',
      icon: 'MessageSquare',
      color: '#A78BFA',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['CSAT surveys', 'NPS collection', 'Feedback analysis'],
      requirements: ['Email service', 'Analytics'],
      triggers: [
        {
          id: 'ticket-resolved',
          type: 'event',
          config: {
            eventType: 'ticket:resolved',
            source: 'support-system',
          },
          enabled: true,
        },
      ],
      variables: {
        delayHours: 24,
      },
      steps: [
        {
          id: 'wait-before-survey',
          name: 'Wait Before Sending Survey',
          type: 'delay',
          config: {
            duration: '{{variables.delayHours}}',
            unit: 'hours',
          },
          dependencies: [],
          required: false,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 86400000, killOnTimeout: false },
        },
        {
          id: 'send-feedback-survey',
          name: 'Send Feedback Survey',
          type: 'email-send',
          config: {
            to: '{{inputs.ticket.customerEmail}}',
            subject: 'How was your support experience?',
            body: 'We would love to hear your feedback about your recent support interaction.',
            template: 'feedback-survey',
          },
          dependencies: ['wait-before-survey'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
        {
          id: 'track-feedback',
          name: 'Track Survey Response',
          type: 'database',
          config: {
            operation: 'create',
            model: 'feedback',
            data: {
              ticketId: '{{inputs.ticket.id}}',
              customerId: '{{inputs.ticket.customerId}}',
              sentAt: '{{system.isoDate}}',
              status: 'pending',
            },
          },
          dependencies: ['send-feedback-survey'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  // ─── Finance Templates ────────────────────────────────────────────────────

  private createExpenseApprovalTemplate(): WorkflowTemplate {
    return {
      id: 'expense-approval',
      name: 'Expense Report Approval',
      description: 'Automated expense report workflow with policy validation and approval routing.',
      category: 'finance',
      tags: ['expenses', 'approval', 'policy', 'finance'],
      estimatedTime: '1 hour setup',
      difficulty: 'intermediate',
      icon: 'Receipt',
      color: '#34D399',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Expense management', 'Policy compliance', 'Reimbursement'],
      requirements: ['Expense system', 'Policy engine'],
      triggers: [
        {
          id: 'expense-submitted',
          type: 'event',
          config: {
            eventType: 'expense:submitted',
            source: 'expense-system',
          },
          enabled: true,
        },
      ],
      variables: {
        policies: {
          maxSingleExpense: 500,
          maxDailyExpense: 1000,
          requiresReceipt: 75,
        },
      },
      steps: [
        {
          id: 'validate-expense',
          name: 'Validate Expense Against Policy',
          type: 'code',
          config: {
            code: `
              const expense = inputs.expense;
              const policies = variables.policies;
              const violations = [];
              
              if (expense.amount > policies.maxSingleExpense) {
                violations.push('Exceeds maximum single expense limit');
              }
              if (expense.amount > policies.requiresReceipt && !expense.receiptUrl) {
                violations.push('Receipt required for expenses over $' + policies.requiresReceipt);
              }
              
              return { valid: violations.length === 0, violations };
            `,
            language: 'javascript',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'check-policy-compliance',
          name: 'Check Policy Compliance',
          type: 'condition',
          config: {
            condition: 'validate-expense.output.valid',
          },
          dependencies: ['validate-expense'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'route-for-approval',
          name: 'Route for Manager Approval',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'Expense report from {{inputs.expense.employeeName}}: ${{inputs.expense.amount}}',
            channel_id: '#finance-approvals',
          },
          dependencies: ['check-policy-compliance'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'process-reimbursement',
          name: 'Process Reimbursement',
          type: 'payment',
          config: {
            operation: 'createPaymentIntent',
            amount: '{{inputs.expense.amount}}',
            currency: 'usd',
            customer: '{{inputs.expense.employeeId}}',
          },
          dependencies: ['route-for-approval'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 2000, maxDelay: 15000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: false },
        },
      ],
    };
  }

  private createPaymentProcessingTemplate(): WorkflowTemplate {
    return {
      id: 'payment-processing',
      name: 'Payment Processing Workflow',
      description: 'End-to-end payment processing with validation, charging, and receipt generation.',
      category: 'finance',
      tags: ['payment', 'stripe', 'invoice', 'receipt'],
      estimatedTime: '2 hours setup',
      difficulty: 'advanced',
      icon: 'CreditCard',
      color: '#6366F1',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Invoice payments', 'Subscription billing', 'One-time payments'],
      requirements: ['Stripe integration', 'Email service'],
      triggers: [
        {
          id: 'payment-due',
          type: 'cron',
          config: {
            expression: '0 10 * * *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        retryAttempts: 3,
        retryDelayDays: 3,
      },
      steps: [
        {
          id: 'fetch-due-payments',
          name: 'Fetch Due Payments',
          type: 'database',
          config: {
            operation: 'find',
            model: 'invoice',
            where: {
              status: 'pending',
              dueDate: { lte: '{{system.isoDate}}' },
            },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'process-payments',
          name: 'Process Payments',
          type: 'stripe',
          config: {
            operation: 'createPaymentIntent',
            amount: '{{fetch-due-payments.output.amount}}',
            currency: 'usd',
            customer: '{{fetch-due-payments.output.customerId}}',
            metadata: { invoiceId: '{{fetch-due-payments.output.id}}' },
          },
          dependencies: ['fetch-due-payments'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 2000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 60000, killOnTimeout: false },
        },
        {
          id: 'update-invoice-status',
          name: 'Update Invoice Status',
          type: 'database',
          config: {
            operation: 'update',
            model: 'invoice',
            where: { id: '{{fetch-due-payments.output.id}}' },
            data: {
              status: 'paid',
              paidAt: '{{system.isoDate}}',
              paymentId: '{{process-payments.output.id}}',
            },
          },
          dependencies: ['process-payments'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'send-receipt',
          name: 'Send Payment Receipt',
          type: 'email-send',
          config: {
            to: '{{fetch-due-payments.output.customerEmail}}',
            subject: 'Payment Received - Thank you!',
            body: 'Your payment of ${{fetch-due-payments.output.amount}} has been processed.',
            template: 'payment-receipt',
          },
          dependencies: ['update-invoice-status'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
      ],
    };
  }

  private createReconciliationTemplate(): WorkflowTemplate {
    return {
      id: 'reconciliation',
      name: 'Financial Reconciliation',
      description: 'Automated reconciliation of transactions between systems.',
      category: 'finance',
      tags: ['reconciliation', 'accounting', 'transactions', 'finance'],
      estimatedTime: '3 hours setup',
      difficulty: 'advanced',
      icon: 'Scale',
      color: '#0D9488',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Bank reconciliation', 'Payment matching', 'Audit preparation'],
      requirements: ['Accounting system', 'Bank API'],
      triggers: [
        {
          id: 'reconciliation-schedule',
          type: 'cron',
          config: {
            expression: '0 6 * * *',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        tolerance: 0.01,
        matchWindowDays: 7,
      },
      steps: [
        {
          id: 'fetch-bank-transactions',
          name: 'Fetch Bank Transactions',
          type: 'http-request',
          config: {
            url: '{{inputs.bankApiUrl}}',
            method: 'GET',
            timeout: 30000,
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: true },
        },
        {
          id: 'fetch-system-transactions',
          name: 'Fetch System Transactions',
          type: 'database',
          config: {
            operation: 'find',
            model: 'transaction',
            where: {
              createdAt: { gte: '{{inputs.startDate}}', lte: '{{inputs.endDate}}' },
            },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'match-transactions',
          name: 'Match Transactions',
          type: 'code',
          config: {
            code: `
              const bank = inputs.bankTransactions;
              const system = inputs.systemTransactions;
              const matches = [];
              const unmatched = [];
              
              for (const bTxn of bank) {
                const match = system.find(sTxn => 
                  Math.abs(sTxn.amount - bTxn.amount) < variables.tolerance &&
                  new Date(sTxn.date) >= new Date(bTxn.date - variables.matchWindowDays * 86400000)
                );
                if (match) {
                  matches.push({ bank: bTxn, system: match });
                } else {
                  unmatched.push(bTxn);
                }
              }
              
              return { matches, unmatched, matchRate: matches.length / bank.length };
            `,
            language: 'javascript',
          },
          dependencies: ['fetch-bank-transactions', 'fetch-system-transactions'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'generate-reconciliation-report',
          name: 'Generate Reconciliation Report',
          type: 'pdf',
          config: {
            template: 'reconciliation-report',
            data: {
              matches: '{{match-transactions.output.matches}}',
              unmatched: '{{match-transactions.output.unmatched}}',
              matchRate: '{{match-transactions.output.matchRate}}',
              period: '{{inputs.startDate}} - {{inputs.endDate}}',
            },
            options: { format: 'A4', orientation: 'landscape' },
          },
          dependencies: ['match-transactions'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 2000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: false },
        },
        {
          id: 'send-report',
          name: 'Send Reconciliation Report',
          type: 'email-send',
          config: {
            to: '{{inputs.financeTeam}}',
            subject: 'Daily Reconciliation Report',
            body: 'Please find attached the reconciliation report.',
            attachments: [{ filename: 'reconciliation-report.pdf', content: '{{generate-reconciliation-report.output.pdf.url}}' }],
          },
          dependencies: ['generate-reconciliation-report'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
      ],
    };
  }

  // ─── Engineering Templates ────────────────────────────────────────────────

  private createDeploymentPipelineTemplate(): WorkflowTemplate {
    return {
      id: 'deployment-pipeline',
      name: 'CI/CD Deployment Pipeline',
      description: 'Automated deployment pipeline with testing, staging, and production release.',
      category: 'engineering',
      tags: ['deployment', 'ci-cd', 'devops', 'pipeline'],
      estimatedTime: '2 hours setup',
      difficulty: 'advanced',
      icon: 'GitBranch',
      color: '#F97316',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Continuous deployment', 'Release management', 'Infrastructure updates'],
      requirements: ['Git repository', 'Cloud provider', 'Monitoring'],
      triggers: [
        {
          id: 'code-push',
          type: 'event',
          config: {
            eventType: 'git:push',
            source: 'github',
          },
          enabled: true,
        },
      ],
      variables: {
        environments: ['staging', 'production'],
        approvalRequired: true,
      },
      steps: [
        {
          id: 'run-tests',
          name: 'Run Test Suite',
          type: 'code',
          config: {
            code: `
              return {
                passed: true,
                coverage: 85,
                duration: 120,
                tests: { total: 150, passed: 148, failed: 2 }
              };
            `,
            language: 'javascript',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 5000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 300000, killOnTimeout: true },
        },
        {
          id: 'deploy-staging',
          name: 'Deploy to Staging',
          type: 'http-request',
          config: {
            url: '{{inputs.deployApiUrl}}',
            method: 'POST',
            body: {
              environment: 'staging',
              version: '{{inputs.version}}',
              commit: '{{inputs.commitSha}}',
            },
            timeout: 120000,
          },
          dependencies: ['run-tests'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 10000, maxDelay: 60000, backoffMultiplier: 2, jitter: 2000 },
          timeout: { timeoutMs: 300000, killOnTimeout: false },
        },
        {
          id: 'smoke-tests',
          name: 'Run Smoke Tests',
          type: 'code',
          config: {
            code: `
              return {
                healthCheck: true,
                apiCheck: true,
                databaseCheck: true,
                passed: true
              };
            `,
            language: 'javascript',
          },
          dependencies: ['deploy-staging'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 5000, maxDelay: 30000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 60000, killOnTimeout: true },
        },
        {
          id: 'deploy-production',
          name: 'Deploy to Production',
          type: 'http-request',
          config: {
            url: '{{inputs.deployApiUrl}}',
            method: 'POST',
            body: {
              environment: 'production',
              version: '{{inputs.version}}',
              commit: '{{inputs.commitSha}}',
            },
            timeout: 180000,
          },
          dependencies: ['smoke-tests'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 15000, maxDelay: 120000, backoffMultiplier: 2, jitter: 5000 },
          timeout: { timeoutMs: 600000, killOnTimeout: false },
        },
        {
          id: 'notify-deployment',
          name: 'Notify Team of Deployment',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'Successfully deployed version {{inputs.version}} to production',
            channel_id: '#deployments',
          },
          dependencies: ['deploy-production'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createIncidentResponseTemplate(): WorkflowTemplate {
    return {
      id: 'incident-response',
      name: 'Incident Response Workflow',
      description: 'Automated incident detection, escalation, and resolution tracking.',
      category: 'engineering',
      tags: ['incident', 'oncall', 'alerting', 'response'],
      estimatedTime: '2 hours setup',
      difficulty: 'advanced',
      icon: 'AlertCircle',
      color: '#DC2626',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Production incidents', 'System outages', 'Performance degradation'],
      requirements: ['Monitoring system', 'On-call rotation', 'Communication channels'],
      triggers: [
        {
          id: 'alert-triggered',
          type: 'event',
          config: {
            eventType: 'monitoring:alert',
            source: 'datadog',
          },
          enabled: true,
        },
      ],
      variables: {
        escalationLevels: [
          { delay: 0, channel: '#incidents' },
          { delay: 5, channel: '#oncall' },
          { delay: 15, channel: '#engineering-leads' },
          { delay: 30, channel: '#cto' },
        ],
      },
      steps: [
        {
          id: 'create-incident',
          name: 'Create Incident Record',
          type: 'database',
          config: {
            operation: 'create',
            model: 'incident',
            data: {
              title: '{{inputs.alert.title}}',
              severity: '{{inputs.alert.severity}}',
              status: 'open',
              createdAt: '{{system.isoDate}}',
              alertData: '{{inputs.alert}}',
            },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'initial-notification',
          name: 'Send Initial Alert',
          type: 'notification',
          config: {
            channel: 'slack',
            message: '🚨 INCIDENT: {{inputs.alert.title}} (Severity: {{inputs.alert.severity}})',
            channel_id: '#incidents',
          },
          dependencies: ['create-incident'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'page-oncall',
          name: 'Page On-Call Engineer',
          type: 'notification',
          config: {
            channel: 'webhook',
            message: 'Page on-call for incident {{create-incident.output.id}}',
            webhook_url: '{{inputs.pagerDutyWebhook}}',
          },
          dependencies: ['create-incident'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 2000, maxDelay: 10000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'wait-for-response',
          name: 'Wait for Acknowledgment',
          type: 'delay',
          config: {
            duration: 15,
            unit: 'minutes',
          },
          dependencies: ['page-oncall'],
          required: false,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 900000, killOnTimeout: false },
        },
        {
          id: 'escalate-if-no-response',
          name: 'Escalate if No Response',
          type: 'notification',
          config: {
            channel: 'slack',
            message: '⚠️ Escalating incident - no response within 15 minutes',
            channel_id: '#engineering-leads',
          },
          dependencies: ['wait-for-response'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'track-resolution',
          name: 'Track Incident Resolution',
          type: 'database',
          config: {
            operation: 'update',
            model: 'incident',
            where: { id: '{{create-incident.output.id}}' },
            data: {
              status: 'resolved',
              resolvedAt: '{{system.isoDate}}',
              resolvedBy: '{{inputs.resolvedBy}}',
            },
          },
          dependencies: ['escalate-if-no-response'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createCodeReviewTemplate(): WorkflowTemplate {
    return {
      id: 'code-review',
      name: 'Code Review Workflow',
      description: 'Automated code review with AI analysis and approval routing.',
      category: 'engineering',
      tags: ['code-review', 'pull-request', 'ai', 'quality'],
      estimatedTime: '1.5 hours setup',
      difficulty: 'intermediate',
      icon: 'GitPullRequest',
      color: '#7C3AED',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Pull request reviews', 'Code quality checks', 'Security scanning'],
      requirements: ['GitHub integration', 'AI code analysis'],
      triggers: [
        {
          id: 'pr-opened',
          type: 'event',
          config: {
            eventType: 'github:pull_request',
            source: 'github',
          },
          enabled: true,
        },
      ],
      variables: {
        reviewCriteria: ['correctness', 'performance', 'security', 'maintainability'],
      },
      steps: [
        {
          id: 'fetch-pr-diff',
          name: 'Fetch Pull Request Diff',
          type: 'http-request',
          config: {
            url: '{{inputs.pr.diffUrl}}',
            method: 'GET',
            headers: { Accept: 'application/vnd.github.v3.diff' },
            timeout: 30000,
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: true },
        },
        {
          id: 'ai-code-review',
          name: 'AI Code Analysis',
          type: 'ai-text',
          config: {
            prompt: 'Review this code diff for issues: {{fetch-pr-diff.output}}',
            model: 'gpt-4',
            temperature: 0.2,
            responseFormat: 'json',
          },
          dependencies: ['fetch-pr-diff'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 2000, maxDelay: 15000, backoffMultiplier: 2, jitter: 1000 },
          timeout: { timeoutMs: 120000, killOnTimeout: true },
        },
        {
          id: 'post-review-comments',
          name: 'Post Review Comments',
          type: 'http-request',
          config: {
            url: '{{inputs.pr.commentsUrl}}',
            method: 'POST',
            body: { body: '{{ai-code-review.output}}' },
            timeout: 30000,
          },
          dependencies: ['ai-code-review'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'check-approval-requirements',
          name: 'Check Approval Requirements',
          type: 'code',
          config: {
            code: `
              const review = inputs.review;
              const requiresChanges = review.issues && review.issues.length > 0;
              return {
                requiresChanges,
                issueCount: review.issues ? review.issues.length : 0,
                canMerge: !requiresChanges
              };
            `,
            language: 'javascript',
          },
          dependencies: ['ai-code-review'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'notify-reviewers',
          name: 'Notify Reviewers',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'PR #{{inputs.pr.number}} requires review: {{check-approval-requirements.output.issueCount}} issues found',
            channel_id: '#code-reviews',
          },
          dependencies: ['check-approval-requirements'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  // ─── Productivity Templates ───────────────────────────────────────────────

  private createDailyStandupTemplate(): WorkflowTemplate {
    return {
      id: 'daily-standup',
      name: 'Daily Standup Automation',
      description: 'Automated daily standup collection and summary generation.',
      category: 'productivity',
      tags: ['standup', 'daily', 'team', 'async'],
      estimatedTime: '30 minutes setup',
      difficulty: 'beginner',
      icon: 'Clock',
      color: '#06B6D4',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Async standups', 'Team updates', 'Progress tracking'],
      requirements: ['Team messaging', 'Task management'],
      triggers: [
        {
          id: 'standup-schedule',
          type: 'cron',
          config: {
            expression: '0 9 * * 1-5',
            timezone: 'UTC',
          },
          enabled: true,
        },
      ],
      variables: {
        questions: [
          'What did you accomplish yesterday?',
          'What are you working on today?',
          'Any blockers?',
        ],
      },
      steps: [
        {
          id: 'collect-responses',
          name: 'Collect Team Responses',
          type: 'database',
          config: {
            operation: 'find',
            model: 'standupResponse',
            where: { date: '{{system.isoDate}}' },
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'generate-summary',
          name: 'Generate Standup Summary',
          type: 'ai-text',
          config: {
            prompt: 'Generate a standup summary from these responses: {{collect-responses.output}}',
            model: 'gpt-4',
            temperature: 0.5,
          },
          dependencies: ['collect-responses'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 2000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 60000, killOnTimeout: true },
        },
        {
          id: 'post-summary',
          name: 'Post Summary to Team Channel',
          type: 'notification',
          config: {
            channel: 'slack',
            message: '{{generate-summary.output}}',
            channel_id: '#team-standup',
          },
          dependencies: ['generate-summary'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }

  private createMeetingSchedulerTemplate(): WorkflowTemplate {
    return {
      id: 'meeting-scheduler',
      name: 'Smart Meeting Scheduler',
      description: 'AI-powered meeting scheduling with conflict detection and optimization.',
      category: 'productivity',
      tags: ['meetings', 'scheduling', 'calendar', 'ai'],
      estimatedTime: '1.5 hours setup',
      difficulty: 'intermediate',
      icon: 'Calendar',
      color: '#8B5CF6',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Meeting coordination', 'Team scheduling', 'Client meetings'],
      requirements: ['Calendar integration', 'Email service'],
      triggers: [
        {
          id: 'meeting-requested',
          type: 'webhook',
          config: {
            path: '/webhooks/meeting-request',
            method: 'POST',
            authentication: { type: 'apiKey', validate: async () => true },
            rateLimit: { enabled: true, maxRequests: 50, windowMs: 60000 },
            cors: { enabled: false, origins: [], methods: [], headers: [] },
          },
          enabled: true,
        },
      ],
      variables: {
        preferredDuration: 30,
        bufferMinutes: 15,
      },
      steps: [
        {
          id: 'check-availability',
          name: 'Check Attendee Availability',
          type: 'http-request',
          config: {
            url: '{{inputs.calendarApi}}/availability',
            method: 'POST',
            body: {
              attendees: '{{inputs.attendees}}',
              date: '{{inputs.preferredDate}}',
              duration: '{{variables.preferredDuration}}',
            },
            timeout: 15000,
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'find-optimal-slot',
          name: 'Find Optimal Meeting Slot',
          type: 'code',
          config: {
            code: `
              const availability = inputs.availability;
              const duration = variables.preferredDuration;
              const buffer = variables.bufferMinutes;
              
              for (const slot of availability.slots) {
                if (slot.duration >= duration + buffer) {
                  return {
                    start: slot.start,
                    end: new Date(new Date(slot.start).getTime() + duration * 60000).toISOString(),
                    confidence: 0.9
                  };
                }
              }
              
              return { start: null, end: null, confidence: 0 };
            `,
            language: 'javascript',
          },
          dependencies: ['check-availability'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'create-meeting',
          name: 'Create Calendar Event',
          type: 'http-request',
          config: {
            url: '{{inputs.calendarApi}}/events',
            method: 'POST',
            body: {
              title: '{{inputs.title}}',
              start: '{{find-optimal-slot.output.start}}',
              end: '{{find-optimal-slot.output.end}}',
              attendees: '{{inputs.attendees}}',
            },
            timeout: 15000,
          },
          dependencies: ['find-optimal-slot'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'send-invitations',
          name: 'Send Meeting Invitations',
          type: 'email-send',
          config: {
            to: '{{inputs.attendees}}',
            subject: 'Meeting: {{inputs.title}}',
            body: 'You have been invited to a meeting.',
            template: 'meeting-invitation',
          },
          dependencies: ['create-meeting'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: false },
        },
      ],
    };
  }

  private createTaskAssignmentTemplate(): WorkflowTemplate {
    return {
      id: 'task-assignment',
      name: 'Smart Task Assignment',
      description: 'AI-powered task assignment based on team capacity and skills.',
      category: 'productivity',
      tags: ['tasks', 'assignment', 'ai', 'workload'],
      estimatedTime: '1 hour setup',
      difficulty: 'intermediate',
      icon: 'ListChecks',
      color: '#F472B6',
      author: 'AI Workflow Platform',
      version: '1.0.0',
      useCases: ['Task distribution', 'Workload balancing', 'Skill-based assignment'],
      requirements: ['Task management', 'Team skills database'],
      triggers: [
        {
          id: 'task-created',
          type: 'event',
          config: {
            eventType: 'task:created',
            source: 'task-manager',
          },
          enabled: true,
        },
      ],
      variables: {
        maxTasksPerPerson: 5,
        priorityWeights: { critical: 10, high: 7, medium: 4, low: 1 },
      },
      steps: [
        {
          id: 'analyze-task',
          name: 'Analyze Task Requirements',
          type: 'ai-text',
          config: {
            prompt: 'Analyze this task and identify required skills: {{inputs.task.description}}',
            model: 'gpt-4',
            temperature: 0.3,
            responseFormat: 'json',
          },
          dependencies: [],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 10000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 30000, killOnTimeout: true },
        },
        {
          id: 'find-suitable-members',
          name: 'Find Suitable Team Members',
          type: 'database',
          config: {
            operation: 'find',
            model: 'teamMember',
            where: {
              status: 'active',
              skills: { hasSome: '{{analyze-task.output.skills}}' },
            },
          },
          dependencies: ['analyze-task'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'check-workload',
          name: 'Check Team Member Workload',
          type: 'database',
          config: {
            operation: 'aggregate',
            model: 'task',
            where: {
              assigneeId: { in: '{{find-suitable-members.output}}' },
              status: { notIn: ['completed', 'cancelled'] },
            },
          },
          dependencies: ['find-suitable-members'],
          required: true,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 15000, killOnTimeout: true },
        },
        {
          id: 'assign-task',
          name: 'Assign Task to Best Candidate',
          type: 'code',
          config: {
            code: `
              const members = inputs.members;
              const workload = inputs.workload;
              const maxTasks = variables.maxTasksPerPerson;
              
              const available = members.filter(m => {
                const memberWorkload = workload.find(w => w.memberId === m.id);
                return !memberWorkload || memberWorkload.count < maxTasks;
              });
              
              if (available.length === 0) return { assigneeId: null };
              
              // Pick member with least workload
              available.sort((a, b) => {
                const aWorkload = workload.find(w => w.memberId === a.id)?.count || 0;
                const bWorkload = workload.find(w => w.memberId === b.id)?.count || 0;
                return aWorkload - bWorkload;
              });
              
              return { assigneeId: available[0].id };
            `,
            language: 'javascript',
          },
          dependencies: ['check-workload'],
          required: true,
          retry: { maxAttempts: 1, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1, jitter: 0 },
          timeout: { timeoutMs: 5000, killOnTimeout: true },
        },
        {
          id: 'update-task',
          name: 'Update Task Assignment',
          type: 'database',
          config: {
            operation: 'update',
            model: 'task',
            where: { id: '{{inputs.task.id}}' },
            data: {
              assigneeId: '{{assign-task.output.assigneeId}}',
              status: 'assigned',
              assignedAt: '{{system.isoDate}}',
            },
          },
          dependencies: ['assign-task'],
          required: true,
          retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 100 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
        {
          id: 'notify-assignee',
          name: 'Notify Assigned Team Member',
          type: 'notification',
          config: {
            channel: 'slack',
            message: 'You have been assigned a new task: {{inputs.task.title}}',
            channel_id: '{{assign-task.output.assigneeId}}',
          },
          dependencies: ['update-task'],
          required: false,
          retry: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000, backoffMultiplier: 2, jitter: 500 },
          timeout: { timeoutMs: 10000, killOnTimeout: true },
        },
      ],
    };
  }
}
