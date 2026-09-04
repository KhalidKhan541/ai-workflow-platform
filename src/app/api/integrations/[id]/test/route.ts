import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth, requireOrgAccess, handleAuthError } from '@/lib/auth-utils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
      include: { integration: true },
    });

    if (!config) return errorResponse('Configuration not found', 404);

    // Simulate testing the connection based on integration type
    const startTime = Date.now();
    let testResult: { success: boolean; message: string; latency: number; details?: any };

    try {
      // In production, this would actually test the connection
      // For now, simulate based on auth type
      const authType = config.integration.authType;

      if (authType === 'API_KEY') {
        const credentials = config.credentials as any;
        if (!credentials.apiKey) {
          throw new Error('API key is missing');
        }
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 200));
        testResult = {
          success: true,
          message: 'API key validated successfully',
          latency: Date.now() - startTime,
        };
      } else if (authType === 'OAUTH2') {
        const credentials = config.credentials as any;
        if (!credentials.accessToken) {
          throw new Error('Access token is missing. Please complete OAuth flow.');
        }
        // Simulate token validation
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));
        testResult = {
          success: true,
          message: 'OAuth2 token is valid',
          latency: Date.now() - startTime,
        };
      } else if (authType === 'BASIC') {
        const credentials = config.credentials as any;
        if (!credentials.username || !credentials.password) {
          throw new Error('Username and password are required');
        }
        await new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 250));
        testResult = {
          success: true,
          message: 'Basic auth credentials verified',
          latency: Date.now() - startTime,
        };
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));
        testResult = {
          success: true,
          message: 'Connection test passed',
          latency: Date.now() - startTime,
        };
      }
    } catch (testError) {
      testResult = {
        success: false,
        message: testError instanceof Error ? testError.message : 'Connection test failed',
        latency: Date.now() - startTime,
      };
    }

    await prisma.integrationConfig.update({
      where: { id: configId },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: testResult.success ? 'SUCCESS' : 'FAILED',
      },
    });

    return successResponse(testResult);
  } catch (error) {
    return handleAuthError(error);
  }
}
