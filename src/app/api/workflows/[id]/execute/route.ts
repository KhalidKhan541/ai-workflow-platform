import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';
import { executeWorkflowSchema } from '@/lib/validations';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();

    const workflow = await prisma.workflow.findUnique({ where: { id: params.id } });
    if (!workflow) return errorResponse('Workflow not found', 404);
    await requireOrgAccess(ctx.userId, workflow.orgId);

    if (workflow.status !== 'ACTIVE') {
      return errorResponse('Workflow must be ACTIVE to execute', 400);
    }

    const body = await req.json();
    const validation = validateBody(executeWorkflowSchema, body);
    if (!validation.success) return validation.response;

    const execution = await prisma.execution.create({
      data: {
        workflowId: params.id,
        triggeredBy: ctx.userId,
        orgId: workflow.orgId,
        input: validation.data.input,
        status: 'PENDING',
      },
      include: {
        workflow: { select: { id: true, name: true } },
      },
    });

    // Simulate async execution (in production, this would be a queue/job)
    if (validation.data.async) {
      // In production: queue the execution
      return successResponse(
        {
          execution,
          message: 'Execution queued',
        },
        202
      );
    }

    // Synchronous execution
    const startTime = Date.now();
    try {
      await prisma.execution.update({
        where: { id: execution.id },
        data: { status: 'RUNNING' },
      });

      await prisma.executionLog.create({
        data: {
          executionId: execution.id,
          level: 'INFO',
          message: 'Execution started',
        },
      });

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = { result: 'success', processedAt: new Date().toISOString() };
      const duration = Date.now() - startTime;

      const completed = await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          output,
          duration,
          completedAt: new Date(),
        },
        include: {
          workflow: { select: { id: true, name: true } },
        },
      });

      await prisma.executionLog.create({
        data: {
          executionId: execution.id,
          level: 'INFO',
          message: `Execution completed in ${duration}ms`,
          metadata: { output },
        },
      });

      return successResponse(completed);
    } catch (execError) {
      const duration = Date.now() - startTime;
      const failed = await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: execError instanceof Error ? execError.message : 'Unknown error',
          duration,
          completedAt: new Date(),
        },
      });

      await prisma.executionLog.create({
        data: {
          executionId: execution.id,
          level: 'ERROR',
          message: execError instanceof Error ? execError.message : 'Execution failed',
        },
      });

      return successResponse(failed);
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
