/**
 * Server-side session utilities
 */

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData, defaultSession } from "./session";
import { getUserConfig } from "@/lib/clickhouse";
import type { ClickHouseConfig } from "@/lib/clickhouse";

/**
 * Get the current session from cookies
 */
export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

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

  if (!session.isLoggedIn || !session.user) {
    return null;
  }

  return getUserConfig(session.user);
}
