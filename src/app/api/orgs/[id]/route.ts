import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';
import { updateOrgSchema } from '@/lib/validations';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    await requireOrgAccess(ctx.userId, params.id);

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { members: true, workflows: true, executions: true } },
        owner: { select: { id: true, name: true, email: true, image: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    if (!org) {
      return errorResponse('Organization not found', 404);
    }

    return successResponse(org);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    await requireOrgAccess(ctx.userId, params.id);

    const body = await req.json();
    const validation = validateBody(updateOrgSchema, body);
    if (!validation.success) return validation.response;

    const org = await prisma.organization.update({
      where: { id: params.id },
      data: validation.data,
    });

    return successResponse(org);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    await requireOrgAccess(ctx.userId, params.id);

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: ctx.userId, orgId: params.id } },
    });

    if (membership?.role !== 'OWNER') {
      return errorResponse('Only the owner can delete the organization', 403);
    }

    await prisma.organization.delete({ where: { id: params.id } });

    return successResponse({ message: 'Organization deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
