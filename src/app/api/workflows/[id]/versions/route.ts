import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
    if (!workflow) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, workflow.orgId);

    const { page, limit, skip } = parseSearchParams(req.nextUrl.searchParams);

    const [versions, total] = await Promise.all([
      prisma.workflowVersion.findMany({
        where: { workflowId: params.id },
        include: {
          creator: { select: { id: true, name: true, email: true, image: true } },
        },
        skip,
        take: limit,
        orderBy: { version: 'desc' },
      }),
      prisma.workflowVersion.count({ where: { workflowId: params.id } }),
    ]);

    return successResponse(versions, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
    if (!workflow) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, workflow.orgId);

    const body = await req.json();
    const { version: targetVersion } = body;

    if (!targetVersion) return errorResponse('version is required', 400);

    const targetVersionData = await prisma.workflowVersion.findUnique({
      where: { workflowId_version: { workflowId: params.id, version: targetVersion } },
    });

    if (!targetVersionData) return errorResponse('Version not found', 404);

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.workflow.update({
        where: { id: params.id },
        data: {
          steps: targetVersionData.steps,
          trigger: targetVersionData.trigger,
          variables: targetVersionData.variables,
          version: { increment: 1 },
        },
      });

      await tx.workflowVersion.create({
        data: {
          workflowId: params.id,
          version: updated.version,
          steps: targetVersionData.steps,
          trigger: targetVersionData.trigger,
          variables: targetVersionData.variables,
          changelog: `Restored from version ${targetVersion}`,
          createdBy: ctx.userId,
        },
      });

      return updated;
    });

    return successResponse(restored);
  } catch (error) {
    return handleAuthError(error);
  }
}
