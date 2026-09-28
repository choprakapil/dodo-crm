/**
 * Universal CRM Middleware
 *
 * Edge-compatible route protection and security headers.
 * Avoids heavy DB operations in edge runtime; verifies session cookie presence
 * and routes traffic appropriately. Deep DB session validation and tenant hydration
 * are executed in server components and route handlers via `requireAuth()`.
 */

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SUPER_ADMIN_COOKIE_NAME } from "@/lib/auth/cookies";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Resolve or generate correlation Request ID
  const rawRequestId = req.headers.get("x-request-id");
  const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{8,64}$/;
  const requestId =
    rawRequestId && REQUEST_ID_REGEX.test(rawRequestId.trim())
      ? rawRequestId.trim()
      : `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const tenantCookie = req.cookies.get(SESSION_COOKIE_NAME);
  const hasTenantCookie = Boolean(tenantCookie?.value && tenantCookie.value.trim().length > 0);

  const superAdminCookie = req.cookies.get(SUPER_ADMIN_COOKIE_NAME);
  const hasSuperAdminCookie = Boolean(superAdminCookie?.value && superAdminCookie.value.trim().length > 0);

  // =========================================================================
  // 0. CSRF & SAME-ORIGIN ENFORCEMENT FOR API MUTATIONS
  // =========================================================================
  const method = req.method.toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isMutation && pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    const secFetchSite = req.headers.get("sec-fetch-site");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;

    // Reject explicit cross-site fetch according to Fetch Metadata
    if (secFetchSite === "cross-site") {
      const resp = NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Cross-site request rejected.",
            requestId,
          },
        },
        { status: 403 }
      );
      resp.headers.set("X-Request-ID", requestId);
      return resp;
    }

    // If Origin is present, ensure it matches current host
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const expectedHost = host.split(":")[0];
        const originHost = originUrl.hostname;
        if (originHost !== expectedHost && originUrl.host !== host) {
          const resp = NextResponse.json(
            {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "Cross-origin state-changing requests are prohibited.",
                requestId,
              },
            },
            { status: 403 }
          );
          resp.headers.set("X-Request-ID", requestId);
          return resp;
        }
      } catch {
        const resp = NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Invalid Origin header.",
              requestId,
            },
          },
          { status: 403 }
        );
        resp.headers.set("X-Request-ID", requestId);
        return resp;
      }
    }

    // Reject simple cross-origin form content-types that attempt to bypass preflights
    const contentType = req.headers.get("content-type")?.toLowerCase() || "";
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("text/plain")
    ) {
      const resp = NextResponse.json(
        {
          success: false,
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Unsupported Content-Type for API mutation. Application JSON required.",
            requestId,
          },
        },
        { status: 415 }
      );
      resp.headers.set("X-Request-ID", requestId);
      return resp;
    }
  }

  // =========================================================================
  // 1. SUPER ADMIN PLATFORM PROTECTION (/admin/* & /api/v1/admin/*)
  // =========================================================================
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/v1/admin/");
  const isPublicAdminRoute = pathname === "/admin/login" || pathname === "/api/v1/admin/auth/login";

  if (pathname === "/admin/login") {
    // Allow access to /admin/login without blind redirect, preventing infinite loops on expired/stale cookies
  } else if (!isPublicAdminRoute && (isAdminPath || isAdminApi)) {
    if (!hasSuperAdminCookie) {
      if (pathname.startsWith("/api/")) {
        const resp = NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Super Admin authentication required to access platform resources.",
              requestId,
            },
          },
          { status: 401 }
        );
        resp.headers.set("X-Request-ID", requestId);
        return resp;
      }
      const adminLoginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(adminLoginUrl);
    }
  }

  // =========================================================================
  // 2. TENANT APPLICATION PROTECTION (/app/* & /api/v1/* except admin)
  // =========================================================================
  const isPublicInvitation = pathname.startsWith("/app/invite") || pathname.startsWith("/invite");
  const isTenantApp = (pathname === "/app" || pathname.startsWith("/app/")) && !isPublicInvitation;

  if (isTenantApp && !hasTenantCookie) {
    if (pathname.startsWith("/api/")) {
      const resp = NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to access this resource.",
            requestId,
          },
        },
        { status: 401 }
      );
      resp.headers.set("X-Request-ID", requestId);
      return resp;
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Propagate headers for downstream server components and route handlers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Observability & Security Headers
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
