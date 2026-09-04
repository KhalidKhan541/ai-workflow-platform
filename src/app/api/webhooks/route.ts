import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { createWebhookSchema } from '@/lib/validations';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { page, limit, skip, search } = parseSearchParams(req.nextUrl.searchParams);

    const where: any = { orgId };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({
        where,
        include: {
          workflow: { select: { id: true, name: true } },
          _count: { select: { deliveries: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webhook.count({ where }),
    ]);

    return successResponse(webhooks, 200, paginationMeta(total, page, limit));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const body = await req.json();
    const validation = validateBody(createWebhookSchema, body);
    if (!validation.success) return validation.response;

    const { name, url, secret, events, workflowId } = validation.data;

    if (workflowId) {
      const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
      if (!workflow || workflow.orgId !== orgId) {
        return errorResponse('Workflow not found', 404);
      }
    }

    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        name,
        url,
        secret: webhookSecret,
        events,
        orgId,
        workflowId,
      },
      include: {
        workflow: { select: { id: true, name: true } },
      },
    });

    return successResponse(webhook, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const existing = await prisma.webhook.findFirst({ where: { id, orgId } });
    if (!existing) return errorResponse('Webhook not found', 404);

    const body = await req.json();
    const webhook = await prisma.webhook.update({
      where: { id },
      data: body,
      include: {
        workflow: { select: { id: true, name: true } },
      },
    });

    return successResponse(webhook);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) return errorResponse('id query parameter is required', 400);

    const existing = await prisma.webhook.findFirst({ where: { id, orgId } });
    if (!existing) return errorResponse('Webhook not found', 404);

    await prisma.webhook.delete({ where: { id } });

    return successResponse({ message: 'Webhook deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
