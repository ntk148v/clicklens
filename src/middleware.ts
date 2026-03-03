/**
 * Next.js Middleware – Authentication Guard
 *
 * Defense-in-depth layer that validates session cookies before
 * API route handlers execute. Individual routes still call
 * checkPermission() / requireAuth() for fine-grained RBAC,
 * but this middleware ensures that unauthenticated requests
 * never reach protected handlers at all.
 */

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

// Routes that are accessible without authentication
const PUBLIC_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/session",
  "/api/clickhouse/ping",
]);

// Only apply middleware to API routes (pages handle auth via session checks)
export const config = {
  matcher: "/api/:path*",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  try {
    // Read the iron-session cookie to check login status
    // We use a lightweight cookie-only check here (no server-side hydration)
    // to keep middleware fast. Full session validation happens in route handlers.
    const response = NextResponse.next();
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions,
    );

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Session has sessionId but no user object — the user field is hydrated
    // in getSession() inside route handlers, so we only check isLoggedIn here.
    if (!session.sessionId && !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    return response;
  } catch {
    // If session decryption fails (tampered cookie, wrong secret), deny access
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }
}
