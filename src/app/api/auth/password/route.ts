import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserConfig, getLensConfig, createClient } from "@/lib/clickhouse";
import { escapeSqlString, quoteIdentifier } from "@/lib/clickhouse/utils";
import { updateSessionPassword } from "@/lib/auth/storage";
import { checkRateLimit, getClientIdentifier } from "@/lib/auth/rate-limit";
import { requireCsrf } from "@/lib/auth/csrf";
import { getClusterName } from "@/lib/clickhouse/cluster";

export async function POST(request: NextRequest) {
  try {
    // CSRF protection for state-changing operation
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    // Rate limiting check - 5 attempts per minute per IP
    const clientIp = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(clientIp, {
      maxRequests: 5,
      windowMs: 60000,
    });

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetIn / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many password change attempts. Please try again in ${retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    const MIN_PASSWORD_LENGTH = 8;

    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: "New password is required" },
        { status: 400 },
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 },
      );
    }

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: "Current password is required" },
        { status: 400 },
      );
    }

    const session = await getSession();

    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
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
        { status: 500 },
      );
    }

    const userClient = createClient(userUserConfig);
    try {
      // Simple probe to verify credentials
      await userClient.query("SELECT 1");
    } catch (e) {
      console.warn("Password verification failed for session:", session.sessionId, e);
      return NextResponse.json(
        { success: false, error: "Current password incorrect" },
        { status: 401 },
      );
    }

    // 2. Execution: Connect as lens_admin (service user) to perform the alteration
    const adminConfig = getLensConfig();
    if (!adminConfig) {
      return NextResponse.json(
        { success: false, error: "Server admin configuration missing" },
        { status: 500 },
      );
    }

    const adminClient = createClient(adminConfig);
    const clusterName = await getClusterName(adminClient);
    const onCluster = clusterName
      ? ` ON CLUSTER ${quoteIdentifier(clusterName)}`
      : "";

    // Use consistent escaping from shared utility to prevent SQL injection
    const escapedPassword = escapeSqlString(newPassword);
    const quotedUsername = quoteIdentifier(session.user.username);

    try {
      await adminClient.command(
        `ALTER USER IF EXISTS ${quotedUsername}${onCluster} IDENTIFIED BY '${escapedPassword}'`,
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

    // Update server-side session store only (password stays out of the cookie)
    if (session.sessionId) {
      updateSessionPassword(session.sessionId, newPassword);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      },
      { status: 500 },
    );
  }
}
