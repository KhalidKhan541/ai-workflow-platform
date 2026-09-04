import { z } from "zod";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

function requiredString(fieldName: string, min: number = 1, max?: number) {
  let schema = z.string().min(min, `${fieldName} is required`);
  if (max) {
    schema = schema.max(max, `${fieldName} must be ${max} characters or less`);
  }
  return schema;
}

function optionalString(max?: number) {
  let schema = z.string().optional();
  if (max) {
    schema = z.string().max(max).optional();
  }
  return schema;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const idParamSchema = z.object({
  id: requiredString("ID"),
});

export const slugParamSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be 50 characters or less")
    .regex(slugRegex, "Slug must contain only lowercase letters, numbers, and hyphens"),
});

// Auth Schemas
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .regex(emailRegex, "Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().default(false),
});

export const registerSchema = z
  .object({
    name: requiredString("Name", 2, 100),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .regex(emailRegex, "Please enter a valid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .regex(
        passwordRegex,
        "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    organizationName: z.string().min(2).max(100).optional(),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms of Service" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: z
      .string()
      .min(1, "Password is required")
      .regex(
        passwordRegex,
        "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(1, "New password is required")
      .regex(
        passwordRegex,
        "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// User Schemas
export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  image: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
  locale: z.string().max(5).optional(),
});

// Organization Schemas
export const createOrganizationSchema = z.object({
  name: requiredString("Organization name", 2, 100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be 50 characters or less")
    .regex(slugRegex, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: optionalString(500),
  logo: z.string().url().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex)
    .optional(),
  description: z.string().max(500).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

// Workflow Schemas
export const workflowStepConfigSchema = z.record(z.unknown());

export const createWorkflowSchema = z.object({
  name: requiredString("Workflow name", 2, 100),
  description: optionalString(2000),
  tags: z.array(z.string().max(50)).max(10).default([]),
  config: z.record(z.unknown()).optional(),
  isTemplate: z.boolean().default(false),
  timeoutMs: z.number().int().min(1000).max(3600000).default(300000),
  retryCount: z.number().int().min(0).max(10).default(3),
  scheduleCron: z.string().optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  config: z.record(z.unknown()).optional(),
  isTemplate: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  timeoutMs: z.number().int().min(1000).max(3600000).optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
  scheduleCron: z.string().optional().nullable(),
});

export const createWorkflowStepSchema = z.object({
  name: requiredString("Step name", 1, 100),
  type: requiredString("Step type"),
  config: workflowStepConfigSchema.default({}),
  order: z.number().int().min(0).default(0),
  parentId: z.string().optional().nullable(),
  x: z.number().default(0),
  y: z.number().default(0),
});

export const updateWorkflowStepSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().optional(),
  config: workflowStepConfigSchema.optional(),
  order: z.number().int().min(0).optional(),
  parentId: z.string().optional().nullable(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const createWorkflowTriggerSchema = z.object({
  type: z.enum(["WEBHOOK", "SCHEDULE", "EVENT", "MANUAL", "API"]),
  config: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

export const createWorkflowActionSchema = z.object({
  type: z.enum([
    "HTTP_REQUEST",
    "AI_COMPLETION",
    "DATA_TRANSFORM",
    "SEND_EMAIL",
    "UPDATE_RECORD",
    "CONDITION",
    "WAIT",
    "CUSTOM_CODE",
  ]),
  name: requiredString("Action name", 1, 100),
  config: z.record(z.unknown()).default({}),
  order: z.number().int().min(0).default(0),
  condition: z.record(z.unknown()).optional().nullable(),
  timeoutMs: z.number().int().min(1000).max(300000).optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(0).max(10),
      backoffMs: z.number().int().min(100),
      backoffMultiplier: z.number().min(1).max(10),
    })
    .optional(),
});

// Execution Schemas
export const triggerExecutionSchema = z.object({
  triggerData: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const executionFilterSchema = z
  .object({
    status: z
      .enum([
        "PENDING",
        "RUNNING",
        "PAUSED",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "TIMED_OUT",
      ])
      .optional(),
    workflowId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .merge(paginationSchema);

// Integration Schemas
export const createIntegrationSchema = z.object({
  name: requiredString("Integration name", 2, 100),
  type: z.enum([
    "SLACK",
    "GITHUB",
    "JIRA",
    "HUBSPOT",
    "SALESFORCE",
    "STRIPE",
    "SENDGRID",
    "TWILIO",
    "AWS",
    "CUSTOM",
  ]),
  description: optionalString(500),
  config: z.record(z.unknown()).default({}),
  credentials: z.record(z.unknown()).default({}),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// AI Schemas
export const createAIAgentSchema = z.object({
  name: requiredString("Agent name", 2, 100),
  description: optionalString(2000),
  model: z.string().default("gpt-4"),
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(128000).default(4096),
  config: z.record(z.unknown()).optional(),
});

export const runAIAgentSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000),
  promptId: z.string().optional(),
  variables: z.record(z.string()).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
});

// Data Source Schemas
export const createDataSourceSchema = z.object({
  name: requiredString("Data source name", 2, 100),
  type: requiredString("Data source type"),
  config: z.record(z.unknown()).default({}),
  schemaId: z.string().optional(),
});

export const updateDataSourceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const upsertDataRecordSchema = z.object({
  externalId: z.string().optional(),
  data: z.record(z.unknown()),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  expiresAt: z.string().datetime().optional(),
});

// Webhook Schemas
export const createWebhookSchema = z.object({
  name: requiredString("Webhook name", 2, 100),
  url: z.string().url("Please enter a valid URL"),
  events: z
    .array(z.string())
    .min(1, "At least one event is required")
    .max(20),
  config: z.record(z.unknown()).optional(),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  config: z.record(z.unknown()).optional(),
});

// API Key Schemas
export const createApiKeySchema = z.object({
  name: requiredString("API key name", 2, 100),
  scopes: z
    .array(z.string())
    .min(1, "At least one scope is required")
    .max(20),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.number().int().min(1).max(100000).default(1000),
});

// Notification Schemas
export const markNotificationReadSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one notification ID is required"),
});

// Subscription Schemas
export const createSubscriptionSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]),
  stripePaymentMethodId: z.string().optional(),
});

export const updateSubscriptionSchema = z.object({
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

// Audit Log Schemas
export const auditLogFilterSchema = z
  .object({
    action: z
      .enum([
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "EXPORT",
        "IMPORT",
        "EXECUTE",
        "SHARE",
      ])
      .optional(),
    resourceType: z.string().optional(),
    userId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .merge(paginationSchema);

// Search Schema
export const globalSearchSchema = z.object({
  q: z.string().min(1, "Search query is required").max(200),
  types: z
    .array(
      z.enum([
        "workflows",
        "executions",
        "integrations",
        "data_sources",
        "users",
      ])
    )
    .optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

// Bulk Action Schema
export const bulkActionSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, "At least one ID is required")
    .max(100, "Cannot perform bulk action on more than 100 items"),
  action: z.enum(["delete", "archive", "restore", "export"]),
});

// Webhook Verification Schema
export const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  signature: z.string().optional(),
});

// Export Schema
export const exportSchema = z.object({
  format: z.enum(["json", "csv", "xlsx"]).default("json"),
  includeMetadata: z.boolean().default(false),
  filters: z.record(z.unknown()).optional(),
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type CreateAIAgentInput = z.infer<typeof createAIAgentSchema>;
export type RunAIAgentInput = z.infer<typeof runAIAgentSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
