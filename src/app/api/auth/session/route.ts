/**
 * API route for checking session status
 * GET /api/auth/session
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserPermissions, UserPermissions } from "@/lib/auth/permissions";

export interface SessionResponse {
  isLoggedIn: boolean;
  user?: {
    username: string;
  };
  permissions?: UserPermissions;
}

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isLoggedIn: false });
  }

  // Get permissions for the user
  const permissions = await getUserPermissions(session.user.username);

  return NextResponse.json({
    isLoggedIn: true,
    user: {
      username: session.user.username,
    },
    permissions,
  });
}
