import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';
import { saveIntegrationConfigSchema } from '@/lib/validations';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const configs = await prisma.integrationConfig.findMany({
      where: {
        integrationId: params.id,
        orgId,
      },
      include: {
        integration: { select: { id: true, name: true, displayName: true, authType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(configs);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const integration = await prisma.integration.findUnique({ where: { id: params.id } });
    if (!integration) return errorResponse('Integration not found', 404);

    const body = await req.json();
    const validation = validateBody(saveIntegrationConfigSchema, body);
    if (!validation.success) return validation.response;

    const { name, credentials, settings } = validation.data;

    const existingConfig = await prisma.integrationConfig.findFirst({
      where: { integrationId: params.id, orgId, name },
    });

    let config;
    if (existingConfig) {
      config = await prisma.integrationConfig.update({
        where: { id: existingConfig.id },
        data: { credentials, settings },
        include: {
          integration: { select: { id: true, name: true, displayName: true } },
        },
      });
    } else {
      config = await prisma.integrationConfig.create({
        data: {
          integrationId: params.id,
          orgId,
          name,
          credentials,
          settings,
        },
        include: {
          integration: { select: { id: true, name: true, displayName: true } },
        },
      });
    }

    return successResponse(config, existingConfig ? 200 : 201);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth();
    const orgId = req.headers.get('x-org-id');
    if (!orgId) return errorResponse('x-org-id header required', 400);
    await requireOrgAccess(ctx.userId, orgId);

    const { searchParams } = req.nextUrl;
    const configId = searchParams.get('configId');
    if (!configId) return errorResponse('configId query parameter is required', 400);

    const config = await prisma.integrationConfig.findFirst({
      where: { id: configId, integrationId: params.id, orgId },
    });

    if (!config) return errorResponse('Configuration not found', 404);

    await prisma.integrationConfig.delete({ where: { id: configId } });

    return successResponse({ message: 'Configuration deleted' });
  } catch (error) {
    return handleAuthError(error);
  }
}
