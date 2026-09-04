import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createDataSchemaSchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const dataSourceId = searchParams.get('dataSourceId');

    const where: any = {};
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [schemas, total] = await Promise.all([
      prisma.dataSchema.findMany({
        where,
        include: {
          dataSource: { select: { id: true, name: true, type: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dataSchema.count({ where }),
    ]);

    return successResponse(schemas, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const validation = validateBody(createDataSchemaSchema, body);
    if (!validation.success) return validation.response;

    const { dataSourceId, name, fields } = validation.data;

    const dataSource = await prisma.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!dataSource) return errorResponse('Data source not found', 404);

    const existingSchema = await prisma.dataSchema.findFirst({
      where: { dataSourceId, name },
      orderBy: { version: 'desc' },
    });

    const version = existingSchema ? existingSchema.version + 1 : 1;

    const schema = await prisma.dataSchema.create({
      data: {
        dataSourceId,
        name,
        fields,
        version,
      },
      include: {
        dataSource: { select: { id: true, name: true, type: true } },
      },
    });

    return successResponse(schema, 201);
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

    const existing = await prisma.dataSchema.findUnique({ where: { id } });
    if (!existing) return errorResponse('Schema not found', 404);

    const body = await req.json();
    const schema = await prisma.dataSchema.update({
      where: { id },
      data: {
        fields: body.fields,
        version: { increment: 1 },
      },
      include: {
        dataSource: { select: { id: true, name: true, type: true } },
      },
    });

    return successResponse(schema);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    await prisma.dataSchema.delete({ where: { id } });

    return successResponse({ message: 'Schema deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return errorResponse('Schema not found', 404);
    }
    return handleAuthError(error);
  }
}
