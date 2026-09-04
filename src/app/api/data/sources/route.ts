import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createDataSourceSchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const type = searchParams.get('type');

    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (type) where.type = type;

    const [sources, total] = await Promise.all([
      prisma.dataSource.findMany({
        where,
        include: {
          _count: { select: { connections: true, schemas: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.dataSource.count({ where }),
    ]);

    return successResponse(sources, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const validation = validateBody(createDataSourceSchema, body);
    if (!validation.success) return validation.response;

    const source = await prisma.dataSource.create({
      data: validation.data,
    });

    return successResponse(source, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const body = await req.json();
    const source = await prisma.dataSource.update({
      where: { id },
      data: body,
    });

    return successResponse(source);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return errorResponse('Data source not found', 404);
    }
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    await prisma.dataSource.delete({ where: { id } });

    return successResponse({ message: 'Data source deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return errorResponse('Data source not found', 404);
    }
    return handleAuthError(error);
  }
}
