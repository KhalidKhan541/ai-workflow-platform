import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';

const workflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  steps: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    config: z.record(z.unknown()),
  })).min(1),
  trigger: z.object({ type: z.string(), config: z.record(z.unknown()) }).optional(),
  tags: z.array(z.string()).optional(),
});

const mockWorkflows = [
  { id: 'wf-1', name: 'Email Notification', status: 'ACTIVE', orgId: 'org-1', creatorId: 'u-1', createdAt: new Date(), updatedAt: new Date() },
  { id: 'wf-2', name: 'Data Sync', status: 'DRAFT', orgId: 'org-1', creatorId: 'u-1', createdAt: new Date(), updatedAt: new Date() },
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { page, limit, sortBy, sortOrder, search } = parseSearchParams(searchParams);

  let filtered = mockWorkflows;
  if (search) {
    filtered = filtered.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()));
  }

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return successResponse(paginated, 200, paginationMeta(total, page, limit));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = validateBody(workflowSchema, body);
  if (!result.success) return result.response;

  const workflow = {
    id: `wf-${Date.now()}`,
    ...result.data,
    status: 'DRAFT',
    orgId: 'org-1',
    creatorId: 'u-1',
    version: 1,
    isTemplate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return successResponse(workflow, 201);
}

export async function PUT(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) return errorResponse('Workflow ID is required', 400);

  const body = await request.json();
  const result = validateBody(workflowSchema.partial(), body);
  if (!result.success) return result.response;

  const existing = mockWorkflows.find((w) => w.id === id);
  if (!existing) return errorResponse('Workflow not found', 404);

  return successResponse({ ...existing, ...result.data, updatedAt: new Date() });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) return errorResponse('Workflow ID is required', 400);

  const existing = mockWorkflows.find((w) => w.id === id);
  if (!existing) return errorResponse('Workflow not found', 404);

  return successResponse({ deleted: true });
}
