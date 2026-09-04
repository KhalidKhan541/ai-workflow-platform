import type {
  Role,
  WorkflowStatus,
  TriggerType,
  ActionType,
  ExecutionStatus,
  IntegrationType,
  AuditAction,
  SubscriptionPlan,
  NotificationType,
  DataRecordStatus,
  WebhookStatus,
  APIKeyStatus,
} from "@prisma/client";

// ============ ENUMS ============

export type {
  Role,
  WorkflowStatus,
  TriggerType,
  ActionType,
  ExecutionStatus,
  IntegrationType,
  AuditAction,
  SubscriptionPlan,
  NotificationType,
  DataRecordStatus,
  WebhookStatus,
  APIKeyStatus,
};

export type SortOrder = "asc" | "desc";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ContentType =
  | "application/json"
  | "application/x-www-form-urlencoded"
  | "multipart/form-data"
  | "text/plain";

// ============ BASE TYPES ============

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletable {
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PaginationMeta {
  page: number;
  limit: 100;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SortParams {
  field: string;
  order: SortOrder;
}

export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

// ============ USER TYPES ============

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
}

export interface UserWithMembership extends UserProfile {
  memberships: OrgMemberWithOrg[];
}

export interface UserSession {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  orgId: string | null;
  orgSlug: string | null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  organizationName?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  image?: string | null;
  bio?: string;
  timezone?: string;
  locale?: string;
}

// ============ ORGANIZATION TYPES ============

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
  settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface OrganizationWithMembers extends Organization {
  members: OrgMemberWithUser[];
  _count: {
    members: number;
    workflows: number;
    integrations: number;
  };
}

export interface OrgMemberWithOrg {
  id: string;
  role: Role;
  createdAt: Date;
  acceptedAt: Date | null;
  organization: Pick<Organization, "id" | "name" | "slug" | "logo">;
}

export interface OrgMemberWithUser {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  createdAt: Date;
  acceptedAt: Date | null;
  user: UserProfile;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  description?: string | null;
  logo?: string | null;
  settings?: Record<string, unknown>;
}

export interface InviteMemberInput {
  email: string;
  role: Role;
}

export interface UpdateMemberRoleInput {
  role: Role;
}

// ============ WORKFLOW TYPES ============

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  createdBy: string;
  status: WorkflowStatus;
  version: number;
  config: Record<string, unknown> | null;
  tags: string[];
  isTemplate: boolean;
  isPublished: boolean;
  scheduleCron: string | null;
  timeoutMs: number;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  runCount: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface WorkflowWithDetails extends Workflow {
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  creator: Pick<UserProfile, "id" | "name" | "email" | "image">;
  _count: {
    executions: number;
  };
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  tags: string[];
  lastRunAt: Date | null;
  runCount: number;
  createdAt: Date;
  creator: Pick<UserProfile, "id" | "name" | "image">;
  _count: {
    executions: number;
  };
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  order: number;
  parentId: string | null;
  x: number;
  y: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  type: TriggerType;
  config: Record<string, unknown>;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowAction {
  id: string;
  workflowId: string;
  stepId: string | null;
  type: ActionType;
  name: string;
  config: Record<string, unknown>;
  order: number;
  condition: Record<string, unknown> | null;
  timeoutMs: number | null;
  retryPolicy: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  tags?: string[];
  config?: Record<string, unknown>;
  isTemplate?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  scheduleCron?: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string | null;
  status?: WorkflowStatus;
  tags?: string[];
  config?: Record<string, unknown>;
  isTemplate?: boolean;
  isPublished?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  scheduleCron?: string | null;
}

export interface WorkflowStepInput {
  name: string;
  type: string;
  config?: Record<string, unknown>;
  order?: number;
  parentId?: string | null;
  x?: number;
  y?: number;
}

export interface WorkflowTriggerInput {
  type: TriggerType;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface WorkflowActionInput {
  type: ActionType;
  name: string;
  config?: Record<string, unknown>;
  order?: number;
  condition?: Record<string, unknown> | null;
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
}

export interface WorkflowCanvasPosition {
  x: number;
  y: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

export interface WorkflowGraph {
  nodes: WorkflowStep[];
  edges: WorkflowEdge[];
}

// ============ EXECUTION TYPES ============

export interface Execution {
  id: string;
  workflowId: string;
  userId: string | null;
  status: ExecutionStatus;
  triggerData: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  runNumber: number;
  isDeleted: boolean;
  metadata: Record<string, unknown> | null;
}

export interface ExecutionWithDetails extends Execution {
  workflow: Pick<Workflow, "id" | "name" | "status">;
  user: Pick<UserProfile, "id" | "name" | "email"> | null;
  logs: ExecutionLog[];
  errors: ExecutionError[];
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  stepId: string | null;
  level: string;
  message: string;
  data: Record<string, unknown> | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface ExecutionError {
  id: string;
  executionId: string;
  stepId: string | null;
  code: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ExecutionSummary {
  id: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  runNumber: number;
  workflow: Pick<Workflow, "id" | "name">;
}

export interface TriggerExecutionInput {
  triggerData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ExecutionStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  averageDurationMs: number;
  successRate: number;
}

// ============ INTEGRATION TYPES ============

export interface Integration {
  id: string;
  organizationId: string;
  name: string;
  type: IntegrationType;
  description: string | null;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface IntegrationWithConfigs extends Integration {
  configs: IntegrationConfig[];
}

export interface IntegrationConfig {
  id: string;
  integrationId: string;
  key: string;
  value: Record<string, unknown>;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIntegrationInput {
  name: string;
  type: IntegrationType;
  description?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

export interface UpdateIntegrationInput {
  name?: string;
  description?: string | null;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  isActive?: boolean;
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  latencyMs: number;
}

// ============ AI TYPES ============

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  model: string;
  systemPrompt: string | null;
  temperature: number;
  maxTokens: number;
  config: Record<string, unknown> | null;
  organizationId: string | null;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface AIAgentWithPrompts extends AIAgent {
  prompts: AIPrompt[];
  _count: {
    runs: number;
  };
}

export interface AIPrompt {
  id: string;
  agentId: string;
  name: string;
  template: string;
  variables: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIRun {
  id: string;
  agentId: string;
  userId: string;
  promptId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  model: string;
  tokensUsed: number | null;
  costCents: number | null;
  latencyMs: number | null;
  status: string;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateAIAgentInput {
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  config?: Record<string, unknown>;
}

export interface RunAIAgentInput {
  prompt: string;
  promptId?: string;
  variables?: Record<string, string>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIAgentResponse {
  content: string;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  costCents: number;
  latencyMs: number;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ============ DATA SOURCE TYPES ============

export interface DataSource {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  schemaId: string | null;
  isActive: boolean;
  lastSyncAt: Date | null;
  recordCount: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface DataSourceWithRecords extends DataSource {
  schema: DataSchema | null;
  records: DataRecord[];
}

export interface DataSchema {
  id: string;
  name: string;
  version: string;
  fields: Record<string, unknown>;
  indexes: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataRecord {
  id: string;
  dataSourceId: string;
  externalId: string | null;
  data: Record<string, unknown>;
  status: DataRecordStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface CreateDataSourceInput {
  name: string;
  type: string;
  config?: Record<string, unknown>;
  schemaId?: string;
}

export interface UpdateDataSourceInput {
  name?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpsertDataRecordInput {
  externalId?: string;
  data: Record<string, unknown>;
  status?: DataRecordStatus;
  expiresAt?: string;
}

// ============ WEBHOOK TYPES ============

export interface Webhook {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: WebhookStatus;
  lastTriggeredAt: Date | null;
  failureCount: number;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface WebhookWithOrg extends Webhook {
  organization: Pick<Organization, "id" | "name" | "slug">;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  config?: Record<string, unknown>;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  status?: WebhookStatus;
  config?: Record<string, unknown>;
}

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  durationMs: number;
}

// ============ API KEY TYPES ============

export interface APIKey {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  key: string;
  keyPrefix: string;
  scopes: string[];
  status: APIKeyStatus;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  rateLimit: number;
  createdAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface APIKeyWithOrg extends APIKey {
  organization: Pick<Organization, "id" | "name" | "slug">;
  user: Pick<UserProfile, "id" | "name" | "email">;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  expiresAt?: string;
  rateLimit?: number;
}

// ============ AUDIT LOG TYPES ============

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogWithUser extends AuditLog {
  user: Pick<UserProfile, "id" | "name" | "email" | "image"> | null;
}

export interface AuditLogFilter {
  action?: AuditAction;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// ============ NOTIFICATION TYPES ============

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationWithUser extends Notification {
  user: Pick<UserProfile, "id" | "name" | "email">;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// ============ SUBSCRIPTION TYPES ============

export interface Subscription {
  id: string;
  organizationId: string;
  userId: string;
  stripeId: string | null;
  stripeCustomerId: string | null;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
  monthlyExecQuota: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionWithOrg extends Subscription {
  organization: Pick<Organization, "id" | "name" | "slug">;
}

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: number;
  description?: string;
}

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeature[];
  executionQuota: number;
  storageGB: number;
  teamMembers: number;
}

// ============ USAGE METRIC TYPES ============

export interface UsageMetric {
  id: string;
  organizationId: string;
  userId: string | null;
  metricType: string;
  quantity: number;
  periodStart: Date;
  periodEnd: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageSummary {
  executions: number;
  apiCalls: number;
  storageBytes: number;
  aiTokens: number;
  periodStart: Date;
  periodEnd: Date;
}

// ============ API RESPONSE TYPES ============

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
}

export interface ApiMeta {
  timestamp: string;
  requestId?: string;
  duration?: number;
  pagination?: PaginationMeta;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
  meta: ApiMeta & {
    pagination: PaginationMeta;
  };
}

export type ApiSuccessResponse<T> = ApiResponse<T> & { success: true; data: T };
export type ApiErrorResponse = ApiResponse<never> & { success: false; error: ApiError };

// ============ FORM TYPES ============

export interface FormState<T = Record<string, unknown>> {
  data: T;
  errors: Record<string, string[]>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  submitCount: number;
}

export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: FormFieldError[];
}

// ============ HOOK TYPES ============

export interface UseQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

export interface UseMutationOptions<T, V> {
  onSuccess?: (data: T, variables: V) => void;
  onError?: (error: ApiError, variables: V) => void;
  onSettled?: (data: T | undefined, error: ApiError | undefined, variables: V) => void;
}

export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | undefined;
  refetch: () => void;
}

export interface MutationResult<T, V> {
  mutate: (variables: V) => void;
  mutateAsync: (variables: V) => Promise<T>;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | undefined;
  data: T | undefined;
  reset: () => void;
}

// ============ COMPONENT TYPES ============

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends ComponentProps {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "link" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export interface ModalProps extends ComponentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessorKey: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: number;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onSort?: (field: string, order: SortOrder) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

// ============ CHART TYPES ============

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface ChartProps {
  data: ChartDataPoint[] | TimeSeriesPoint[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

// ============ WORKFLOW BUILDER TYPES ============

export interface WorkflowNode {
  id: string;
  type: string;
  position: WorkflowCanvasPosition;
  data: Record<string, unknown>;
  selected?: boolean;
  dragging?: boolean;
}

export interface WorkflowEdgeData {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
  data?: Record<string, unknown>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdgeData[];
  tags: string[];
  thumbnail?: string;
}

// ============ SEARCH TYPES ============

export interface SearchResult {
  id: string;
  type: "workflow" | "execution" | "integration" | "data_source" | "user";
  title: string;
  description: string;
  url: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface SearchFilters {
  types?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  organizationId?: string;
}

// ============ EXPORT TYPES ============

export interface ExportOptions {
  format: "json" | "csv" | "xlsx";
  includeMetadata: boolean;
  filters?: Record<string, unknown>;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ExportResult {
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  expiresAt: Date;
}

// ============ UTILITY TYPES ============

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredPick<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
export type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

export type ExtractArrayType<T> = T extends Array<infer U> ? U : T;

export type WithoutNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
    { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

export type RequireExactlyOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
    { [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>> }[Keys];

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type Immutable<T> = { readonly [P in keyof T]: T[P] };

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

export type PromiseType<T> = T extends Promise<infer U> ? U : T;

export type ConditionalType<T, U, TrueResult, FalseResult> =
  T extends U ? TrueResult : FalseResult;
