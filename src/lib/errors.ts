import { NextResponse } from "next/server";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(
    message: string = "Validation failed",
    fieldErrors: Record<string, string[]> = {}
  ) {
    super(message, 400, "VALIDATION_ERROR", true, { fieldErrors });
    this.fieldErrors = fieldErrors;
  }

  static fromZodError(error: unknown): ValidationError {
    const fieldErrors: Record<string, string[]> = {};

    if (
      error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues: unknown[] }).issues)
    ) {
      const issues = (error as { issues: Array<{ path: string[]; message: string }> }).issues;
      for (const issue of issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }
    }

    return new ValidationError(
      "Validation failed",
      fieldErrors
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fieldErrors: this.fieldErrors,
    };
  }
}

export class AuthError extends AppError {
  public readonly reason: string;

  constructor(
    message: string = "Authentication failed",
    reason: string = "UNAUTHORIZED"
  ) {
    super(message, 401, "AUTH_ERROR", true);
    this.reason = reason;
  }

  static invalidCredentials(): AuthError {
    return new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  static sessionExpired(): AuthError {
    return new AuthError("Session has expired", "SESSION_EXPIRED");
  }

  static insufficientPermissions(requiredRole?: string): AuthError {
    return new AuthError(
      requiredRole
        ? `Insufficient permissions. Required: ${requiredRole}`
        : "Insufficient permissions",
      "INSUFFICIENT_PERMISSIONS"
    );
  }

  static accountDisabled(): AuthError {
    return new AuthError("Account has been disabled", "ACCOUNT_DISABLED");
  }

  static emailNotVerified(): AuthError {
    return new AuthError(
      "Email address has not been verified",
      "EMAIL_NOT_VERIFIED"
    );
  }

  static tooManyAttempts(): AuthError {
    return new AuthError(
      "Too many authentication attempts. Please try again later",
      "RATE_LIMITED"
    );
  }
}

export class NotFoundError extends AppError {
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(resourceType: string = "Resource", resourceId: string = "") {
    const message = resourceId
      ? `${resourceType} with ID '${resourceId}' not found`
      : `${resourceType} not found`;
    super(message, 404, "NOT_FOUND", true, { resourceType, resourceId });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  static user(id?: string): NotFoundError {
    return new NotFoundError("User", id);
  }

  static organization(id?: string): NotFoundError {
    return new NotFoundError("Organization", id);
  }

  static workflow(id?: string): NotFoundError {
    return new NotFoundError("Workflow", id);
  }

  static execution(id?: string): NotFoundError {
    return new NotFoundError("Execution", id);
  }

  static integration(id?: string): NotFoundError {
    return new NotFoundError("Integration", id);
  }

  static apiKey(id?: string): NotFoundError {
    return new NotFoundError("API Key", id);
  }

  static webhook(id?: string): NotFoundError {
    return new NotFoundError("Webhook", id);
  }

  static dataSource(id?: string): NotFoundError {
    return new NotFoundError("Data Source", id);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 409, "CONFLICT", true, details);
  }

  static duplicateEmail(email: string): ConflictError {
    return new ConflictError(
      `An account with email '${email}' already exists`,
      { email }
    );
  }

  static duplicateSlug(slug: string): ConflictError {
    return new ConflictError(
      `An organization with slug '${slug}' already exists`,
      { slug }
    );
  }

  static duplicateApiKey(name: string): ConflictError {
    return new ConflictError(
      `An API key with name '${name}' already exists`,
      { name }
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403, "FORBIDDEN", true);
  }

  static orgMembershipRequired(): ForbiddenError {
    return new ForbiddenError(
      "You must be a member of this organization"
    );
  }

  static ownerActionRequired(): ForbiddenError {
    return new ForbiddenError("This action requires owner privileges");
  }

  static planUpgradeRequired(currentPlan: string, requiredPlan: string): ForbiddenError {
    return new ForbiddenError(
      `This feature requires the ${requiredPlan} plan. Current plan: ${currentPlan}`
    );
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      `Rate limit exceeded. Please try again in ${retryAfter} seconds`,
      429,
      "RATE_LIMITED",
      true,
      { retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    service: string,
    message: string = "External service error",
    originalError?: Error
  ) {
    super(message, 502, "EXTERNAL_SERVICE_ERROR", true, {
      service,
      originalMessage: originalError?.message,
    });
    this.service = service;
    this.originalError = originalError;
  }

  static stripe(error: Error): ExternalServiceError {
    return new ExternalServiceError("Stripe", error.message, error);
  }

  static openai(error: Error): ExternalServiceError {
    return new ExternalServiceError("OpenAI", error.message, error);
  }

  static redis(error: Error): ExternalServiceError {
    return new ExternalServiceError("Redis", error.message, error);
  }

  static email(error: Error): ExternalServiceError {
    return new ExternalServiceError("Email Service", error.message, error);
  }
}

export class InternalError extends AppError {
  constructor(message: string = "Internal server error", cause?: Error) {
    super(message, 500, "INTERNAL_ERROR", false);
    if (cause) {
      this.cause = cause;
    }
  }
}

type ErrorCode =
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    duration?: number;
  };
}

export function apiResponse<T>(
  data: T,
  status: number = 200,
  meta?: ApiResponse["meta"]
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status }
  );
}

export function apiError(
  error: AppError | Error,
  meta?: ApiResponse["meta"]
): NextResponse<ApiResponse> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code as ErrorCode,
          message: error.message,
          details: error.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
          ...meta,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR" as ErrorCode,
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status: 500 }
  );
}

export function handleApiError(
  error: unknown,
  meta?: ApiResponse["meta"]
): NextResponse<ApiResponse> {
  if (error instanceof AppError) {
    return apiError(error, meta);
  }

  if (error instanceof Error) {
    return apiError(new InternalError(error.message, error), meta);
  }

  return apiError(
    new InternalError("An unknown error occurred"),
    meta
  );
}

export function createRouteHandler(
  handler: () => Promise<NextResponse>
): () => Promise<NextResponse> {
  return async function wrappedHandler() {
    const startTime = Date.now();
    try {
      const response = await handler();
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      return handleApiError(error, { duration });
    }
  };
}
