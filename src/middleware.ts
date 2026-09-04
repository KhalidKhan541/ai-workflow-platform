import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

const PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/signin',
  '/api/auth/csrf',
  '/api/auth/session',
  '/api/auth/providers',
  '/api/webhooks/',
  '/api/dashboard/stats',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = RATE_LIMIT_MAP.get(ip);

  if (!record || now > record.resetAt) {
    RATE_LIMIT_MAP.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
  const isAllowed = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : allowedOrigins[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id, x-request-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = generateRequestId();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(req.headers.get('origin')),
    });
  }

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-Request-Id': requestId,
          ...getCorsHeaders(req.headers.get('origin')),
        },
      }
    );
  }

  // Skip auth for public paths
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set('X-Request-Id', requestId);
    Object.entries(getCorsHeaders(req.headers.get('origin'))).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Auth check for API routes
  if (pathname.startsWith('/api/')) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        {
          status: 401,
          headers: {
            'X-Request-Id': requestId,
            ...getCorsHeaders(req.headers.get('origin')),
          },
        }
      );
    }
  }

  // Continue to route
  const response = NextResponse.next();
  response.headers.set('X-Request-Id', requestId);
  Object.entries(getCorsHeaders(req.headers.get('origin'))).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
