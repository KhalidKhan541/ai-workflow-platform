import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const execution = await prisma.execution.findUnique({
      where: { id: params.id },
      include: {
        workflow: { select: { id: true, name: true, status: true, version: true } },
        triggeredByUser: { select: { id: true, name: true, email: true, image: true } },
        org: { select: { id: true, name: true } },
        logs: {
          orderBy: { timestamp: 'asc' },
          take: 100,
        },
        _count: { select: { logs: true } },
      },
    });

    if (!execution) return errorResponse('Execution not found', 404);
    await requireOrgAccess(ctx.userId, execution.orgId);

    return successResponse(execution);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const execution = await prisma.execution.findUnique({ where: { id: params.id } });
    if (!execution) return errorResponse('Execution not found', 404);
    await requireOrgAccess(ctx.userId, execution.orgId);

    if (execution.status === 'RUNNING') {
      return errorResponse('Cannot delete a running execution', 409);
    }

    await prisma.execution.delete({ where: { id: params.id } });

    return successResponse({ message: 'Execution deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const execution = await prisma.execution.findUnique({ where: { id: params.id } });
    if (!execution) return errorResponse('Execution not found', 404);
    await requireOrgAccess(ctx.userId, execution.orgId);

    const body = await req.json();
    const { status } = body;

    if (!status || !['CANCELLED'].includes(status)) {
      return errorResponse('Only CANCELLED status is allowed via PATCH', 400);
    }

    if (execution.status !== 'RUNNING' && execution.status !== 'PENDING') {
      return errorResponse('Can only cancel pending or running executions', 400);
    }

    const updated = await prisma.execution.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: 'Cancelled by user',
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}
