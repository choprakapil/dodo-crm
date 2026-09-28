/**
 * Request Execution Context & Correlation
 *
 * Phase B.5 Observability Foundation
 *
 * Provides thread-safe, asynchronous execution context propagation across
 * the full request lifecycle using Node.js AsyncLocalStorage.
 *
 * Guarantees:
 * - Correlation: requestId connects logs, errors, and responses
 * - Safety: requestId is sanitized against header injection
 * - Tenant Awareness: companyId & userId bound to server execution context
 */

export interface RequestContext {
  requestId: string;
  startTime?: number;
  pathname?: string;
  method?: string;
  companyId?: string;
  userId?: string;
  isSuperAdmin?: boolean;
}

// AsyncLocalStorage is initialized in server environments to maintain full client-bundle compatibility
interface AsyncLocalStorageLike<T> {
  run<R>(store: T, callback: () => R): R;
  getStore(): T | undefined;
  enterWith?(store: T): void;
}

let asyncLocalStorage: AsyncLocalStorageLike<RequestContext> | null = null;

if (typeof (globalThis as any).window === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require("node:async_hooks");
    asyncLocalStorage = new AsyncLocalStorage();
  } catch {
    // Fallback if not available
  }
}

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{8,64}$/;

/**
 * Validates whether an incoming requestId is safe, bounded, and contains
 * only allowed characters (alphanumeric, hyphens, underscores, dots).
 */
export function validateRequestId(id: string | null | undefined): string | null {
  if (!id || typeof id !== "string") return null;
  const trimmed = id.trim();
  if (REQUEST_ID_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Generates a cryptographically random, collision-resistant Request ID.
 * Format: req_<16_hex_chars>
 */
export function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `req_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("node:crypto");
    const bytes = nodeCrypto.randomBytes(8).toString("hex");
    return `req_${bytes}`;
  } catch {
    return `req_${Math.random().toString(36).slice(2, 18)}`;
  }
}

/**
 * Resolves a safe Request ID from an optional incoming header or generates a new one.
 */
export function resolveRequestId(incomingHeader?: string | null): string {
  const validated = validateRequestId(incomingHeader);
  return validated ?? generateRequestId();
}

/**
 * Runs a function within the bound RequestContext store.
 */
export function runWithRequestContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const fullContext: RequestContext = {
    requestId: context.requestId ?? generateRequestId(),
    startTime: context.startTime ?? Date.now(),
    ...context,
  };
  if (asyncLocalStorage) {
    return asyncLocalStorage.run(fullContext, fn);
  }
  return fn();
}

/**
 * Retrieves the currently active RequestContext if called within an active request store.
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage?.getStore();
}

/**
 * Retrieves the active Request ID, or generates a one-off fallback ID if outside a request scope.
 */
export function getRequestId(): string {
  return asyncLocalStorage?.getStore()?.requestId ?? generateRequestId();
}

/**
 * Retrieves the authenticated tenant company ID from the ambient context.
 */
export function getCompanyId(): string | undefined {
  return asyncLocalStorage?.getStore()?.companyId;
}

/**
 * Retrieves the authenticated user ID from the ambient context.
 */
export function getUserId(): string | undefined {
  return asyncLocalStorage?.getStore()?.userId;
}

/**
 * Ensures or initializes a RequestContext for the current execution stack.
 * If AsyncLocalStorage already has an active store, returns it.
 * Otherwise, creates a new context and calls enterWith() so the context
 * is bound for all subsequent async operations in the current execution.
 */
export function initRequestContext(req?: any): RequestContext {
  const existing = asyncLocalStorage?.getStore();
  if (existing) return existing;

  const reqId = resolveRequestId(req?.headers?.get?.("x-request-id") ?? req?.headers?.["x-request-id"]);
  const pathname =
    req?.nextUrl?.pathname ??
    (typeof req?.url === "string" ? new URL(req.url, "http://localhost").pathname : undefined);
  const method = req?.method;

  const context: RequestContext = {
    requestId: reqId,
    startTime: Date.now(),
    pathname,
    method,
  };

  if (asyncLocalStorage && typeof (asyncLocalStorage as any).enterWith === "function") {
    (asyncLocalStorage as any).enterWith(context);
  }
  return context;
}

/**
 * Enriches the current request execution context with authenticated tenant/user details.
 */
export function setTraceContext(
  data: Partial<Pick<RequestContext, "companyId" | "userId" | "isSuperAdmin" | "pathname" | "method">>
): void {
  const store = asyncLocalStorage?.getStore();
  if (store) {
    if (data.companyId !== undefined) store.companyId = data.companyId;
    if (data.userId !== undefined) store.userId = data.userId;
    if (data.isSuperAdmin !== undefined) store.isSuperAdmin = data.isSuperAdmin;
    if (data.pathname !== undefined) store.pathname = data.pathname;
    if (data.method !== undefined) store.method = data.method;
  }
}
