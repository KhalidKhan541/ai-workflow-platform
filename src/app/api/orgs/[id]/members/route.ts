import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { addMemberSchema } from '@/lib/validations';
import { requireAuth, requireOrgAdmin, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    await requireOrgAccess(ctx.userId, params.id);
    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);

    const where = {
      orgId: params.id,
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [members, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.membership.count({ where }),
    ]);

    return successResponse(members, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    await requireOrgAdmin(ctx.userId, params.id);

    const body = await req.json();
    const validation = validateBody(addMemberSchema, body);
    if (!validation.success) return validation.response;

    const { email, role } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse('User not found with this email', 404);
    }

    const existingMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: params.id } },
    });

    if (existingMembership) {
      return errorResponse('User is already a member of this organization', 409);
    }

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        orgId: params.id,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return successResponse(membership, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    await requireOrgAdmin(ctx.userId, params.id);

    const { searchParams } = req.nextUrl;
    const memberId = searchParams.get('memberId');
    if (!memberId) {
      return errorResponse('memberId query parameter is required', 400);
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: memberId, orgId: params.id } },
    });

    if (!membership) {
      return errorResponse('Member not found', 404);
    }

    if (membership.role === 'OWNER') {
      return errorResponse('Cannot remove the organization owner', 403);
    }

    await prisma.membership.delete({
      where: { userId_orgId: { userId: memberId, orgId: params.id } },
    });

    return successResponse({ message: 'Member removed' });
  } catch (error) {
    return handleAuthError(error);
  }
}
