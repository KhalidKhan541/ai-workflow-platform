/**
 * Workflow Variable System
 * 
 * Manages variable resolution, interpolation, and secret handling
 * for workflow execution.
 * 
 * @module workflow/variables
 */

import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { SystemVariables } from './engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'secret' | 'computed';

export interface Variable {
  /** Variable name/key */
  name: string;
  /** Variable value */
  value: unknown;
  /** Variable type */
  type: VariableType;
  /** Whether this is a secret variable */
  isSecret: boolean;
  /** Description for documentation */
  description?: string;
  /** Default value if not provided */
  defaultValue?: unknown;
  /** Validation rules */
  validation?: VariableValidation;
}

export interface VariableValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
  custom?: string;
}

export interface VariableSet {
  id: string;
  name: string;
  description?: string;
  variables: Variable[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InterpolationResult {
  value: string;
  unresolved: string[];
  errors: string[];
}

export interface VariableReference {
  /** Full reference string like "{{step1.output.field}}" */
  full: string;
  /** Path parts like ['step1', 'output', 'field'] */
  path: string[];
  /** Is this a system variable */
  isSystem: boolean;
  /** Is this a secret variable */
  isSecret: boolean;
}

export interface EncryptedVariable {
  id: string;
  name: string;
  encryptedValue: string;
  iv: string;
  algorithm: string;
  createdAt: Date;
}

// ─── Variable Resolver ──────────────────────────────────────────────────────

/**
 * Resolves variable references in workflow definitions.
 */
export class VariableResolver {
  private variables: Map<string, Variable> = new Map();
  private encryptedVariables: Map<string, EncryptedVariable> = new Map();

  constructor() {
    this.registerBuiltInVariables();
  }

  /**
   * Register a variable.
   */
  register(variable: Variable): void {
    this.variables.set(variable.name, variable);
    logger.debug('Variable registered', { name: variable.name, type: variable.type });
  }

  /**
   * Unregister a variable.
   */
  unregister(name: string): void {
    this.variables.delete(name);
  }

  /**
   * Get a variable value.
   */
  get(name: string): unknown {
    const variable = this.variables.get(name);
    if (!variable) {
      return undefined;
    }

    if (variable.isSecret) {
      return this.decryptSecret(variable);
    }

    return variable.value;
  }

  /**
   * Set a variable value.
   */
  set(name: string, value: unknown, type: VariableType = 'string'): void {
    const existing = this.variables.get(name);
    
    if (existing) {
      existing.value = value;
      existing.type = type;
    } else {
      this.register({
        name,
        value,
        type,
        isSecret: false,
      });
    }
  }

  /**
   * Resolve all variables from different sources.
   */
  resolveAll(
    outputs: Record<string, unknown>,
    inputs: Record<string, unknown>,
    systemVariables: SystemVariables
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    // Add system variables
    resolved.timestamp = systemVariables.timestamp;
    resolved.isoDate = systemVariables.isoDate;
    resolved.random = systemVariables.random;
    resolved.executionId = systemVariables.executionId;
    resolved.workflowId = systemVariables.workflowId;
    resolved.workflowVersion = systemVariables.workflowVersion;
    resolved.env = systemVariables.env;

    // Add inputs
    resolved.inputs = inputs;

    // Add outputs
    resolved.outputs = outputs;

    // Add step outputs as top-level references
    for (const [stepId, output] of Object.entries(outputs)) {
      resolved[stepId] = output;
    }

    // Add registered variables
    for (const [name, variable] of this.variables) {
      if (!variable.isSecret) {
        resolved[name] = variable.value;
      }
    }

    return resolved;
  }

  /**
   * Interpolate a string with variable references.
   */
  interpolate(template: string, variables: Record<string, unknown>): string {
    const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
    
    return template.replace(VARIABLE_REGEX, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.resolvePath(trimmedPath, variables);
      
      if (value === undefined) {
        logger.warn('Unresolved variable reference', { path: trimmedPath });
        return match; // Keep original reference if unresolved
      }

      return this.serializeValue(value);
    });
  }

  /**
   * Interpolate with detailed result information.
   */
  interpolateWithDetails(
    template: string,
    variables: Record<string, unknown>
  ): InterpolationResult {
    const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
    const unresolved: string[] = [];
    const errors: string[] = [];

    const value = template.replace(VARIABLE_REGEX, (match, path) => {
      const trimmedPath = path.trim();
      
      try {
        const resolved = this.resolvePath(trimmedPath, variables);
        
        if (resolved === undefined) {
          unresolved.push(trimmedPath);
          return match;
        }

        return this.serializeValue(resolved);
      } catch (error) {
        errors.push(`Failed to resolve "${trimmedPath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        return match;
      }
    });

    return { value, unresolved, errors };
  }

  /**
   * Resolve a dot-notation path to a value.
   */
  resolvePath(path: string, variables: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = variables;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array index notation (e.g., "items[0]")
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  /**
   * Set a secret variable (encrypted at rest).
   */
  setSecret(name: string, value: string): void {
    const encrypted = this.encryptSecret(value);
    this.encryptedVariables.set(name, encrypted);
    
    this.register({
      name,
      value: null, // Actual value is encrypted
      type: 'secret',
      isSecret: true,
    });
  }

  /**
   * Get all variable names.
   */
  getVariableNames(): string[] {
    return Array.from(this.variables.keys());
  }

  /**
   * Get all variables.
   */
  getAllVariables(): Variable[] {
    return Array.from(this.variables.values());
  }

  /**
   * Clear all variables.
   */
  clear(): void {
    this.variables.clear();
    this.encryptedVariables.clear();
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private registerBuiltInVariables(): void {
    // System variables are handled in resolveAll
    // This method can be extended for additional built-in variables
  }

  private serializeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private encryptSecret(value: string): EncryptedVariable {
    // In production, use proper encryption (AES-256, etc.)
    // For now, use base64 as placeholder
    const iv = nanoid(16);
    const encrypted = Buffer.from(value).toString('base64');
    
    return {
      id: nanoid(24),
      name: '',
      encryptedValue: encrypted,
      iv,
      algorithm: 'aes-256-gcm',
      createdAt: new Date(),
    };
  }

  private decryptSecret(variable: Variable): unknown {
    const encrypted = this.encryptedVariables.get(variable.name);
    if (!encrypted) {
      return null;
    }

    // In production, use proper decryption
    // For now, use base64 as placeholder
    return Buffer.from(encrypted.encryptedValue, 'base64').toString();
  }
}

// ─── Variable Transformer ───────────────────────────────────────────────────

/**
 * Transforms variables between different formats and types.
 */
export class VariableTransformer {
  /**
   * Convert a flat object to nested object using dot notation.
   */
  static flattenToNested(flat: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(flat)) {
      this.setNestedValue(result, key, value);
    }

    return result;
  }

  /**
   * Convert a nested object to flat object using dot notation.
   */
  static nestedToFlat(nested: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(nested)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.nestedToFlat(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = value;
      }
    }

    return result;
  }

  /**
   * Set a nested value using dot notation path.
   */
  private static setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Type coercion for variable values.
   */
  static coerce(value: unknown, targetType: VariableType): unknown {
    switch (targetType) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        return Boolean(value);
      case 'object':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return {};
          }
        }
        return value;
      case 'array':
        if (Array.isArray(value)) {
          return value;
        }
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return [value];
          }
        }
        return [value];
      default:
        return value;
    }
  }

  /**
   * Merge multiple variable sets.
   */
  static merge(...sets: Record<string, unknown>[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const set of sets) {
      for (const [key, value] of Object.entries(set)) {
        if (value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }
}

// ─── Variable Validator ─────────────────────────────────────────────────────

/**
 * Validates variable values against rules.
 */
export class VariableValidator {
  /**
   * Validate a variable value.
   */
  static validate(
    value: unknown,
    validation: VariableValidation
  ): ValidationResult {
    const errors: string[] = [];

    // Required check
    if (validation.required && (value === null || value === undefined)) {
      errors.push('Value is required');
      return { valid: false, errors };
    }

    // Skip further validation if value is null/undefined and not required
    if (value === null || value === undefined) {
      return { valid: true, errors: [] };
    }

    const stringValue = String(value);
    const numValue = Number(value);

    // String validations
    if (validation.minLength !== undefined && stringValue.length < validation.minLength) {
      errors.push(`Minimum length is ${validation.minLength}`);
    }

    if (validation.maxLength !== undefined && stringValue.length > validation.maxLength) {
      errors.push(`Maximum length is ${validation.maxLength}`);
    }

    if (validation.pattern && !new RegExp(validation.pattern).test(stringValue)) {
      errors.push(`Value does not match pattern: ${validation.pattern}`);
    }

    // Number validations
    if (validation.min !== undefined && numValue < validation.min) {
      errors.push(`Minimum value is ${validation.min}`);
    }

    if (validation.max !== undefined && numValue > validation.max) {
      errors.push(`Maximum value is ${validation.max}`);
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      errors.push(`Value must be one of: ${validation.enum.join(', ')}`);
    }

    // Custom validation
    if (validation.custom) {
      try {
        const fn = new Function('value', validation.custom);
        const result = fn(value);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : 'Custom validation failed');
        }
      } catch (error) {
        errors.push(`Custom validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate multiple variables.
   */
  static validateAll(
    variables: Record<string, unknown>,
    validations: Record<string, VariableValidation>
  ): AllValidationResults {
    const results: Record<string, ValidationResult> = {};

    for (const [name, validation] of Object.entries(validations)) {
      results[name] = this.validate(variables[name], validation);
    }

    const allValid = Object.values(results).every(r => r.valid);

    return {
      valid: allValid,
      results,
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AllValidationResults {
  valid: boolean;
  results: Record<string, ValidationResult>;
}

// ─── Template Engine ────────────────────────────────────────────────────────

/**
 * Advanced template engine for workflow variables.
 */
export class TemplateEngine {
  /**
   * Process a template with variable interpolation.
   */
  static process(
    template: string,
    variables: Record<string, unknown>,
    options: TemplateOptions = {}
  ): TemplateResult {
    const {
      strict = false,
      defaultValue = '',
      transform = 'stringify',
    } = options;

    const errors: string[] = [];
    const usedVariables: string[] = [];

    const processed = template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      const trimmed = expression.trim();
      
      // Handle filters (e.g., "{{value | uppercase}}")
      const [varPath, ...filters] = trimmed.split('|').map((s: string) => s.trim());
      
      let value = VariableResolver.prototype.resolvePath.call(
        { resolvePath: VariableResolver.prototype.resolvePath },
        varPath,
        variables
      );

      usedVariables.push(varPath);

      // Apply filters
      for (const filter of filters) {
        value = this.applyFilter(value, filter);
      }

      if (value === undefined) {
        if (strict) {
          errors.push(`Variable "${varPath}" is undefined`);
          return defaultValue;
        }
        return defaultValue;
      }

      return this.formatValue(value, transform);
    });

    return {
      template: processed,
      usedVariables,
      errors,
    };
  }

  /**
   * Process conditional template blocks.
   */
  static processConditionals(
    template: string,
    variables: Record<string, unknown>
  ): string {
    // Process {{#if condition}}...{{/if}} blocks
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(ifRegex, (match, condition, content) => {
      const value = VariableResolver.prototype.resolvePath.call(
        { resolvePath: VariableResolver.prototype.resolvePath },
        condition.trim(),
        variables
      );

      return value ? content : '';
    });
  }

  /**
   * Process loop template blocks.
   */
  static processLoops(
    template: string,
    variables: Record<string, unknown>
  ): string {
    // Process {{#each items}}...{{/each}} blocks
    const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachRegex, (match, collectionPath, content) => {
      const collection = VariableResolver.prototype.resolvePath.call(
        { resolvePath: VariableResolver.prototype.resolvePath },
        collectionPath.trim(),
        variables
      );

      if (!Array.isArray(collection)) {
        return '';
      }

      return collection.map((item, index) => {
        let processed = content;
        
        // Replace {{this}} with current item
        processed = processed.replace(/\{\{this\}\}/g, this.formatValue(item, 'stringify'));
        
        // Replace {{@index}} with current index
        processed = processed.replace(/\{\{@index\}\}/g, String(index));
        
        // Replace {{@first}} and {{@last}}
        processed = processed.replace(/\{\{@first\}\}/g, String(index === 0));
        processed = processed.replace(/\{\{@last\}\}/g, String(index === collection.length - 1));
        
        return processed;
      }).join('');
    });
  }

  private static applyFilter(value: unknown, filter: string): unknown {
    const stringValue = String(value ?? '');

    switch (filter) {
      case 'uppercase':
        return stringValue.toUpperCase();
      case 'lowercase':
        return stringValue.toLowerCase();
      case 'capitalize':
        return stringValue.charAt(0).toUpperCase() + stringValue.slice(1).toLowerCase();
      case 'trim':
        return stringValue.trim();
      case 'length':
        return stringValue.length;
      case 'json':
        return JSON.stringify(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'default':
        return value || '';
      case 'truncate':
        return stringValue.length > 100 ? stringValue.slice(0, 100) + '...' : stringValue;
      case 'encodeUri':
        return encodeURIComponent(stringValue);
      case 'decodeUri':
        return decodeURIComponent(stringValue);
      case 'base64':
        return Buffer.from(stringValue).toString('base64');
      case 'base64Decode':
        return Buffer.from(stringValue, 'base64').toString();
      default:
        return value;
    }
  }

  private static formatValue(value: unknown, transform: string): string {
    switch (transform) {
      case 'json':
        return JSON.stringify(value);
      case 'stringify':
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      default:
        return String(value);
    }
  }
}

export interface TemplateOptions {
  strict?: boolean;
  defaultValue?: string;
  transform?: 'stringify' | 'json';
}

export interface TemplateResult {
  template: string;
  usedVariables: string[];
  errors: string[];
}

// ─── Secret Manager ─────────────────────────────────────────────────────────

/**
 * Manages encrypted secrets for workflow variables.
 */
export class SecretManager {
  private secrets: Map<string, EncryptedVariable> = new Map();
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Store a secret.
   */
  async store(name: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(value);
    this.secrets.set(name, encrypted);
    logger.info('Secret stored', { name });
  }

  /**
   * Retrieve a secret.
   */
  async retrieve(name: string): Promise<string | null> {
    const encrypted = this.secrets.get(name);
    if (!encrypted) {
      return null;
    }

    return this.decrypt(encrypted);
  }

  /**
   * Delete a secret.
   */
  delete(name: string): boolean {
    const deleted = this.secrets.delete(name);
    if (deleted) {
      logger.info('Secret deleted', { name });
    }
    return deleted;
  }

  /**
   * List all secret names.
   */
  list(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Check if a secret exists.
   */
  has(name: string): boolean {
    return this.secrets.has(name);
  }

  private async encrypt(value: string): Promise<EncryptedVariable> {
    // In production, use proper encryption (AES-256-GCM, etc.)
    // This is a simplified implementation
    const iv = nanoid(16);
    const encrypted = Buffer.from(value).toString('base64');
    
    return {
      id: nanoid(24),
      name: '',
      encryptedValue: encrypted,
      iv,
      algorithm: 'aes-256-gcm',
      createdAt: new Date(),
    };
  }

  private async decrypt(encrypted: EncryptedVariable): Promise<string> {
    // In production, use proper decryption
    // This is a simplified implementation
    return Buffer.from(encrypted.encryptedValue, 'base64').toString();
  }
}
