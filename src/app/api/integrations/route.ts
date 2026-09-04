import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, validateBody, parseSearchParams, paginationMeta } from '@/lib/api-utils';
import { z } from 'zod';

const integrationConfigSchema = z.object({
  integrationId: z.string().min(1),
  name: z.string().min(1).max(100),
  credentials: z.record(z.unknown()),
  settings: z.record(z.unknown()).optional(),
});

const mockIntegrations = [
  { id: 'int-1', name: 'slack', displayName: 'Slack', category: 'messaging', authType: 'OAUTH2', isActive: true },
  { id: 'int-2', name: 'github', displayName: 'GitHub', category: 'dev-tools', authType: 'API_KEY', isActive: true },
];

const mockConfigs = [
  { id: 'cfg-1', integrationId: 'int-1', orgId: 'org-1', name: 'My Slack', isActive: true },
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { page, limit, search } = parseSearchParams(searchParams);
  const category = searchParams.get('category');

  let filtered = mockIntegrations;
  if (category) filtered = filtered.filter((i) => i.category === category);
  if (search) filtered = filtered.filter((i) => i.displayName.toLowerCase().includes(search.toLowerCase()));

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return successResponse(paginated, 200, paginationMeta(total, page, limit));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = validateBody(integrationConfigSchema, body);
  if (!result.success) return result.response;

  const config = {
    id: `cfg-${Date.now()}`,
    ...result.data,
    orgId: 'org-1',
    isActive: true,
    createdAt: new Date(),
  };

  return successResponse(config, 201);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) return errorResponse('Config ID is required', 400);

  return successResponse({ deleted: true });
}
