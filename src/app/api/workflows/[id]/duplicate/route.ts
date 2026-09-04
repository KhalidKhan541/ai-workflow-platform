import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const original = await prisma.workflow.findUnique({
      where: { id: params.id },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!original) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, original.orgId);

    const duplicate = await prisma.$transaction(async (tx) => {
      const newWorkflow = await tx.workflow.create({
        data: {
          name: `${original.name} (Copy)`,
          description: original.description,
          status: 'DRAFT',
          trigger: original.trigger,
          steps: original.steps,
          variables: original.variables,
          tags: original.tags,
          orgId: original.orgId,
          creatorId: ctx.userId,
          version: 1,
          isTemplate: false,
        },
      });

      if (original.versions.length > 0) {
        const latestVersion = original.versions[0];
        await tx.workflowVersion.create({
          data: {
            workflowId: newWorkflow.id,
            version: 1,
            steps: latestVersion.steps,
            trigger: latestVersion.trigger,
            variables: latestVersion.variables,
            changelog: `Duplicated from ${original.name}`,
            createdBy: ctx.userId,
          },
        });
      }

      return newWorkflow;
    });

    return successResponse(duplicate, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}
