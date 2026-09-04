import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, string[]>;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function successResponse<T>(data: T, status = 200, meta?: ApiResponse['meta']) {
  const body: ApiResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function errorResponse(error: string, status = 500, details?: Record<string, string[]>) {
  const body: ApiResponse = { success: false, error };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

export function validationError(error: ZodError) {
  const details: Record<string, string[]> = {};
  error.errors.forEach((e) => {
    const path = e.path.join('.');
    if (!details[path]) details[path] = [];
    details[path].push(e.message);
  });
  return errorResponse('Validation failed', 400, details);
}

export function validateBody<T>(schema: ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, response: validationError(result.error) };
  }
  return { success: true, data: result.data };
}

export function parseSearchParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const search = searchParams.get('search') || '';

  return { page, limit, skip, sortBy, sortOrder, search };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'awp_';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const prefix = key.substring(0, 8);
  return { key, prefix, hash: key };
}

export function maskApiKey(key: string): string {
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}
