/**
 * Workflow Engine Module
 * 
 * Core module for the AI-Powered Enterprise Workflow Automation Platform.
 * Provides workflow execution, triggers, actions, conditions, templates,
 * scheduling, and orchestration capabilities.
 * 
 * @module workflow
 */

// ─── Core Engine ────────────────────────────────────────────────────────────

export {
  WorkflowEngine,
  WorkflowError,
  WorkflowValidationError,
  WorkflowTimeoutError,
} from './engine';

export type {
  StepType,
  StepStatus,
  WorkflowStatus,
  RetryConfig,
  TimeoutConfig,
  WorkflowStep,
  ConditionDefinition,
  ComparisonCondition,
  ErrorHandlerConfig,
  NotificationConfig,
  WorkflowDefinition,
  TriggerDefinition,
  ExecutionContext,
  SystemVariables,
  StepState,
  WorkflowError as WorkflowErrorType,
  ExecutionTraceEntry,
  ExecutionResult,
  StepExecutionResult,
  ExecutionOptions,
  ExecutionProgress,
  ExecutionPlan,
  ValidationResult,
  ValidationError,
} from './engine';

// ─── Triggers ───────────────────────────────────────────────────────────────

export {
  TriggerManager,
  EmailParser,
  DatabaseTrigger,
  FileTrigger,
  PaymentTrigger,
} from './triggers';

export type {
  TriggerType,
  TriggerContext,
  TriggerResult,
  WebhookTriggerConfig,
  WebhookAuth,
  RateLimitConfig,
  CorsConfig,
  WebhookRequest,
  CronTriggerConfig,
  EventTriggerConfig,
  EventFilter,
  PollTriggerConfig,
  PollComparison,
  PollCredentials,
  EmailTriggerConfig,
  TriggerRegistration,
  TriggerEvent,
  TriggerStats,
  ParsedEmail,
  EmailAddress,
  EmailAttachment,
} from './triggers';

// ─── Actions ────────────────────────────────────────────────────────────────

export {
  ActionRegistry,
  HttpAction,
  EmailAction,
  DatabaseAction,
  DelayAction,
  CodeAction,
  TransformAction,
  ConditionAction,
  LoopAction,
  AiTextAction,
  AiImageAction,
  FileAction,
  NotificationAction,
  StripeAction,
  QrCodeAction,
  PdfAction,
} from './actions';

export type {
  ActionType,
  HttpMethod,
  ActionConfig,
  HttpRequestConfig,
  HttpAuth,
  EmailSendConfig,
  EmailAttachment as ActionEmailAttachment,
  DatabaseConfig,
  DelayConfig,
  CodeConfig,
  TransformConfig,
  LoopConfig,
  AiTextConfig,
  AiImageConfig,
  FileConfig,
  NotificationConfig as ActionNotificationConfig,
  NotificationAttachment,
  StripeConfig,
  QrCodeConfig,
  PdfConfig,
  PdfOptions,
  ActionExecutor,
  HttpResponse,
  EmailResult,
  EmailMessage,
  DatabaseResult,
  DelayResult,
  CodeResult,
  TransformResult,
  ConditionActionResult,
  LoopResult,
  AiTextResult,
  AiImageResult,
  FileResult,
  NotificationResult,
  StripeResult,
  QrCodeResult,
  PdfResult,
} from './actions';

// ─── Conditions ─────────────────────────────────────────────────────────────

export {
  ConditionEvaluator,
  ConditionPresets,
  ExpressionEvaluator,
} from './conditions';

export type {
  ComparisonOperator,
  LogicalOperator,
  StringOperator,
  ArrayOperator,
  DateOperator,
  NullOperator,
  OperatorType,
  ConditionContext,
  ConditionResult,
  ConditionDetail,
} from './conditions';

// ─── Variables ──────────────────────────────────────────────────────────────

export {
  VariableResolver,
  VariableTransformer,
  VariableValidator,
  TemplateEngine,
  SecretManager,
} from './variables';

export type {
  VariableType,
  Variable,
  VariableSet,
  InterpolationResult,
  VariableReference,
  EncryptedVariable,
  ValidationResult as VariableValidationResult,
  AllValidationResults,
  TemplateOptions,
  TemplateResult,
} from './variables';

// ─── Templates ──────────────────────────────────────────────────────────────

export {
  TemplateRegistry,
} from './templates';

export type {
  TemplateCategory,
  WorkflowTemplate,
  TemplateSearchResult,
} from './templates';

// ─── Scheduler ──────────────────────────────────────────────────────────────

export {
  CronScheduler,
  CronParser,
  TimezoneUtils,
  HolidayCalendar,
  CronParseError,
} from './scheduler';

export type {
  SchedulerStatus,
  ScheduledJob,
  JobConfig,
  JobRetryConfig,
  JobExecution,
  SchedulerStats,
  ScheduledJobHandler,
  JobContext,
  ValidationResult as CronValidationResult,
} from './scheduler';

// ─── Executor ───────────────────────────────────────────────────────────────

export {
  ExecutionOrchestrator,
  QueueManager,
  Worker,
  ResultAggregator,
  ExecutionMonitor,
} from './executor';

export type {
  ExecutorConfig,
  RedisConfig,
  ExecutionRequest,
  JobPriority,
  ExecutionMetadata,
  ExecutionProgress as ExecutorExecutionProgress,
  WorkerStats,
  QueueStats,
  ExecutionMetrics,
  AggregatedResults,
  ExecutionListener,
  MonitorStatus,
} from './executor';
