import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, parseSearchParams, paginationMeta } from '@/lib/api-utils';

const mockExecutions = [
  { id: 'exec-1', workflowId: 'wf-1', status: 'SUCCESS', orgId: 'org-1', startedAt: new Date(), completedAt: new Date(), duration: 1500 },
  { id: 'exec-2', workflowId: 'wf-1', status: 'FAILED', orgId: 'org-1', startedAt: new Date(), error: 'Step timeout', duration: 5000 },
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { page, limit } = parseSearchParams(searchParams);
  const workflowId = searchParams.get('workflowId');
  const status = searchParams.get('status');

  let filtered = mockExecutions;
  if (workflowId) filtered = filtered.filter((e) => e.workflowId === workflowId);
  if (status) filtered = filtered.filter((e) => e.status === status);

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return successResponse(paginated, 200, paginationMeta(total, page, limit));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.workflowId) return errorResponse('workflowId is required', 400);

  const execution = {
    id: `exec-${Date.now()}`,
    workflowId: body.workflowId,
    status: 'PENDING',
    orgId: 'org-1',
    input: body.input || {},
    startedAt: new Date(),
  };

  return successResponse(execution, 201);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) return errorResponse('Execution ID is required', 400);

  return successResponse({ deleted: true });
}
