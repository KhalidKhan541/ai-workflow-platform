import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { errorResponse } from './api-utils';

export interface AuthContext {
  userId: string;
  orgId?: string;
  role?: string;
}

export async function getAuthContext(req?: NextRequest): Promise<AuthContext | null> {
  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const orgId = req?.headers.get('x-org-id') || undefined;

  return {
    userId: session.user.id,
    orgId,
    role: (session.user as any).role,
  };
}

export async function requireAuth(req?: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx) {
    throw new Error('UNAUTHORIZED');
  }
  return ctx;
}

export async function requireOrgAccess(userId: string, orgId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });

  if (!membership) {
    throw new Error('FORBIDDEN');
  }

  return membership;
}

export async function requireOrgAdmin(userId: string, orgId: string) {
  const membership = await requireOrgAccess(userId, orgId);
  if (!['OWNER', 'ADMIN'].includes(membership.role)) {
    throw new Error('FORBIDDEN');
  }
  return membership;
}

export function handleAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') {
      return errorResponse('Authentication required', 401);
    }
    if (error.message === 'FORBIDDEN') {
      return errorResponse('Insufficient permissions', 403);
    }
  }
  return errorResponse('Internal server error', 500);
}
