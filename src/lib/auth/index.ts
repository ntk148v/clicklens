/**
 * Server-side session utilities
 */

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData, defaultSession } from "./session";

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
  return session.isLoggedIn && !!session.clickhouse;
}

/**
 * Get ClickHouse config from session
 */
export async function getSessionClickHouseConfig() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.clickhouse) {
    return null;
  }

  return session.clickhouse;
}
