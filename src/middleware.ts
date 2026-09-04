import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { logger } from "@/lib/logger";
import { config } from "@/lib/config";

const log = logger.child("middleware");

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/auth/error",
  "/api/auth",
  "/api/health",
  "/api/webhooks",
  "/api/public",
];

const STATIC_PATHS = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/images",
  "/fonts",
  "/icons",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isStaticPath(pathname: string): boolean {
  return STATIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const requestId = generateRequestId();
  const { pathname } = request.nextUrl;

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Pathname", pathname);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  if (pathname.startsWith("/api/")) {
    response.headers.set("X-Api-Version", "1.0");
    response.headers.set(
      "Access-Control-Allow-Origin",
      config.security.allowedOrigins.includes("*")
        ? "*"
        : config.security.allowedOrigins[0]
    );
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Request-Id, X-Api-Key"
    );
    response.headers.set("Access-Control-Max-Age", "86400");

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  if (pathname.startsWith("/api/auth")) {
    return response;
  }

  if (!isPublicPath(pathname)) {
    const token = await getToken({
      req: request,
      secret: config.auth.secret,
    });

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
          { status: 401 }
        );
      }

      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.orgId) {
      response.headers.set("X-User-Id", token.id);
      response.headers.set("X-Org-Id", token.orgId);
      response.headers.set("X-User-Role", token.role);
    }
  }

  const duration = Math.round(performance.now() - startTime);
  log.debug("Request processed", {
    requestId,
    pathname,
    method: request.method,
    ip,
    duration,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
