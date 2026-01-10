/**
 * API route for checking session status
 * GET /api/auth/session
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export interface SessionResponse {
  isLoggedIn: boolean;
  user?: {
    username: string;
    host?: string;
    database?: string;
  };
}

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isLoggedIn: false });
  }

  return NextResponse.json({
    isLoggedIn: true,
    user: {
      username: session.user.username,
      host: session.user.host,
      database: session.user.database,
    },
  });
}
