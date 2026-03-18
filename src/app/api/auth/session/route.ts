/**
 * API route for checking session status
 * GET /api/auth/session
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/auth/csrf";

export interface SessionResponse {
  isLoggedIn: boolean;
  user?: {
    username: string;
    host?: string;
    database?: string;
  };
  csrfToken?: string;
}

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const cookieStore = await cookies();
  let csrfToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfToken) {
    csrfToken = await generateCsrfToken();
  }

  return NextResponse.json({
    isLoggedIn: true,
    user: {
      username: session.user.username,
      host: session.user.host,
      database: session.user.database,
    },
    csrfToken,
  });
}
