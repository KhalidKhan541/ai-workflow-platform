// Advanced validation utilities with Zod

import { z, ZodSchema, ZodError, ZodType } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ─── Types ───────────────────────────────────────────────
export type ValidationSource = 'body' | 'query' | 'params' | 'headers';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationMiddlewareOptions {
  source?: ValidationSource;
  stripUnknown?: boolean;
  onError?: (errors: ValidationError[]) => NextResponse;
}

// ─── Custom Zod Schemas ──────────────────────────────────
export const schemas = {
  email: z.string().email('Invalid email address').max(255),
  url: z.string().url('Invalid URL'),
  uuid: z.string().uuid('Invalid UUID'),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  hexColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'),
  ipAddress: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address'),
  date: z.string().datetime('Invalid date format'),
  positiveInt: z.number().int().positive(),
  nonNegativeInt: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
  jsonArray: <T extends ZodType>(itemSchema: T) => z.array(itemSchema),
  nullable: <T extends ZodType>(schema: T) => schema.nullable(),
  optional: <T extends ZodType>(schema: T) => schema.optional(),
  oneOf: <T extends readonly [string, ...string[]]>(values: T) => z.enum(values),
  jsonString: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Invalid JSON string'),
  base64: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid base64'),
  semver: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/, 'Invalid semver'),
};

// ─── Schema Composition ──────────────────────────────────
export function createPaginatedSchema<T extends ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });
}

export function createFilterSchema<T extends ZodType>(fields: Record<string, T>) {
  const shape: Record<string, ZodType> = {};
  for (const [key, schema] of Object.entries(fields)) {
    shape[key] = schema.optional();
  }
  shape.page = z.number().int().positive().default(1);
  shape.pageSize = z.number().int().min(1).max(100).default(20);
  shape.sortBy = z.string().optional();
  shape.sortOrder = z.enum(['asc', 'desc']).default('desc');
  return z.object(shape);
}

export function createCreateSchema<T extends ZodType>(fields: Record<string, T>) {
  const shape: Record<string, T> = {};
  for (const [key, schema] of Object.entries(fields)) {
    shape[key] = schema;
  }
  return z.object(shape);
}

export function createUpdateSchema<T extends ZodType>(fields: Record<string, T>) {
  const shape: Record<string, ZodType> = {};
  for (const [key, schema] of Object.entries(fields)) {
    shape[key] = schema.optional();
  }
  return z.object(shape).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
  );
}

// ─── Cross-Field Validation ──────────────────────────────
export function createCrossFieldSchema<T extends ZodType>(
  schema: T,
  refinements: Array<{ check: (data: z.infer<T>) => boolean; message: string; path?: string[] }>
) {
  let result: ZodType = schema;
  for (const refinement of refinements) {
    result = result.refine(refinement.check, {
      message: refinement.message,
      path: refinement.path,
    });
  }
  return result as z.ZodEffects<T>;
}

// ─── Async Validation ────────────────────────────────────
export function createAsyncSchema<T extends ZodType>(
  schema: T,
  asyncChecks: Array<(data: z.infer<T>) => Promise<{ valid: boolean; error?: string }>>
) {
  return schema.refine(async (data) => {
    for (const check of asyncChecks) {
      const result = await check(data);
      if (!result.valid) return false;
    }
    return true;
  }, { message: 'Async validation failed' });
}

// ─── Validation Functions ────────────────────────────────
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));

  return { success: false, errors };
}

export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  const result = await schema.safeParseAsync(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));

  return { success: false, errors };
}

// ─── Validation Middleware ────────────────────────────────
export function createValidationMiddleware<T>(
  schema: ZodSchema<T>,
  options: ValidationMiddlewareOptions = {}
) {
  const { source = 'body', stripUnknown = true, onError } = options;

  return async (req: NextRequest): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> => {
    let data: unknown;

    switch (source) {
      case 'body':
        data = await req.json().catch(() => null);
        break;
      case 'query':
        data = Object.fromEntries(req.nextUrl.searchParams);
        break;
      case 'params':
        // Extract from URL path segments if needed
        data = {};
        break;
      case 'headers':
        data = Object.fromEntries(req.headers);
        break;
    }

    const result = validate(schema, data);
    if (result.success) {
      return { success: true, data: result.data! };
    }

    const response = onError?.(result.errors!) || NextResponse.json(
      { success: false, error: 'Validation failed', details: result.errors },
      { status: 400 }
    );

    return { success: false, response };
  };
}

// ─── Quick Validation Helpers ────────────────────────────
export function isValid<T>(schema: ZodSchema<T>, data: unknown): boolean {
  return schema.safeParse(data).success;
}

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeParse<T>(schema: ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

// ─── Schema Builder ──────────────────────────────────────
export class SchemaBuilder {
  private fields: Record<string, ZodType> = {};

  field(name: string, schema: ZodType): this {
    this.fields[name] = schema;
    return this;
  }

  email(name: string): this {
    return this.field(name, schemas.email);
  }

  string(name: string, options?: { min?: number; max?: number; required?: boolean }): this {
    let schema = z.string();
    if (options?.min) schema = schema.min(options.min);
    if (options?.max) schema = schema.max(options.max);
    return this.field(name, options?.required === false ? schema.optional() : schema);
  }

  number(name: string, options?: { min?: number; max?: number; int?: boolean; required?: boolean }): this {
    let schema = z.number();
    if (options?.min !== undefined) schema = schema.min(options.min);
    if (options?.max !== undefined) schema = schema.max(options.max);
    if (options?.int) schema = schema.int();
    return this.field(name, options?.required === false ? schema.optional() : schema);
  }

  boolean(name: string, options?: { required?: boolean }): this {
    const schema = z.boolean();
    return this.field(name, options?.required === false ? schema.optional() : schema);
  }

  array(name: string, itemSchema: ZodType, options?: { required?: boolean }): this {
    const schema = z.array(itemSchema);
    return this.field(name, options?.required === false ? schema.optional() : schema);
  }

  object(name: string, shape: Record<string, ZodType>, options?: { required?: boolean }): this {
    const schema = z.object(shape);
    return this.field(name, options?.required === false ? schema.optional() : schema);
  }

  build(): z.ZodObject<typeof this.fields> {
    return z.object(this.fields);
  }
}

export function createSchema(): SchemaBuilder {
  return new SchemaBuilder();
}
