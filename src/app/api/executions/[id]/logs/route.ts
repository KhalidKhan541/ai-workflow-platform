import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const execution = await prisma.execution.findUnique({ where: { id: params.id } });
    if (!execution) return errorResponse('Execution not found', 404);
    await requireOrgAccess(ctx.userId, execution.orgId);

    const { page, limit, skip } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const level = searchParams.get('level');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = { executionId: params.id };
    if (level) where.level = level;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.executionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'asc' },
      }),
      prisma.executionLog.count({ where }),
    ]);

    return successResponse(logs, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const execution = await prisma.execution.findUnique({ where: { id: params.id } });
    if (!execution) return errorResponse('Execution not found', 404);
    await requireOrgAccess(ctx.userId, execution.orgId);

    const body = await req.json();
    const { level = 'INFO', message, metadata } = body;

    if (!message) return errorResponse('message is required', 400);

    const log = await prisma.executionLog.create({
      data: {
        executionId: params.id,
        level,
        message,
        metadata,
      },
    });

    return successResponse(log, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}
