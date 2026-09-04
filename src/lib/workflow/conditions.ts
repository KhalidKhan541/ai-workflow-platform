/**
 * Workflow Condition Evaluator
 * 
 * Evaluates complex conditions with support for comparison, logical,
 * string, array, and date operations.
 * 
 * @module workflow/conditions
 */

import { logger } from '@/lib/logger';
import { ConditionDefinition, ComparisonCondition } from './engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ComparisonOperator = 
  | '==' | '!=' | '>' | '<' | '>=' | '<='
  | '===' | '!==';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export type StringOperator = 
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'matches' | 'notMatches'
  | 'isEmpty' | 'isNotEmpty';

export type ArrayOperator = 
  | 'includes' | 'notIncludes'
  | 'length' | 'lengthEquals' | 'lengthGreaterThan' | 'lengthLessThan'
  | 'isEmpty' | 'isNotEmpty';

export type DateOperator = 
  | 'isBefore' | 'isAfter'
  | 'isBetween' | 'isSameDay'
  | 'isToday' | 'isYesterday' | 'isTomorrow'
  | 'isWeekend' | 'isWeekday'
  | 'isPast' | 'isFuture';

export type NullOperator = 'isNull' | 'isNotNull' | 'isUndefined' | 'isDefined';

export type OperatorType = 
  | ComparisonOperator 
  | StringOperator 
  | ArrayOperator 
  | DateOperator 
  | NullOperator;

export interface ConditionContext {
  variables: Record<string, unknown>;
  timestamp: Date;
}

export interface ConditionResult {
  result: boolean;
  details: ConditionDetail[];
  evaluationTime: number;
}

export interface ConditionDetail {
  type: string;
  expression: string;
  result: boolean;
  leftValue: unknown;
  rightValue: unknown;
  operator: string;
}

// ─── Condition Evaluator ────────────────────────────────────────────────────

/**
 * Evaluates complex conditions with support for multiple operator types.
 */
export class ConditionEvaluator {
  /**
   * Evaluate a condition definition against variables.
   */
  evaluate(
    condition: ConditionDefinition,
    variables: Record<string, unknown>
  ): boolean {
    const startTime = Date.now();

    try {
      const result = this.evaluateGroup(condition, variables);
      const evaluationTime = Date.now() - startTime;

      logger.debug('Condition evaluated', {
        result,
        evaluationTime,
        operator: condition.operator,
      });

      return result;
    } catch (error) {
      logger.error('Condition evaluation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operator: condition.operator,
      });

      return false;
    }
  }

  /**
   * Evaluate with detailed result information.
   */
  evaluateWithDetails(
    condition: ConditionDefinition,
    variables: Record<string, unknown>
  ): ConditionResult {
    const startTime = Date.now();
    const details: ConditionDetail[] = [];

    try {
      const result = this.evaluateGroup(condition, variables, details);
      const evaluationTime = Date.now() - startTime;

      return {
        result,
        details,
        evaluationTime,
      };
    } catch (error) {
      const evaluationTime = Date.now() - startTime;
      
      return {
        result: false,
        details: [
          {
            type: 'error',
            expression: 'condition evaluation',
            result: false,
            leftValue: null,
            rightValue: null,
            operator: condition.operator,
          },
        ],
        evaluationTime,
      };
    }
  }

  /**
   * Evaluate a simple comparison.
   */
  evaluateComparison(
    condition: ComparisonCondition,
    variables: Record<string, unknown>
  ): boolean {
    const leftValue = this.resolveValue(condition.left, variables);
    const rightValue = this.resolveRightValue(condition.right, variables);

    return this.compare(leftValue, rightValue, condition.operator, condition.type);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private evaluateGroup(
    condition: ConditionDefinition,
    variables: Record<string, unknown>,
    details?: ConditionDetail[]
  ): boolean {
    const results: boolean[] = [];

    // Evaluate individual conditions
    for (const comp of condition.conditions) {
      const result = this.evaluateComparison(comp, variables);
      results.push(result);

      if (details) {
        details.push({
          type: 'comparison',
          expression: `${comp.left} ${comp.operator} ${comp.right}`,
          result,
          leftValue: this.resolveValue(comp.left, variables),
          rightValue: this.resolveRightValue(comp.right, variables),
          operator: comp.operator,
        });
      }
    }

    // Evaluate nested groups
    if (condition.groups) {
      for (const group of condition.groups) {
        const result = this.evaluateGroup(group, variables, details);
        results.push(result);
      }
    }

    // Apply logical operator
    return this.applyLogicalOperator(results, condition.operator);
  }

  private applyLogicalOperator(results: boolean[], operator: LogicalOperator): boolean {
    if (results.length === 0) return true;

    switch (operator) {
      case 'AND':
        return results.every(r => r);
      case 'OR':
        return results.some(r => r);
      case 'NOT':
        return !results[0];
      default:
        return results[0];
    }
  }

  private resolveValue(reference: string, variables: Record<string, unknown>): unknown {
    // Check if it's a literal value
    if (this.isLiteral(reference)) {
      return this.parseLiteral(reference);
    }

    // Check if it's a variable reference
    if (reference.startsWith('{{') && reference.endsWith('}}')) {
      const varName = reference.slice(2, -2);
      return this.getNestedValue(variables, varName);
    }

    // Direct variable lookup
    return this.getNestedValue(variables, reference);
  }

  private resolveRightValue(
    right: string | number | boolean | null,
    variables: Record<string, unknown>
  ): unknown {
    if (typeof right === 'string' && right.startsWith('{{') && right.endsWith('}}')) {
      const varName = right.slice(2, -2);
      return this.getNestedValue(variables, varName);
    }
    return right;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private isLiteral(value: string): boolean {
    // Check for string literal
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return true;
    }

    // Check for number literal
    if (!isNaN(Number(value)) && value !== '') {
      return true;
    }

    // Check for boolean literal
    if (value === 'true' || value === 'false') {
      return true;
    }

    // Check for null literal
    if (value === 'null') {
      return true;
    }

    return false;
  }

  private parseLiteral(value: string): unknown {
    // String literal
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Number literal
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value);
    }

    // Boolean literal
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null literal
    if (value === 'null') return null;

    return value;
  }

  private compare(
    left: unknown,
    right: unknown,
    operator: string,
    type: string
  ): boolean {
    // Handle null/undefined checks first
    if (operator === 'isNull' || operator === 'isUndefined') {
      return left === null || left === undefined;
    }
    if (operator === 'isNotNull' || operator === 'isDefined') {
      return left !== null && left !== undefined;
    }

    // Type-specific comparisons
    switch (type) {
      case 'string':
        return this.compareString(String(left), String(right), operator);
      case 'number':
        return this.compareNumber(Number(left), Number(right), operator);
      case 'boolean':
        return this.compareBoolean(left, right, operator);
      case 'date':
        return this.compareDate(left, right, operator);
      case 'array':
        return this.compareArray(left, right, operator);
      default:
        return this.compareGeneric(left, right, operator);
    }
  }

  private compareString(left: string, right: string, operator: string): boolean {
    switch (operator) {
      case '==':
      case '===':
        return left === right;
      case '!=':
      case '!==':
        return left !== right;
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case 'contains':
        return left.includes(right);
      case 'notContains':
        return !left.includes(right);
      case 'startsWith':
        return left.startsWith(right);
      case 'endsWith':
        return left.endsWith(right);
      case 'matches':
        return new RegExp(right).test(left);
      case 'notMatches':
        return !new RegExp(right).test(left);
      case 'isEmpty':
        return left.length === 0;
      case 'isNotEmpty':
        return left.length > 0;
      default:
        return false;
    }
  }

  private compareNumber(left: number, right: number, operator: string): boolean {
    switch (operator) {
      case '==':
      case '===':
        return left === right;
      case '!=':
      case '!==':
        return left !== right;
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case 'length':
        return left === right;
      case 'lengthEquals':
        return left === right;
      case 'lengthGreaterThan':
        return left > right;
      case 'lengthLessThan':
        return left < right;
      default:
        return false;
    }
  }

  private compareBoolean(left: unknown, right: unknown, operator: string): boolean {
    const leftBool = Boolean(left);
    const rightBool = Boolean(right);

    switch (operator) {
      case '==':
      case '===':
        return leftBool === rightBool;
      case '!=':
      case '!==':
        return leftBool !== rightBool;
      default:
        return false;
    }
  }

  private compareDate(left: unknown, right: unknown, operator: string): boolean {
    const leftDate = this.parseDate(left);
    const rightDate = this.parseDate(right);

    if (!leftDate) return false;

    switch (operator) {
      case 'isBefore':
        return leftDate < rightDate;
      case 'isAfter':
        return leftDate > rightDate;
      case 'isBetween': {
        if (!Array.isArray(right) || right.length !== 2) return false;
        const start = this.parseDate(right[0]);
        const end = this.parseDate(right[1]);
        return leftDate >= start && leftDate <= end;
      }
      case 'isSameDay':
        return leftDate.toDateString() === rightDate.toDateString();
      case 'isToday':
        return leftDate.toDateString() === new Date().toDateString();
      case 'isYesterday': {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return leftDate.toDateString() === yesterday.toDateString();
      }
      case 'isTomorrow': {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return leftDate.toDateString() === tomorrow.toDateString();
      }
      case 'isWeekend':
        return leftDate.getDay() === 0 || leftDate.getDay() === 6;
      case 'isWeekday':
        return leftDate.getDay() > 0 && leftDate.getDay() < 6;
      case 'isPast':
        return leftDate < new Date();
      case 'isFuture':
        return leftDate > new Date();
      default:
        return false;
    }
  }

  private compareArray(left: unknown, right: unknown, operator: string): boolean {
    const leftArray = Array.isArray(left) ? left : [];
    const rightValue = right;

    switch (operator) {
      case 'includes':
        return leftArray.includes(rightValue);
      case 'notIncludes':
        return !leftArray.includes(rightValue);
      case 'length':
      case 'lengthEquals':
        return leftArray.length === Number(rightValue);
      case 'lengthGreaterThan':
        return leftArray.length > Number(rightValue);
      case 'lengthLessThan':
        return leftArray.length < Number(rightValue);
      case 'isEmpty':
        return leftArray.length === 0;
      case 'isNotEmpty':
        return leftArray.length > 0;
      default:
        return false;
    }
  }

  private compareGeneric(left: unknown, right: unknown, operator: string): boolean {
    switch (operator) {
      case '==':
      case '===':
        return left === right;
      case '!=':
      case '!==':
        return left !== right;
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case 'isNull':
        return left === null;
      case 'isNotNull':
        return left !== null;
      case 'isUndefined':
        return left === undefined;
      case 'isDefined':
        return left !== undefined;
      default:
        return false;
    }
  }

  private parseDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
    if (typeof value === 'number') {
      return new Date(value);
    }
    return new Date();
  }
}

// ─── Built-in Condition Functions ───────────────────────────────────────────

/**
 * Common condition presets for workflow steps.
 */
export class ConditionPresets {
  /**
   * Check if a value equals a specific value.
   */
  static equals(field: string, value: unknown): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: '==',
          right: value,
          type: typeof value === 'string' ? 'string' : 'number',
        },
      ],
    };
  }

  /**
   * Check if a value does not equal a specific value.
   */
  static notEquals(field: string, value: unknown): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: '!=',
          right: value,
          type: typeof value === 'string' ? 'string' : 'number',
        },
      ],
    };
  }

  /**
   * Check if a number is greater than a threshold.
   */
  static greaterThan(field: string, threshold: number): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: '>',
          right: threshold,
          type: 'number',
        },
      ],
    };
  }

  /**
   * Check if a number is less than a threshold.
   */
  static lessThan(field: string, threshold: number): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: '<',
          right: threshold,
          type: 'number',
        },
      ],
    };
  }

  /**
   * Check if a number is between two values.
   */
  static between(field: string, min: number, max: number): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: '>=',
          right: min,
          type: 'number',
        },
        {
          left: field,
          operator: '<=',
          right: max,
          type: 'number',
        },
      ],
    };
  }

  /**
   * Check if a string contains a substring.
   */
  static contains(field: string, substring: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'contains',
          right: substring,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Check if a string starts with a prefix.
   */
  static startsWith(field: string, prefix: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'startsWith',
          right: prefix,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Check if a string ends with a suffix.
   */
  static endsWith(field: string, suffix: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'endsWith',
          right: suffix,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Check if a string matches a regex pattern.
   */
  static matches(field: string, pattern: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'matches',
          right: pattern,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Check if a value is null or undefined.
   */
  static isNull(field: string): ConditionDefinition {
    return {
      operator: 'OR',
      conditions: [
        {
          left: field,
          operator: 'isNull',
          right: null,
          type: 'string',
        },
        {
          left: field,
          operator: 'isUndefined',
          right: null,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Check if a value is not null and not undefined.
   */
  static isNotNull(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isNotNull',
          right: null,
          type: 'string',
        },
        {
          left: field,
          operator: 'isDefined',
          right: null,
          type: 'string',
        },
      ],
    };
  }

  /**
   * Check if an array is empty.
   */
  static arrayIsEmpty(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isEmpty',
          right: 0,
          type: 'array',
        },
      ],
    };
  }

  /**
   * Check if an array is not empty.
   */
  static arrayIsNotEmpty(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isNotEmpty',
          right: 0,
          type: 'array',
        },
      ],
    };
  }

  /**
   * Check if an array includes a value.
   */
  static arrayIncludes(field: string, value: unknown): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'includes',
          right: value,
          type: 'array',
        },
      ],
    };
  }

  /**
   * Check if an array has a specific length.
   */
  static arrayLength(field: string, length: number): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'lengthEquals',
          right: length,
          type: 'array',
        },
      ],
    };
  }

  /**
   * Check if a date is in the past.
   */
  static isPast(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isPast',
          right: null,
          type: 'date',
        },
      ],
    };
  }

  /**
   * Check if a date is in the future.
   */
  static isFuture(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isFuture',
          right: null,
          type: 'date',
        },
      ],
    };
  }

  /**
   * Check if a date is today.
   */
  static isToday(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isToday',
          right: null,
          type: 'date',
        },
      ],
    };
  }

  /**
   * Check if a date is between two dates.
   */
  static dateBetween(field: string, start: string, end: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isBetween',
          right: [start, end],
          type: 'date',
        },
      ],
    };
  }

  /**
   * Check if it's a weekend.
   */
  static isWeekend(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isWeekend',
          right: null,
          type: 'date',
        },
      ],
    };
  }

  /**
   * Check if it's a weekday.
   */
  static isWeekday(field: string): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: field,
          operator: 'isWeekday',
          right: null,
          type: 'date',
        },
      ],
    };
  }

  /**
   * Combine multiple conditions with AND.
   */
  static and(...conditions: ConditionDefinition[]): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [],
      groups: conditions,
    };
  }

  /**
   * Combine multiple conditions with OR.
   */
  static or(...conditions: ConditionDefinition[]): ConditionDefinition {
    return {
      operator: 'OR',
      conditions: [],
      groups: conditions,
    };
  }

  /**
   * Negate a condition.
   */
  static not(condition: ConditionDefinition): ConditionDefinition {
    return {
      operator: 'NOT',
      conditions: [],
      groups: [condition],
    };
  }

  /**
   * Create a condition that always returns true.
   */
  static alwaysTrue(): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: 'true',
          operator: '==',
          right: true,
          type: 'boolean',
        },
      ],
    };
  }

  /**
   * Create a condition that always returns false.
   */
  static alwaysFalse(): ConditionDefinition {
    return {
      operator: 'AND',
      conditions: [
        {
          left: 'true',
          operator: '==',
          right: false,
          type: 'boolean',
        },
      ],
    };
  }
}

// ─── Expression Evaluator ───────────────────────────────────────────────────

/**
 * Simple expression evaluator for dynamic conditions.
 */
export class ExpressionEvaluator {
  private static readonly OPERATORS = {
    '+': (a: number, b: number) => a + b,
    '-': (a: number, b: number) => a - b,
    '*': (a: number, b: number) => a * b,
    '/': (a: number, b: number) => a / b,
    '%': (a: number, b: number) => a % b,
    '**': (a: number, b: number) => Math.pow(a, b),
  };

  /**
   * Evaluate a simple arithmetic expression.
   */
  static evaluateArithmetic(expression: string): number {
    // Simple tokenizer for arithmetic expressions
    const tokens = this.tokenize(expression);
    return this.parseExpression(tokens, 0).value;
  }

  private static tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (const char of expression) {
      if (char === ' ') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      if ('+-*/%()'.includes(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
        continue;
      }

      current += char;
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  private static parseExpression(tokens: string[], index: number): { value: number; nextIndex: number } {
    let left = this.parseTerm(tokens, index);

    while (left.nextIndex < tokens.length && 
           (tokens[left.nextIndex] === '+' || tokens[left.nextIndex] === '-')) {
      const operator = tokens[left.nextIndex];
      const right = this.parseTerm(tokens, left.nextIndex + 1);

      left = {
        value: this.OPERATORS[operator as keyof typeof this.OPERATORS](left.value, right.value),
        nextIndex: right.nextIndex,
      };
    }

    return left;
  }

  private static parseTerm(tokens: string[], index: number): { value: number; nextIndex: number } {
    let left = this.parseFactor(tokens, index);

    while (left.nextIndex < tokens.length && 
           (tokens[left.nextIndex] === '*' || tokens[left.nextIndex] === '/' || tokens[left.nextIndex] === '%')) {
      const operator = tokens[left.nextIndex];
      const right = this.parseFactor(tokens, left.nextIndex + 1);

      left = {
        value: this.OPERATORS[operator as keyof typeof this.OPERATORS](left.value, right.value),
        nextIndex: right.nextIndex,
      };
    }

    return left;
  }

  private static parseFactor(tokens: string[], index: number): { value: number; nextIndex: number } {
    if (tokens[index] === '(') {
      const result = this.parseExpression(tokens, index + 1);
      return { value: result.value, nextIndex: result.nextIndex + 1 }; // Skip closing paren
    }

    const value = parseFloat(tokens[index]);
    return { value: isNaN(value) ? 0 : value, nextIndex: index + 1 };
  }
}
