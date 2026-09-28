/**
 * Client-Safe API Error Parser & Observability Helper
 *
 * Extracts safe error messages, error codes, and correlation requestIds from API responses
 * for UI presentation and support diagnostics without exposing internal details or stack traces.
 */

export interface ClientApiError {
  message: string;
  code?: string;
  requestId?: string;
}

/**
 * Safely parses an API error payload returned from Universal CRM endpoints.
 * Never throws. Guarantees safe string message and preserves requestId if provided.
 */
export function parseApiError(
  payload: unknown,
  fallbackMessage: string = "An unexpected error occurred. Please try again."
): ClientApiError {
  if (!payload || typeof payload !== "object") {
    return { message: fallbackMessage };
  }

  const p = payload as Record<string, any>;
  const errorObj = p.error;

  if (errorObj && typeof errorObj === "object") {
    const message =
      typeof errorObj.message === "string" && errorObj.message.trim()
        ? errorObj.message
        : fallbackMessage;

    const code =
      typeof errorObj.code === "string" && errorObj.code.trim()
        ? errorObj.code
        : undefined;

    const requestId =
      typeof errorObj.requestId === "string" && errorObj.requestId.trim()
        ? errorObj.requestId
        : undefined;

    return { message, code, requestId };
  }

  // Fallback for simple { message: "..." } format
  if (typeof p.message === "string" && p.message.trim()) {
    return {
      message: p.message,
      requestId: typeof p.requestId === "string" ? p.requestId : undefined,
    };
  }

  return { message: fallbackMessage };
}

/**
 * Formats a user-facing error message with support reference if requestId is present.
 */
export function formatErrorWithRef(err: ClientApiError): string {
  if (err.requestId) {
    return `${err.message} (Ref: ${err.requestId})`;
  }
  return err.message;
}
