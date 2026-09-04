import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createPromptTemplateSchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const category = searchParams.get('category');
    const isPublic = searchParams.get('isPublic');

    const where: any = {
      OR: [{ creatorId: ctx.userId }, { isPublic: true }],
    };

    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;
    if (isPublic !== null) where.isPublic = isPublic === 'true';

    const [templates, total] = await Promise.all([
      prisma.promptTemplate.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.promptTemplate.count({ where }),
    ]);

    return successResponse(templates, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const validation = validateBody(createPromptTemplateSchema, body);
    if (!validation.success) return validation.response;

    const template = await prisma.promptTemplate.create({
      data: {
        ...validation.data,
        creatorId: ctx.userId,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(template, 201);
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

    const existing = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!existing) return errorResponse('Template not found', 404);
    if (existing.creatorId !== ctx.userId) return errorResponse('Not authorized', 403);

    const body = await req.json();
    const template = await prisma.promptTemplate.update({
      where: { id },
      data: body,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse(template);
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

    const existing = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!existing) return errorResponse('Template not found', 404);
    if (existing.creatorId !== ctx.userId) return errorResponse('Not authorized', 403);

    await prisma.promptTemplate.delete({ where: { id } });

    return successResponse({ message: 'Template deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
