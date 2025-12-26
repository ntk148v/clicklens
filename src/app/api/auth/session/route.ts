/**
 * API route for checking session status
 * GET /api/auth/session
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export interface SessionResponse {
  isLoggedIn: boolean;
  user?: {
    host: string;
    username: string;
    database: string;
  };
}

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.clickhouse) {
    return NextResponse.json({ isLoggedIn: false });
  }

  return NextResponse.json({
    isLoggedIn: true,
    user: {
      host: session.clickhouse.host,
      username: session.clickhouse.username,
      database: session.clickhouse.database,
    },
  });
}
