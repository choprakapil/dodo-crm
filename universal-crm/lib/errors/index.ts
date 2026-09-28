/**
 * Application Error Architecture
 *
 * Standardized error handling across the entire application.
 * - AppError: typed errors with stable error codes
 * - Never expose internal details to clients
 * - Always include requestId in error responses
 *
 * PRD §128, §129, §60
 */

// =============================================================================
// ERROR CODES — stable, never expose internal details
// =============================================================================

export const ErrorCode = {
  // Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  COMPANY_SUSPENDED: "COMPANY_SUSPENDED",

  // Authorization
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Not Found
  NOT_FOUND: "NOT_FOUND",
  LEAD_NOT_FOUND: "LEAD_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  COMPANY_NOT_FOUND: "COMPANY_NOT_FOUND",
  TEAM_NOT_FOUND: "TEAM_NOT_FOUND",
  ROLE_NOT_FOUND: "ROLE_NOT_FOUND",
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  NOTE_NOT_FOUND: "NOTE_NOT_FOUND",
  LEAD_SOURCE_NOT_FOUND: "LEAD_SOURCE_NOT_FOUND",
  LEAD_STATUS_NOT_FOUND: "LEAD_STATUS_NOT_FOUND",
  INVITATION_NOT_FOUND: "INVITATION_NOT_FOUND",

  // Conflicts
  CONFLICT: "CONFLICT",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  SLUG_ALREADY_EXISTS: "SLUG_ALREADY_EXISTS",
  NAME_ALREADY_EXISTS: "NAME_ALREADY_EXISTS",
  DUPLICATE_TEAM_MEMBER: "DUPLICATE_TEAM_MEMBER",

  // Token errors
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_ALREADY_USED: "TOKEN_ALREADY_USED",

  // Business logic
  CANNOT_DELETE_IN_USE: "CANNOT_DELETE_IN_USE",
  CANNOT_DELETE_SYSTEM_ROLE: "CANNOT_DELETE_SYSTEM_ROLE",
  CANNOT_DISABLE_LAST_ADMIN: "CANNOT_DISABLE_LAST_ADMIN",
  CANNOT_DELETE_DEFAULT_STATUS: "CANNOT_DELETE_DEFAULT_STATUS",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  STALE_DATA: "STALE_DATA",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// AppError — typed application error
// =============================================================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  static unauthorized(message = "Authentication required") {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = "Access denied") {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }

  static notFound(code: ErrorCode = ErrorCode.NOT_FOUND, message = "Not found") {
    return new AppError(code, message, 404);
  }

  static conflict(code: ErrorCode = ErrorCode.CONFLICT, message = "Conflict") {
    return new AppError(code, message, 409);
  }

  static validation(
    message = "Validation failed",
    details?: Record<string, unknown>
  ) {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);
  }

  static rateLimited(message = "Too many requests. Please try again later.") {
    return new AppError(ErrorCode.RATE_LIMITED, message, 429);
  }

  static internal(message = "An unexpected error occurred") {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(ErrorCode.UNAUTHORIZED, message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(ErrorCode.FORBIDDEN, message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code: ErrorCode = ErrorCode.NOT_FOUND) {
    super(code, message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code: ErrorCode = ErrorCode.CONFLICT) {
    super(code, message, 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(ErrorCode.RATE_LIMITED, message, 429);
    this.name = "RateLimitError";
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = "Subscription plan quota exceeded. Please upgrade.", details?: Record<string, unknown>) {
    super(ErrorCode.QUOTA_EXCEEDED, message, 403, details);
    this.name = "QuotaExceededError";
  }
}

// =============================================================================
// API Error Response — standardized format per PRD §60
// =============================================================================

import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/observability/context";
import { logger } from "@/lib/logger";

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    fields?: Record<string, string>; // For validation errors
  };
}

/**
 * Convert any error to a safe API error response.
 * Never exposes internal details (stack traces, DB errors, etc.)
 */
export function toApiErrorResponse(
  error: unknown,
  requestId?: string
): { body: ApiErrorResponse; status: number } {
  const reqId = requestId ?? getRequestId();

  if (error instanceof AppError) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: reqId,
        details: error.details,
      },
    };

    if (
      error.code === ErrorCode.VALIDATION_ERROR &&
      error.details?.fields
    ) {
      body.error.fields = error.details.fields as Record<string, string>;
    }

    return { body, status: error.statusCode };
  }

  if ((error as { name?: string; issues?: Array<{ message: string }> })?.name === "ZodError") {
    const zodErr = error as { issues?: Array<{ message: string }> };
    return {
      body: {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: zodErr.issues?.[0]?.message || "Validation failed",
          requestId: reqId,
        },
      },
      status: 400,
    };
  }

  return {
    body: {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        requestId: reqId,
      },
    },
    status: 500,
  };
}

/**
 * Convenience helper to return NextResponse directly from an error
 */
export function handleApiError(error: unknown, requestId?: string): NextResponse {
  const reqId = requestId ?? getRequestId();
  const { body, status } = toApiErrorResponse(error, reqId);

  // If internal error (>= 500), log the full error with correlation ID & stack trace to server stdout/stderr
  if (status >= 500) {
    logger.error("Internal API error occurred", {
      requestId: reqId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: body.error.code,
      statusCode: status,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  const response = NextResponse.json(body, { status });
  response.headers.set("X-Request-ID", reqId);
  return response;
}

