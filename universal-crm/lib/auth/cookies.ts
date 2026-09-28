/**
 * Session Cookie Constants & Helpers
 *
 * Secure cookie configuration adhering to security best practices:
 * - HttpOnly (prevents XSS access)
 * - Secure in production (prevents MITM)
 * - SameSite=Lax (mitigates CSRF while allowing top-level navigation)
 * - Path=/ (available across the app)
 */

import { cookies } from "next/headers";
import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_COOKIE_NAME = "universal_crm_session";

export const SESSION_MAX_AGE_SECONDS = process.env.SESSION_MAX_AGE_SECONDS
  ? parseInt(process.env.SESSION_MAX_AGE_SECONDS, 10)
  : 86400; // 24 hours

export function getSessionCookieOptions(): Omit<ResponseCookie, "name" | "value"> {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Get raw session token from incoming request cookies (Server Component / Route Handler)
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return sessionCookie?.value ?? null;
}

/**
 * Set session cookie in Route Handler
 */
export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, getSessionCookieOptions());
}

/**
 * Clear session cookie (on logout / revocation)
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

// =============================================================================
// SUPER ADMIN SESSION COOKIES (SLICE 8)
// Completely separate from tenant user cookies.
// =============================================================================

export const SUPER_ADMIN_COOKIE_NAME = "universal_crm_superadmin_session";

export function getSuperAdminCookieOptions(): Omit<ResponseCookie, "name" | "value"> {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Get raw Super Admin session token from incoming request cookies
 */
export async function getSuperAdminSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SUPER_ADMIN_COOKIE_NAME);
  return sessionCookie?.value ?? null;
}

/**
 * Set Super Admin session cookie in Route Handler
 */
export async function setSuperAdminSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SUPER_ADMIN_COOKIE_NAME, rawToken, getSuperAdminCookieOptions());
}

/**
 * Clear Super Admin session cookie (on logout / revocation)
 */
export async function clearSuperAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SUPER_ADMIN_COOKIE_NAME, "", {
    ...getSuperAdminCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}
