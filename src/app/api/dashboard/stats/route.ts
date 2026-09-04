import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { searchParams } = req.nextUrl;
    const period = searchParams.get('period') || 'week';

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const [
      totalWorkflows,
      activeWorkflows,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      runningExecutions,
      totalMembers,
      recentExecutions,
    ] = await Promise.all([
      prisma.workflow.count({ where: { orgId } }),
      prisma.workflow.count({ where: { orgId, status: 'ACTIVE' } }),
      prisma.execution.count({
        where: { orgId, startedAt: { gte: startDate } },
      }),
      prisma.execution.count({
        where: { orgId, status: 'SUCCESS', startedAt: { gte: startDate } },
      }),
      prisma.execution.count({
        where: { orgId, status: 'FAILED', startedAt: { gte: startDate } },
      }),
      prisma.execution.count({
        where: { orgId, status: { in: ['PENDING', 'RUNNING'] } },
      }),
      prisma.membership.count({ where: { orgId } }),
      prisma.execution.findMany({
        where: { orgId, startedAt: { gte: startDate } },
        select: { startedAt: true, status: true },
        orderBy: { startedAt: 'asc' },
      }),
    ]);

    const successRate =
      totalExecutions > 0
        ? Math.round((successfulExecutions / totalExecutions) * 100 * 100) / 100
        : 0;

    // Group executions by day for chart data
    const executionsByDay: Record<string, { total: number; success: number; failed: number }> = {};
    recentExecutions.forEach((exec) => {
      const day = exec.startedAt.toISOString().split('T')[0];
      if (!executionsByDay[day]) {
        executionsByDay[day] = { total: 0, success: 0, failed: 0 };
      }
      executionsByDay[day].total++;
      if (exec.status === 'SUCCESS') executionsByDay[day].success++;
      if (exec.status === 'FAILED') executionsByDay[day].failed++;
    });

    return successResponse({
      overview: {
        totalWorkflows,
        activeWorkflows,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        runningExecutions,
        totalMembers,
        successRate,
      },
      executionsByDay: Object.entries(executionsByDay).map(([date, data]) => ({
        date,
        ...data,
      })),
      period,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
