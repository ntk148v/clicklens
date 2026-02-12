import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { getUserConfig, getLensConfig, createClient } from "@/lib/clickhouse";
import { escapeSqlString, quoteIdentifier } from "@/lib/clickhouse/utils";
import { updateSessionPassword } from "@/lib/auth/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: "New password is required" },
        { status: 400 }
      );
    }

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: "Current password is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(
      cookieStore,
      sessionOptions
    );

    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 1. Verify Verification: Connect as the user to prove they know the current password
    // We cannot blindly trust session.user.password because sessions might persist after external password changes (edge case),
    // and crucially we must verify the provided `currentPassword` is actually good.
    const userUserConfig = getUserConfig({
      username: session.user.username,
      password: currentPassword,
    });

    if (!userUserConfig) {
      return NextResponse.json(
        { success: false, error: "Configuration error" },
        { status: 500 }
      );
    }

    const userClient = createClient(userUserConfig);
    try {
      // Simple probe to verify credentials
      await userClient.query("SELECT 1");
    } catch (e) {
      console.warn(
        "Password verification failed for user",
        session.user.username,
        e
      );
      return NextResponse.json(
        { success: false, error: "Current password incorrect" },
        { status: 401 }
      );
    }

    // 2. Execution: Connect as lens_admin (service user) to perform the alteration
    const adminConfig = getLensConfig();
    if (!adminConfig) {
      return NextResponse.json(
        { success: false, error: "Server admin configuration missing" },
        { status: 500 }
      );
    }

    const adminClient = createClient(adminConfig);

    // Use consistent escaping from shared utility to prevent SQL injection
    const escapedPassword = escapeSqlString(newPassword);
    const quotedUsername = quoteIdentifier(session.user.username);

    try {
      await adminClient.command(
        `ALTER USER ${quotedUsername} IDENTIFIED BY '${escapedPassword}'`,
      );
    } catch (e) {
      console.error("ClickHouse password change error:", e);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to change password",
        },
        { status: 500 },
      );
    }

    // 3. Update both session stores to keep credentials in sync
    // Update server-side session store
    if (session.sessionId) {
      updateSessionPassword(session.sessionId, newPassword);
    }
    // Update iron-session cookie (for hydration on next request)
    session.user.password = newPassword;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
