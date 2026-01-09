/**
 * API route for logging out
 * POST /api/auth/logout
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

  session.isLoggedIn = false;
  session.user = undefined;
  await session.save();

  return NextResponse.json({ success: true });
}
