import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createOrgSchema } from '@/lib/validations';
import { requireAuth, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);

    const where = {
      members: { some: { userId: ctx.userId } },
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: { select: { members: true, workflows: true } },
          owner: { select: { id: true, name: true, email: true, image: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.count({ where }),
    ]);

    return successResponse(orgs, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    const validation = validateBody(createOrgSchema, body);
    if (!validation.success) return validation.response;

    const { name, slug, logo } = validation.data;

    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      return errorResponse('Slug already taken', 409);
    }

    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name,
          slug,
          logo,
          ownerId: ctx.userId,
        },
      });

      await tx.membership.create({
        data: {
          userId: ctx.userId,
          orgId: newOrg.id,
          role: 'OWNER',
        },
      });

      return newOrg;
    });

    return successResponse(org, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}
