/**
 * Server-side session utilities
 */

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, type SessionData, defaultSession } from "./session";
import { getUserConfig } from "@/lib/clickhouse";
import type { ClickHouseConfig } from "@/lib/clickhouse";

// Re-export authorization utilities
export { checkPermission, type Permission } from "./authorization";

import { getSessionUser } from "./storage";

/**
 * Get the current session from cookies
 */
export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions,
  );

  // If session has sessionId, try to hydration user from server store
  if (session.sessionId && !session.user) {
    const user = getSessionUser(session.sessionId);
    if (user) {
      // Reconstitute user object for the request duration
      // We cast this to match the SessionData structure expected by consumers
      session.user = user;
    } else {
      // Session expired or server restarted - invalidate
      session.isLoggedIn = false;
      session.sessionId = undefined;
    }
  }

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
  }

  return session;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn && !!session.user;
}

/**
 * Get ClickHouse config from session (for end-user queries)
 * Combines server connection (from env) with user credentials (from session)
 */
export async function getSessionClickHouseConfig(): Promise<ClickHouseConfig | null> {
  const session = await getSession();

  // getSession already hydrates session.user from storage if sessionId is present
  if (!session.isLoggedIn || !session.user) {
    return null;
  }

  return getUserConfig(session.user);
}

/**
 * Require authenticated session with a valid ClickHouse config.
 * Returns session data and config, or a NextResponse error.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const { session, config } = auth;
 */
export async function requireAuth(): Promise<
  | { session: SessionData; config: ClickHouseConfig }
  | NextResponse<{ success: false; error: string }>
> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json(
      { success: false as const, error: "Not authenticated" },
      { status: 401 },
    );
  }

  const config = getUserConfig(session.user);
  if (!config) {
    return NextResponse.json(
      { success: false as const, error: "Server configuration error" },
      { status: 500 },
    );
  }

  return { session: session as SessionData, config };
}
