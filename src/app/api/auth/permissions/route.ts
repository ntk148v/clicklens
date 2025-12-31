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
    canViewCluster: boolean;
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

    // Run permission probes in parallel to reduce latency
    const [grantsResult, featuresResult] = await Promise.allSettled([
      // 1. Get Grants strict check
      client.query<{ grant: string }>("SHOW GRANTS FOR CURRENT_USER"),
      // 2. Run probes
      Promise.allSettled([
        // manage users probe
        client.query("SHOW CREATE USER CURRENT_USER"),
        // view processes probe
        client.query("SELECT 1 FROM system.processes LIMIT 1"),
        // view cluster probe (system.metrics)
        client.query("SELECT 1 FROM system.metrics LIMIT 1"),
      ]),
    ]);

    // Process Grants
    const grantStrings =
      grantsResult.status === "fulfilled"
        ? grantsResult.value.data.map((r) => r.grant)
        : [];

    // Process Probes
    let canManageUsers = false;
    let canViewProcesses = false;
    let canViewCluster = false;

    if (featuresResult.status === "fulfilled") {
      const results = featuresResult.value;

      // Index 0: canManageUsers
      if (results[0].status === "fulfilled") canManageUsers = true;

      // Index 1: canViewProcesses
      if (results[1].status === "fulfilled") canViewProcesses = true;

      // Index 2: canViewCluster
      if (results[2].status === "fulfilled") canViewCluster = true;
    }

    // Check Kill Query (fallback to strict grants or admin status)
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
        canViewCluster,
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
