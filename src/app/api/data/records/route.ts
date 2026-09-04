import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createDataRecordSchema } from '@/lib/validations';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const connectionId = searchParams.get('connectionId');
    if (!connectionId) return errorResponse('connectionId query parameter is required', 400);

    const connection = await prisma.dataSourceConnection.findFirst({
      where: { id: connectionId, orgId },
    });
    if (!connection) return errorResponse('Connection not found', 404);

    const where: any = { connectionId };
    if (search) {
      where.data = { path: ['name'], string_contains: search };
    }

    const [records, total] = await Promise.all([
      prisma.dataRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dataRecord.count({ where }),
    ]);

    return successResponse(records, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const body = await req.json();
    const validation = validateBody(createDataRecordSchema, body);
    if (!validation.success) return validation.response;

    const connection = await prisma.dataSourceConnection.findFirst({
      where: { id: validation.data.connectionId, orgId },
    });
    if (!connection) return errorResponse('Connection not found', 404);

    const record = await prisma.dataRecord.create({
      data: validation.data,
    });

    return successResponse(record, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const existing = await prisma.dataRecord.findUnique({ where: { id } });
    if (!existing) return errorResponse('Record not found', 404);

    const connection = await prisma.dataSourceConnection.findFirst({
      where: { id: existing.connectionId, orgId },
    });
    if (!connection) return errorResponse('Access denied', 403);

    const body = await req.json();
    const record = await prisma.dataRecord.update({
      where: { id },
      data: { data: body.data, metadata: body.metadata },
    });

    return successResponse(record);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const existing = await prisma.dataRecord.findUnique({ where: { id } });
    if (!existing) return errorResponse('Record not found', 404);

    const connection = await prisma.dataSourceConnection.findFirst({
      where: { id: existing.connectionId, orgId },
    });
    if (!connection) return errorResponse('Access denied', 403);

    await prisma.dataRecord.delete({ where: { id } });

    return successResponse({ message: 'Record deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
