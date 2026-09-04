import { z } from 'zod';

// ─── Auth ───────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  orgName: z.string().min(2).max(100).optional(),
});

// ─── Organization ───────────────────────────────────────
export const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  logo: z.string().url().optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z.string().url().optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

// ─── Workflow ───────────────────────────────────────────
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  trigger: z.record(z.unknown()).optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  variables: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
  isTemplate: z.boolean().default(false),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  trigger: z.record(z.unknown()).optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  variables: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export const executeWorkflowSchema = z.object({
  input: z.record(z.unknown()).optional(),
  async: z.boolean().default(false),
});

// ─── Execution ──────────────────────────────────────────
export const executionFilterSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT']).optional(),
  workflowId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ─── Integration ────────────────────────────────────────
export const saveIntegrationConfigSchema = z.object({
  name: z.string().min(1).max(100),
  credentials: z.record(z.unknown()),
  settings: z.record(z.unknown()).optional(),
});

// ─── AI ─────────────────────────────────────────────────
export const createAIAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  model: z.string().default('gpt-4'),
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  tools: z.array(z.record(z.unknown())).optional(),
});

export const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(128000).optional(),
  stream: z.boolean().default(false),
});

export const createPromptTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  content: z.string().min(1).max(50000),
  variables: z.array(z.string()).default([]),
  category: z.string().max(50).optional(),
  isPublic: z.boolean().default(false),
});

// ─── Data ───────────────────────────────────────────────
export const createDataSourceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()),
});

export const createDataRecordSchema = z.object({
  connectionId: z.string(),
  externalId: z.string().optional(),
  data: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

export const createDataSchemaSchema = z.object({
  dataSourceId: z.string(),
  name: z.string().min(1).max(100),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().default(false),
      description: z.string().optional(),
    })
  ),
});

// ─── Webhooks ───────────────────────────────────────────
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().optional(),
  secret: z.string().max(255).optional(),
  events: z.array(z.string()).min(1),
  workflowId: z.string().optional(),
});

export const triggerWebhookSchema = z.object({
  event: z.string(),
  payload: z.record(z.unknown()).optional(),
});

// ─── API Keys ───────────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(['read']),
  expiresAt: z.string().datetime().optional(),
});

// ─── Dashboard ──────────────────────────────────────────
export const dashboardStatsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('week'),
});
