import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { page, limit, skip } = parseSearchParams(req.nextUrl.searchParams);
    const { searchParams } = req.nextUrl;

    const type = searchParams.get('type'); // workflow, execution, member, integration

    const activities: any[] = [];

    // Fetch recent workflows
    if (!type || type === 'workflow') {
      const workflows = await prisma.workflow.findMany({
        where: { orgId },
        include: {
          creator: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      workflows.forEach((w) => {
        activities.push({
          id: `workflow-${w.id}`,
          type: 'workflow',
          action: w.status === 'DRAFT' ? 'created' : 'updated',
          entity: { id: w.id, name: w.name, type: 'workflow' },
          user: w.creator,
          timestamp: w.updatedAt,
        });
      });
    }

    // Fetch recent executions
    if (!type || type === 'execution') {
      const executions = await prisma.execution.findMany({
        where: { orgId },
        include: {
          workflow: { select: { id: true, name: true } },
          triggeredByUser: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      });

      executions.forEach((e) => {
        activities.push({
          id: `execution-${e.id}`,
          type: 'execution',
          action: e.status.toLowerCase(),
          entity: { id: e.id, name: e.workflow.name, type: 'execution' },
          user: e.triggeredByUser,
          timestamp: e.startedAt,
          metadata: { status: e.status, duration: e.duration },
        });
      });
    }

    // Fetch recent member activity
    if (!type || type === 'member') {
      const memberships = await prisma.membership.findMany({
        where: { orgId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      memberships.forEach((m) => {
        activities.push({
          id: `member-${m.id}`,
          type: 'member',
          action: 'joined',
          entity: { id: m.user.id, name: m.user.name || m.user.email, type: 'member' },
          user: m.user,
          timestamp: m.createdAt,
          metadata: { role: m.role },
        });
      });
    }

    // Fetch recent integrations
    if (!type || type === 'integration') {
      const configs = await prisma.integrationConfig.findMany({
        where: { orgId },
        include: {
          integration: { select: { id: true, name: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      configs.forEach((c) => {
        activities.push({
          id: `integration-${c.id}`,
          type: 'integration',
          action: 'connected',
          entity: { id: c.id, name: c.integration.displayName, type: 'integration' },
          timestamp: c.createdAt,
          metadata: {
            lastTestStatus: c.lastTestStatus,
            lastTestedAt: c.lastTestedAt,
          },
        });
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const total = activities.length;
    const paginatedActivities = activities.slice(skip, skip + limit);

    return successResponse(paginatedActivities, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}
