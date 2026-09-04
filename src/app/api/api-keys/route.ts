import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta, generateApiKey } from '@/lib/api-utils';
import { createApiKeySchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const orgId = searchParams.get('orgId');

    const where: any = { userId: ctx.userId };
    if (orgId) where.orgId = orgId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [keys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          expiresAt: true,
          lastUsedAt: true,
          isActive: true,
          createdAt: true,
          org: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.apiKey.count({ where }),
    ]);

    return successResponse(keys, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const validation = validateBody(createApiKeySchema, body);
    if (!validation.success) return validation.response;

    const { name, scopes, expiresAt } = validation.data;
    const orgId = req.headers.get('x-org-id');

    if (orgId) {
      const membership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: ctx.userId, orgId } },
      });
      if (!membership) return errorResponse('Not a member of this organization', 403);
    }

    const { key, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key,
        prefix,
        userId: ctx.userId,
        orgId,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        key: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(
      {
        ...apiKey,
        message: 'Save this API key securely. It will not be shown again.',
      },
      201
    );
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

    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) return errorResponse('API key not found', 404);
    if (existing.userId !== ctx.userId) return errorResponse('Not authorized', 403);

    const body = await req.json();

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        name: body.name,
        isActive: body.isActive,
        scopes: body.scopes,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(apiKey);
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

    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) return errorResponse('API key not found', 404);
    if (existing.userId !== ctx.userId) return errorResponse('Not authorized', 403);

    await prisma.apiKey.delete({ where: { id } });

    return successResponse({ message: 'API key deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
