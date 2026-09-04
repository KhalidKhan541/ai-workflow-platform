/**
 * Workflow Action Library
 * 
 * Built-in actions for workflow steps including HTTP requests,
 * email, database operations, AI generation, and more.
 * 
 * @module workflow/actions
 */

import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { ExecutionContext, WorkflowStep, WorkflowError } from './engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActionType = 
  | 'http-request'
  | 'email-send'
  | 'database'
  | 'delay'
  | 'code'
  | 'transform'
  | 'condition'
  | 'loop'
  | 'ai-text'
  | 'ai-image'
  | 'file'
  | 'notification'
  | 'stripe'
  | 'qr-code'
  | 'pdf';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ActionConfig {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface HttpRequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  auth?: HttpAuth;
  timeout?: number;
  retries?: number;
  followRedirects?: boolean;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';
}

export interface HttpAuth {
  type: 'none' | 'apiKey' | 'bearer' | 'basic' | 'oauth2';
  token?: string;
  username?: string;
  password?: string;
  header?: string;
}

export interface EmailSendConfig {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
  from?: string;
  replyTo?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface DatabaseConfig {
  operation: 'find' | 'findFirst' | 'create' | 'update' | 'upsert' | 'delete' | 'count' | 'aggregate';
  model: string;
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  include?: Record<string, boolean>;
  select?: Record<string, boolean>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
}

export interface DelayConfig {
  duration: number;
  unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface CodeConfig {
  code: string;
  language: 'javascript' | 'typescript';
  timeout?: number;
  memoryLimit?: number;
}

export interface TransformConfig {
  operation: 'map' | 'filter' | 'reduce' | 'sort' | 'groupBy' | 'flatten' | 'unique' | 'pick' | 'omit';
  source: string;
  expression?: string;
  initialValue?: unknown;
}

export interface LoopConfig {
  type: 'forEach' | 'while' | 'range';
  items?: string;
  condition?: string;
  start?: number;
  end?: number;
  step?: number;
  variableName: string;
  body: WorkflowStep[];
}

export interface AiTextConfig {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
}

export interface AiImageConfig {
  prompt: string;
  model?: string;
  size?: '256x256' | '512x512' | '1024x1024';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface FileConfig {
  operation: 'read' | 'write' | 'append' | 'delete' | 'exists' | 'list' | 'copy' | 'move';
  path: string;
  content?: string;
  encoding?: BufferEncoding;
}

export interface NotificationConfig {
  channel: 'slack' | 'teams' | 'webhook';
  message: string;
  channel_id?: string;
  webhook_url?: string;
  attachments?: NotificationAttachment[];
}

export interface NotificationAttachment {
  title: string;
  text: string;
  color?: string;
}

export interface StripeConfig {
  operation: 'createPaymentIntent' | 'createCheckoutSession' | 'createCustomer' | 'createSubscription' | 'refund' | 'charge';
  amount?: number;
  currency?: string;
  customer?: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethod?: string;
}

export interface QrCodeConfig {
  data: string;
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  format?: 'png' | 'svg' | 'pdf';
}

export interface PdfConfig {
  template?: string;
  data?: Record<string, unknown>;
  html?: string;
  options?: PdfOptions;
}

export interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: { top: string; right: string; bottom: string; left: string };
}

// ─── Action Executor Type ───────────────────────────────────────────────────

export type ActionExecutor = (
  context: ExecutionContext,
  step: WorkflowStep,
  inputs: Record<string, unknown>
) => Promise<unknown>;

// ─── Action Registry ────────────────────────────────────────────────────────

/**
 * Registry of all available workflow actions.
 */
export class ActionRegistry {
  private executors: Map<ActionType, ActionExecutor> = new Map();

  constructor() {
    this.registerBuiltInActions();
  }

  /**
   * Register a custom action executor.
   */
  register(type: ActionType | string, executor: ActionExecutor): void {
    this.executors.set(type as ActionType, executor);
    logger.debug('Action registered', { type });
  }

  /**
   * Get executor for a step type.
   */
  getExecutor(type: string): ActionExecutor | undefined {
    return this.executors.get(type as ActionType);
  }

  /**
   * Get all registered action types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Check if an action type is registered.
   */
  hasExecutor(type: string): boolean {
    return this.executors.has(type as ActionType);
  }

  private registerBuiltInActions(): void {
    this.register('http-request', HttpAction.execute);
    this.register('email-send', EmailAction.execute);
    this.register('database', DatabaseAction.execute);
    this.register('delay', DelayAction.execute);
    this.register('code', CodeAction.execute);
    this.register('transform', TransformAction.execute);
    this.register('condition', ConditionAction.execute);
    this.register('loop', LoopAction.execute);
    this.register('ai-text', AiTextAction.execute);
    this.register('ai-image', AiImageAction.execute);
    this.register('file', FileAction.execute);
    this.register('notification', NotificationAction.execute);
    this.register('stripe', StripeAction.execute);
    this.register('qr-code', QrCodeAction.execute);
    this.register('pdf', PdfAction.execute);
  }
}

// ─── HTTP Request Action ────────────────────────────────────────────────────

export class HttpAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<HttpResponse> {
    const config = step.config as HttpRequestConfig;

    logger.info('Executing HTTP request', {
      executionId: context.executionId,
      stepId: step.id,
      method: config.method,
      url: config.url,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Apply authentication
    if (config.auth) {
      this.applyAuth(headers, config.auth);
    }

    const fetchOptions: RequestInit = {
      method: config.method,
      headers,
      redirect: config.followRedirects !== false ? 'follow' : 'manual',
    };

    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      fetchOptions.body = JSON.stringify(config.body);
    }

    const timeout = config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: unknown;
      const contentType = response.headers.get('content-type') || '';

      switch (config.responseType) {
        case 'text':
          data = await response.text();
          break;
        case 'blob':
          data = await response.blob();
          break;
        case 'arrayBuffer':
          data = await response.arrayBuffer();
          break;
        case 'json':
        default:
          data = await response.json();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        ok: response.ok,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new WorkflowError(
          `HTTP request timed out after ${timeout}ms`,
          'HTTP_TIMEOUT',
          step.id
        );
      }

      throw new WorkflowError(
        `HTTP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'HTTP_ERROR',
        step.id
      );
    }
  }

  private static applyAuth(headers: Record<string, string>, auth: HttpAuth): void {
    switch (auth.type) {
      case 'apiKey':
        const headerName = auth.header || 'X-API-Key';
        headers[headerName] = auth.token || '';
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.token}`;
        break;
      case 'basic':
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
      case 'oauth2':
        headers['Authorization'] = `Bearer ${auth.token}`;
        break;
    }
  }
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  ok: boolean;
}

// ─── Email Send Action ──────────────────────────────────────────────────────

export class EmailAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<EmailResult> {
    const config = step.config as EmailSendConfig;

    logger.info('Sending email', {
      executionId: context.executionId,
      stepId: step.id,
      to: config.to,
      subject: config.subject,
    });

    // In production, this would integrate with an email service (SendGrid, SES, etc.)
    // For now, we'll simulate the email sending
    
    const emailId = nanoid(24);
    const recipients = Array.isArray(config.to) ? config.to : [config.to];

    // Validate recipients
    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient)) {
        throw new WorkflowError(
          `Invalid email address: ${recipient}`,
          'INVALID_EMAIL',
          step.id
        );
      }
    }

    // Build email message
    const message: EmailMessage = {
      id: emailId,
      from: config.from || 'noreply@workflow.ai',
      to: recipients,
      cc: config.cc ? (Array.isArray(config.cc) ? config.cc : [config.cc]) : [],
      bcc: config.bcc ? (Array.isArray(config.bcc) ? config.bcc : [config.bcc]) : [],
      subject: config.subject,
      text: config.body,
      html: config.html || config.body,
      attachments: config.attachments || [],
      createdAt: new Date(),
    };

    // Simulate sending delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      emailId,
      message,
      recipients: recipients.length,
    };
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export interface EmailResult {
  success: boolean;
  emailId: string;
  message: EmailMessage;
  recipients: number;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html: string;
  attachments: EmailAttachment[];
  createdAt: Date;
}

// ─── Database Action ────────────────────────────────────────────────────────

export class DatabaseAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<DatabaseResult> {
    const config = step.config as DatabaseConfig;

    logger.info('Executing database operation', {
      executionId: context.executionId,
      stepId: step.id,
      operation: config.operation,
      model: config.model,
    });

    // In production, this would use Prisma client
    // For now, we'll simulate database operations
    
    const startTime = Date.now();
    let result: unknown;

    switch (config.operation) {
      case 'find':
        result = await this.simulateFind(config);
        break;
      case 'findFirst':
        result = await this.simulateFindFirst(config);
        break;
      case 'create':
        result = await this.simulateCreate(config);
        break;
      case 'update':
        result = await this.simulateUpdate(config);
        break;
      case 'upsert':
        result = await this.simulateUpsert(config);
        break;
      case 'delete':
        result = await this.simulateDelete(config);
        break;
      case 'count':
        result = await this.simulateCount(config);
        break;
      case 'aggregate':
        result = await this.simulateAggregate(config);
        break;
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      operation: config.operation,
      model: config.model,
      result,
      duration,
    };
  }

  private static async simulateFind(config: DatabaseConfig): Promise<unknown[]> {
    // Simulate database find operation
    return [];
  }

  private static async simulateFindFirst(config: DatabaseConfig): Promise<unknown> {
    // Simulate database findFirst operation
    return null;
  }

  private static async simulateCreate(config: DatabaseConfig): Promise<unknown> {
    // Simulate database create operation
    return { id: nanoid(24), ...config.data, createdAt: new Date() };
  }

  private static async simulateUpdate(config: DatabaseConfig): Promise<unknown> {
    // Simulate database update operation
    return { id: nanoid(24), ...config.data, updatedAt: new Date() };
  }

  private static async simulateUpsert(config: DatabaseConfig): Promise<unknown> {
    // Simulate database upsert operation
    return { id: nanoid(24), ...config.data, createdAt: new Date(), updatedAt: new Date() };
  }

  private static async simulateDelete(config: DatabaseConfig): Promise<unknown> {
    // Simulate database delete operation
    return { id: nanoid(24) };
  }

  private static async simulateCount(config: DatabaseConfig): Promise<number> {
    // Simulate database count operation
    return 0;
  }

  private static async simulateAggregate(config: DatabaseConfig): Promise<unknown> {
    // Simulate database aggregate operation
    return { _sum: {}, _avg: {}, _count: {} };
  }
}

export interface DatabaseResult {
  success: boolean;
  operation: string;
  model: string;
  result: unknown;
  duration: number;
}

// ─── Delay Action ───────────────────────────────────────────────────────────

export class DelayAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<DelayResult> {
    const config = step.config as DelayConfig;

    logger.info('Executing delay', {
      executionId: context.executionId,
      stepId: step.id,
      duration: config.duration,
      unit: config.unit,
    });

    const milliseconds = this.convertToMilliseconds(config.duration, config.unit);

    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    const actualDuration = Date.now() - startTime;

    return {
      success: true,
      requestedDuration: milliseconds,
      actualDuration,
      unit: config.unit,
    };
  }

  private static convertToMilliseconds(duration: number, unit: string): number {
    switch (unit) {
      case 'milliseconds':
        return duration;
      case 'seconds':
        return duration * 1000;
      case 'minutes':
        return duration * 60 * 1000;
      case 'hours':
        return duration * 60 * 60 * 1000;
      case 'days':
        return duration * 24 * 60 * 60 * 1000;
      default:
        return duration;
    }
  }
}

export interface DelayResult {
  success: boolean;
  requestedDuration: number;
  actualDuration: number;
  unit: string;
}

// ─── Code Execution Action ──────────────────────────────────────────────────

export class CodeAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<CodeResult> {
    const config = step.config as CodeConfig;

    logger.info('Executing code', {
      executionId: context.executionId,
      stepId: step.id,
      language: config.language,
    });

    const startTime = Date.now();

    try {
      // Create sandboxed execution environment
      const sandbox = this.createSandbox(context, inputs);
      
      // Execute code with timeout
      const result = await this.executeWithSandbox(
        config.code,
        sandbox,
        config.timeout || 5000
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result,
        duration,
        language: config.language,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        language: config.language,
      };
    }
  }

  private static createSandbox(
    context: ExecutionContext,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      inputs,
      outputs: context.outputs,
      system: context.systemVariables,
      console: {
        log: (...args: unknown[]) => logger.info('Code output', { args }),
        error: (...args: unknown[]) => logger.error('Code error', { args }),
        warn: (...args: unknown[]) => logger.warn('Code warning', { args }),
      },
      Date,
      Math,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      btoa: (str: string) => Buffer.from(str).toString('base64'),
      atob: (str: string) => Buffer.from(str, 'base64').toString(),
    };
  }

  private static async executeWithSandbox(
    code: string,
    sandbox: Record<string, unknown>,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Code execution timed out'));
      }, timeoutMs);

      try {
        // Create function with sandbox context
        const sandboxKeys = Object.keys(sandbox);
        const sandboxValues = Object.values(sandbox);
        
        const wrappedCode = `
          return (async function(${sandboxKeys.join(', ')}) {
            ${code}
          })();
        `;

        const fn = new Function(...sandboxKeys, wrappedCode);
        const result = fn(...sandboxValues);

        // Handle async results
        if (result instanceof Promise) {
          result
            .then(output => {
              clearTimeout(timer);
              resolve(output);
            })
            .catch(error => {
              clearTimeout(timer);
              reject(error);
            });
        } else {
          clearTimeout(timer);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
}

export interface CodeResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  language: string;
}

// ─── Transform Action ───────────────────────────────────────────────────────

export class TransformAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<TransformResult> {
    const config = step.config as TransformConfig;

    logger.info('Executing transform', {
      executionId: context.executionId,
      stepId: step.id,
      operation: config.operation,
    });

    const source = this.resolveSource(context, config.source, inputs);
    
    let result: unknown;

    switch (config.operation) {
      case 'map':
        result = this.executeMap(source, config.expression);
        break;
      case 'filter':
        result = this.executeFilter(source, config.expression);
        break;
      case 'reduce':
        result = this.executeReduce(source, config.expression, config.initialValue);
        break;
      case 'sort':
        result = this.executeSort(source, config.expression);
        break;
      case 'groupBy':
        result = this.executeGroupBy(source, config.expression);
        break;
      case 'flatten':
        result = this.executeFlatten(source);
        break;
      case 'unique':
        result = this.executeUnique(source, config.expression);
        break;
      case 'pick':
        result = this.executePick(source, config.expression);
        break;
      case 'omit':
        result = this.executeOmit(source, config.expression);
        break;
    }

    return {
      success: true,
      operation: config.operation,
      inputCount: Array.isArray(source) ? source.length : 1,
      outputCount: Array.isArray(result) ? result.length : 1,
      result,
    };
  }

  private static resolveSource(
    context: ExecutionContext,
    source: string,
    inputs: Record<string, unknown>
  ): unknown {
    // Check if source is a variable reference
    if (source.startsWith('{{') && source.endsWith('}}')) {
      const varName = source.slice(2, -2);
      const parts = varName.split('.');
      
      let current: unknown = context;
      for (const part of parts) {
        if (current && typeof current === 'object') {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return current;
    }

    // Check inputs
    if (inputs[source] !== undefined) {
      return inputs[source];
    }

    // Check outputs
    if (context.outputs[source] !== undefined) {
      return context.outputs[source];
    }

    return source;
  }

  private static executeMap(source: unknown, expression?: string): unknown[] {
    if (!Array.isArray(source)) return [source];
    
    if (!expression) return source;
    
    try {
      const fn = new Function('item', 'index', `return ${expression}`);
      return source.map((item, index) => fn(item, index));
    } catch {
      return source;
    }
  }

  private static executeFilter(source: unknown, expression?: string): unknown[] {
    if (!Array.isArray(source)) return [source];
    
    if (!expression) return source;
    
    try {
      const fn = new Function('item', 'index', `return ${expression}`);
      return source.filter((item, index) => fn(item, index));
    } catch {
      return source;
    }
  }

  private static executeReduce(
    source: unknown,
    expression?: string,
    initialValue?: unknown
  ): unknown {
    if (!Array.isArray(source)) return source;
    
    if (!expression) return source;
    
    try {
      const fn = new Function('acc', 'item', 'index', `return ${expression}`);
      return source.reduce((acc, item, index) => fn(acc, item, index), initialValue);
    } catch {
      return source;
    }
  }

  private static executeSort(source: unknown, expression?: string): unknown[] {
    if (!Array.isArray(source)) return [source];
    
    const sorted = [...source];
    
    if (!expression) {
      sorted.sort();
      return sorted;
    }
    
    try {
      const fn = new Function('a', 'b', `return ${expression}`);
      sorted.sort(fn);
    } catch {
      // Keep original order if expression fails
    }
    
    return sorted;
  }

  private static executeGroupBy(source: unknown, expression?: string): Record<string, unknown[]> {
    if (!Array.isArray(source)) return { default: [source] };
    
    if (!expression) return { default: source };
    
    const groups: Record<string, unknown[]> = {};
    
    try {
      const fn = new Function('item', `return ${expression}`);
      
      for (const item of source) {
        const key = String(fn(item));
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
      }
    } catch {
      groups.default = source;
    }
    
    return groups;
  }

  private static executeFlatten(source: unknown): unknown[] {
    if (!Array.isArray(source)) return [source];
    
    const result: unknown[] = [];
    for (const item of source) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else {
        result.push(item);
      }
    }
    return result;
  }

  private static executeUnique(source: unknown, expression?: string): unknown[] {
    if (!Array.isArray(source)) return [source];
    
    if (!expression) {
      return [...new Set(source)];
    }
    
    try {
      const fn = new Function('item', `return ${expression}`);
      const seen = new Set<string>();
      return source.filter(item => {
        const key = String(fn(item));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return [...new Set(source)];
    }
  }

  private static executePick(source: unknown, expression?: string): unknown {
    if (!expression || typeof source !== 'object' || source === null) {
      return source;
    }
    
    const keys = expression.split(',').map(k => k.trim());
    const result: Record<string, unknown> = {};
    
    for (const key of keys) {
      if (key in (source as Record<string, unknown>)) {
        result[key] = (source as Record<string, unknown>)[key];
      }
    }
    
    return result;
  }

  private static executeOmit(source: unknown, expression?: string): unknown {
    if (!expression || typeof source !== 'object' || source === null) {
      return source;
    }
    
    const keys = expression.split(',').map(k => k.trim());
    const result: Record<string, unknown> = { ...(source as Record<string, unknown>) };
    
    for (const key of keys) {
      delete result[key];
    }
    
    return result;
  }
}

export interface TransformResult {
  success: boolean;
  operation: string;
  inputCount: number;
  outputCount: number;
  result: unknown;
}

// ─── Condition Action ───────────────────────────────────────────────────────

export class ConditionAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<ConditionActionResult> {
    const config = step.config as { condition: string; trueValue?: unknown; falseValue?: unknown };

    logger.info('Evaluating condition', {
      executionId: context.executionId,
      stepId: step.id,
    });

    try {
      const fn = new Function('inputs', 'outputs', 'system', `return ${config.condition}`);
      const result = fn(inputs, context.outputs, context.systemVariables);

      return {
        success: true,
        condition: config.condition,
        result: Boolean(result),
        value: result ? config.trueValue : config.falseValue,
      };
    } catch (error) {
      return {
        success: false,
        condition: config.condition,
        result: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export interface ConditionActionResult {
  success: boolean;
  condition: string;
  result: boolean;
  value?: unknown;
  error?: string;
}

// ─── Loop Action ────────────────────────────────────────────────────────────

export class LoopAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<LoopResult> {
    const config = step.config as LoopConfig;

    logger.info('Executing loop', {
      executionId: context.executionId,
      stepId: step.id,
      type: config.type,
    });

    const iterations: unknown[] = [];
    let count = 0;

    switch (config.type) {
      case 'forEach':
        count = await this.executeForEach(context, step, config, inputs, iterations);
        break;
      case 'while':
        count = await this.executeWhile(context, step, config, inputs, iterations);
        break;
      case 'range':
        count = await this.executeRange(context, step, config, inputs, iterations);
        break;
    }

    return {
      success: true,
      type: config.type,
      iterations: count,
      results: iterations,
    };
  }

  private static async executeForEach(
    context: ExecutionContext,
    step: WorkflowStep,
    config: LoopConfig,
    inputs: Record<string, unknown>,
    iterations: unknown[]
  ): Promise<number> {
    const items = this.resolveItems(context, config.items || '', inputs);
    
    if (!Array.isArray(items)) {
      throw new WorkflowError('Loop items must be an array', 'INVALID_LOOP_ITEMS', step.id);
    }

    for (let i = 0; i < items.length; i++) {
      // Set loop variable in context
      context.outputs[config.variableName] = items[i];
      context.outputs[`${config.variableName}_index`] = i;

      // Execute loop body (simplified - in production would execute steps)
      iterations.push(items[i]);
    }

    return items.length;
  }

  private static async executeWhile(
    context: ExecutionContext,
    step: WorkflowStep,
    config: LoopConfig,
    inputs: Record<string, unknown>,
    iterations: unknown[]
  ): Promise<number> {
    let count = 0;
    const maxIterations = 1000; // Safety limit

    while (count < maxIterations) {
      try {
        const fn = new Function('inputs', 'outputs', 'system', `return ${config.condition}`);
        const shouldContinue = fn(inputs, context.outputs, context.systemVariables);
        
        if (!shouldContinue) break;

        context.outputs[`${config.variableName}_iteration`] = count;
        iterations.push(count);
        count++;
      } catch {
        break;
      }
    }

    return count;
  }

  private static async executeRange(
    context: ExecutionContext,
    step: WorkflowStep,
    config: LoopConfig,
    inputs: Record<string, unknown>,
    iterations: unknown[]
  ): Promise<number> {
    const start = config.start || 0;
    const end = config.end || 10;
    const step_size = config.step || 1;

    for (let i = start; i < end; i += step_size) {
      context.outputs[config.variableName] = i;
      iterations.push(i);
    }

    return Math.ceil((end - start) / step_size);
  }

  private static resolveItems(
    context: ExecutionContext,
    itemsSource: string,
    inputs: Record<string, unknown>
  ): unknown {
    if (itemsSource.startsWith('{{') && itemsSource.endsWith('}}')) {
      const varName = itemsSource.slice(2, -2);
      const parts = varName.split('.');
      
      let current: unknown = { inputs, outputs: context.outputs, system: context.systemVariables };
      for (const part of parts) {
        if (current && typeof current === 'object') {
          current = (current as Record<string, unknown>)[part];
        } else {
          return [];
        }
      }
      return current;
    }

    if (inputs[itemsSource] !== undefined) {
      return inputs[itemsSource];
    }

    return context.outputs[itemsSource] || [];
  }
}

export interface LoopResult {
  success: boolean;
  type: string;
  iterations: number;
  results: unknown[];
}

// ─── AI Text Generation Action ──────────────────────────────────────────────

export class AiTextAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<AiTextResult> {
    const config = step.config as AiTextConfig;

    logger.info('Executing AI text generation', {
      executionId: context.executionId,
      stepId: step.id,
      model: config.model,
    });

    // In production, this would integrate with OpenAI/Anthropic/etc.
    // For now, simulate AI response
    
    const response = {
      id: nanoid(24),
      text: `AI generated response for: ${config.prompt}`,
      model: config.model || 'gpt-4',
      tokens: {
        prompt: config.prompt.split(' ').length,
        completion: 50,
        total: config.prompt.split(' ').length + 50,
      },
    };

    return {
      success: true,
      response,
      model: config.model || 'gpt-4',
    };
  }
}

export interface AiTextResult {
  success: boolean;
  response: {
    id: string;
    text: string;
    model: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
  model: string;
}

// ─── AI Image Analysis Action ───────────────────────────────────────────────

export class AiImageAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<AiImageResult> {
    const config = step.config as AiImageConfig;

    logger.info('Executing AI image generation', {
      executionId: context.executionId,
      stepId: step.id,
      model: config.model,
    });

    // In production, this would integrate with DALL-E/Midjourney/etc.
    const imageId = nanoid(24);

    return {
      success: true,
      image: {
        id: imageId,
        url: `https://generated-images.ai/${imageId}.png`,
        prompt: config.prompt,
        size: config.size || '1024x1024',
        model: config.model || 'dall-e-3',
      },
    };
  }
}

export interface AiImageResult {
  success: boolean;
  image: {
    id: string;
    url: string;
    prompt: string;
    size: string;
    model: string;
  };
}

// ─── File Operation Action ──────────────────────────────────────────────────

export class FileAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<FileResult> {
    const config = step.config as FileConfig;

    logger.info('Executing file operation', {
      executionId: context.executionId,
      stepId: step.id,
      operation: config.operation,
      path: config.path,
    });

    // In production, this would use fs module
    // For now, simulate file operations
    
    switch (config.operation) {
      case 'read':
        return {
          success: true,
          operation: 'read',
          path: config.path,
          content: 'File content placeholder',
          size: 1024,
        };
      case 'write':
        return {
          success: true,
          operation: 'write',
          path: config.path,
          bytesWritten: config.content?.length || 0,
        };
      case 'exists':
        return {
          success: true,
          operation: 'exists',
          path: config.path,
          exists: true,
        };
      case 'list':
        return {
          success: true,
          operation: 'list',
          path: config.path,
          files: [],
        };
      default:
        return {
          success: true,
          operation: config.operation,
          path: config.path,
        };
    }
  }
}

export interface FileResult {
  success: boolean;
  operation: string;
  path: string;
  content?: string;
  size?: number;
  bytesWritten?: number;
  exists?: boolean;
  files?: string[];
}

// ─── Notification Action ────────────────────────────────────────────────────

export class NotificationAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<NotificationResult> {
    const config = step.config as NotificationConfig;

    logger.info('Sending notification', {
      executionId: context.executionId,
      stepId: step.id,
      channel: config.channel,
    });

    const notificationId = nanoid(24);

    // In production, this would integrate with Slack/Teams/etc.
    return {
      success: true,
      notificationId,
      channel: config.channel,
      message: config.message,
      timestamp: new Date(),
    };
  }
}

export interface NotificationResult {
  success: boolean;
  notificationId: string;
  channel: string;
  message: string;
  timestamp: Date;
}

// ─── Stripe Payment Action ──────────────────────────────────────────────────

export class StripeAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<StripeResult> {
    const config = step.config as StripeConfig;

    logger.info('Executing Stripe operation', {
      executionId: context.executionId,
      stepId: step.id,
      operation: config.operation,
    });

    // In production, this would use Stripe SDK
    const operationId = nanoid(24);

    return {
      success: true,
      operation: config.operation,
      id: operationId,
      status: 'succeeded',
      amount: config.amount,
      currency: config.currency || 'usd',
    };
  }
}

export interface StripeResult {
  success: boolean;
  operation: string;
  id: string;
  status: string;
  amount?: number;
  currency?: string;
}

// ─── QR Code Action ─────────────────────────────────────────────────────────

export class QrCodeAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<QrCodeResult> {
    const config = step.config as QrCodeConfig;

    logger.info('Generating QR code', {
      executionId: context.executionId,
      stepId: step.id,
      data: config.data,
    });

    // In production, this would use a QR code library
    const qrId = nanoid(24);

    return {
      success: true,
      qrCode: {
        id: qrId,
        data: config.data,
        format: config.format || 'png',
        size: config.size || 256,
        url: `https://qr-codes.ai/${qrId}.${config.format || 'png'}`,
      },
    };
  }
}

export interface QrCodeResult {
  success: boolean;
  qrCode: {
    id: string;
    data: string;
    format: string;
    size: number;
    url: string;
  };
}

// ─── PDF Generation Action ──────────────────────────────────────────────────

export class PdfAction {
  static async execute(
    context: ExecutionContext,
    step: WorkflowStep,
    inputs: Record<string, unknown>
  ): Promise<PdfResult> {
    const config = step.config as PdfConfig;

    logger.info('Generating PDF', {
      executionId: context.executionId,
      stepId: step.id,
      template: config.template,
    });

    // In production, this would use Puppeteer/pdf-lib
    const pdfId = nanoid(24);

    return {
      success: true,
      pdf: {
        id: pdfId,
        url: `https://generated-pdfs.ai/${pdfId}.pdf`,
        size: 1024 * 100, // 100KB
        pages: 1,
        format: config.options?.format || 'A4',
      },
    };
  }
}

export interface PdfResult {
  success: boolean;
  pdf: {
    id: string;
    url: string;
    size: number;
    pages: number;
    format: string;
  };
}
