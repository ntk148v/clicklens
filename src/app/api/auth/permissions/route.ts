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

    // Check if user can access system.users (requires ACCESS MANAGEMENT)
    let canManageUsers = false;
    try {
      await client.query("SELECT 1 FROM system.users LIMIT 1");
      canManageUsers = true;
    } catch {
      canManageUsers = false;
    }

    // Check if user can view processes
    let canViewProcesses = false;
    try {
      await client.query("SELECT 1 FROM system.processes LIMIT 1");
      canViewProcesses = true;
    } catch {
      canViewProcesses = false;
    }

    // Check if user can kill queries (try SHOW PROCESSLIST which requires SHOW)
    let canKillQueries = false;
    try {
      await client.query("SHOW PROCESSLIST LIMIT 1");
      canKillQueries = true;
    } catch {
      canKillQueries = false;
    }

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
