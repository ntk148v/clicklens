/**
 * API route for logging out
 * POST /api/auth/logout
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

import { destroySession } from "@/lib/auth/storage";

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions,
  );

  if (session.sessionId) {
    destroySession(session.sessionId);
  }

  session.destroy();

  // Create a response that clears the cookie
  // Note: session.destroy() in iron-session handles the cookie logic if we save?
  // Actually, session.destroy() removes the session data.
  // We should also return a response.

  // Iron-session v8: session.destroy() wipes the object.
  // We need to return the response.
  return NextResponse.json({ success: true });
}
