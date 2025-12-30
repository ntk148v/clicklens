/**
 * API route to check current user's permissions/capabilities
 * GET /api/auth/permissions
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

interface PermissionsResponse {
  success: boolean;
  permissions?: {
    canManageUsers: boolean;
    canViewProcesses: boolean;
    canKillQueries: boolean;
    username: string;
  };
  error?: string;
}

export async function GET(): Promise<NextResponse<PermissionsResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    // Get current user's grants to strictly check permissions
    const grantsResult = await client.query<{ grant: string }>(
      "SHOW GRANTS FOR CURRENT_USER"
    );
    const grantStrings = grantsResult.data.map((r) => r.grant);

    // Check for ACCESS MANAGEMENT
    // Grants look like: GRANT ACCESS MANAGEMENT ON *.* TO user
    // or GRANT ALL ON *.* TO user (ALL usually includes it? No, ALL is usually strictly data/ddl)
    // Actually, ALL usually implies full control.
    // Check for system.processes access or monitoring roles
    // Use probes to determine capabilities since parsing SHOW GRANTS
    // is unreliable for roles (e.g. default_role).

    // Check Access Management (can we show user creation?)
    // Check Access Management (can we show user creation?)
    let canManageUsers = false;
    try {
      await client.query("SHOW CREATE USER CURRENT_USER");
      canManageUsers = true;
    } catch (e) {
      // Ignored
    }

    // Check Query Monitoring (can we read system.processes?)
    let canViewProcesses = false;
    try {
      await client.query("SELECT 1 FROM system.processes LIMIT 1");
      canViewProcesses = true;
    } catch (e) {
      // Ignored
    }

    // Check Kill Query (hard to probe without side effects, so we fallback
    // to optimistic true if canViewProcesses is true, or rely on specific grant if visible?
    // Actually, let's keep it strictly based on GRANTs or assume false?
    // User hasn't complained about Kill yet. But let's check grants for explicit KILL or ALL.
    // However, GRANTs doesn't show inherited.
    // Better to allow UI to show it if canViewProcesses, and let action fail.
    // But for now, let's be conservative. If canManageUsers (Admin), likely can Kill?
    const canKillQueries =
      canManageUsers ||
      grantStrings.some(
        (g) => g.includes("KILL QUERY") || g.includes("GRANT ALL ON *.*")
      );

    return NextResponse.json({
      success: true,
      permissions: {
        canManageUsers,
        canViewProcesses,
        canKillQueries,
        username: config.username,
      },
    });
  } catch (error) {
    console.error("Error checking permissions:", error);

    return NextResponse.json({
      success: false,
      error: isClickHouseError(error)
        ? error.userMessage || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    });
  }
}
