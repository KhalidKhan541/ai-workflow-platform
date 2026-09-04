import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createAIAgentSchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const model = searchParams.get('model');

    const where: any = { creatorId: ctx.userId };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (model) where.model = model;

    const [agents, total] = await Promise.all([
      prisma.aIAgent.findMany({
        where,
        include: {
          _count: true,
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.aIAgent.count({ where }),
    ]);

    return successResponse(agents, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const validation = validateBody(createAIAgentSchema, body);
    if (!validation.success) return validation.response;

    const agent = await prisma.aIAgent.create({
      data: {
        ...validation.data,
        creatorId: ctx.userId,
      },
    });

    return successResponse(agent, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const existing = await prisma.aIAgent.findUnique({ where: { id } });
    if (!existing) return errorResponse('Agent not found', 404);
    if (existing.creatorId !== ctx.userId) return errorResponse('Not authorized', 403);

    const body = await req.json();
    const agent = await prisma.aIAgent.update({
      where: { id },
      data: body,
    });

    return successResponse(agent);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const existing = await prisma.aIAgent.findUnique({ where: { id } });
    if (!existing) return errorResponse('Agent not found', 404);
    if (existing.creatorId !== ctx.userId) return errorResponse('Not authorized', 403);

    await prisma.aIAgent.delete({ where: { id } });

    return successResponse({ message: 'Agent deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
