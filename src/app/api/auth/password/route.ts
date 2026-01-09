import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { getUserConfig, getLensConfig, createClient } from "@/lib/clickhouse";

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

    // Escape single quotes in password to prevent SQL injection in DDL
    // ClickHouse string literal escaping: ' -> \'
    const escapedPassword = newPassword
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'");

    try {
      await adminClient.command(
        `ALTER USER \`${session.user.username}\` IDENTIFIED BY '${escapedPassword}'`
      );
    } catch (e) {
      console.error("ClickHouse password change error:", e);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (e as any).message || "Unknown error";
      return NextResponse.json(
        {
          success: false,
          error: "Failed to change password: " + errorMessage,
        },
        { status: 500 }
      );
    }

    // 3. Update Session
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
