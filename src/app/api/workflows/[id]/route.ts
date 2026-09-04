import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';
import { updateWorkflowSchema } from '@/lib/validations';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.id },
      include: {
        creator: { select: { id: true, name: true, email: true, image: true } },
        org: { select: { id: true, name: true, slug: true } },
        _count: { select: { executions: true, versions: true } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });

    if (!workflow) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, workflow.orgId);

    return successResponse(workflow);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const existing = await prisma.workflow.findUnique({ where: { id: params.id } });
    if (!existing) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, existing.orgId);

    const body = await req.json();
    const validation = validateBody(updateWorkflowSchema, body);
    if (!validation.success) return validation.response;

    const shouldVersion = validation.data.steps || validation.data.trigger || validation.data.variables;

    const workflow = await prisma.$transaction(async (tx) => {
      const updated = await tx.workflow.update({
        where: { id: params.id },
        data: {
          ...validation.data,
          version: shouldVersion ? { increment: 1 } : undefined,
        },
        include: {
          creator: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      if (shouldVersion) {
        await tx.workflowVersion.create({
          data: {
            workflowId: params.id,
            version: updated.version,
            steps: updated.steps,
            trigger: updated.trigger,
            variables: updated.variables,
            changelog: body.changelog || 'Updated workflow',
            createdBy: ctx.userId,
          },
        });
      }

      return updated;
    });

    return successResponse(workflow);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
    if (!workflow) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, workflow.orgId);

    const hasRunningExecutions = await prisma.execution.findFirst({
      where: {
        workflowId: params.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (hasRunningExecutions) {
      return errorResponse('Cannot delete workflow with running executions', 409);
    }

    await prisma.workflow.delete({ where: { id: params.id } });

    return successResponse({ message: 'Workflow deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
