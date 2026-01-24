/**
 * Authorization utilities for API routes
 *
 * Provides permission checking for protected endpoints.
 * Uses the same permission logic as /api/auth/permissions.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionClickHouseConfig } from "./index";
import { createClient, isLensUserConfigured, getLensConfig } from "@/lib/clickhouse";

/**
 * Available permission types
 */
export type Permission =
  | "canManageUsers"
  | "canViewProcesses"
  | "canKillQueries"
  | "canViewCluster"
  | "canBrowseTables"
  | "canExecuteQueries"
  | "canViewSettings"
  | "canViewSystemLogs"
  | "canViewServerLogs"
  | "canViewCrashLogs"
  | "canViewSessionLogs"
  | "canDiscover";

/**
 * Standard error response for authorization failures
 */
interface AuthErrorResponse {
  success: false;
  error: string;
}

/**
 * Check if user has a specific permission
 * Returns null if authorized, or a typed error response if not authorized
 */
export async function checkPermission(
  permission: Permission
): Promise<NextResponse<AuthErrorResponse> | null> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json<AuthErrorResponse>(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const config = await getSessionClickHouseConfig();
  if (!config) {
    return NextResponse.json<AuthErrorResponse>(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const client = createClient(config);
  const username = config.username;

  try {
    // Get effective roles for the user
    const effectiveRoles = await getEffectiveRoles(client, username);

    // Check if user has global access
    const hasGlobalAccess = await checkGlobalAccess(username);

    // Check the specific permission
    const hasPermission = await checkSpecificPermission(
      client,
      permission,
      effectiveRoles,
      hasGlobalAccess
    );

    if (!hasPermission) {
      return NextResponse.json<AuthErrorResponse>(
        {
          success: false,
          error: `Permission denied: ${permission} required`,
        },
        { status: 403 }
      );
    }

    return null; // Authorized
  } catch (error) {
    console.error("Authorization check failed:", error);
    return NextResponse.json<AuthErrorResponse>(
      { success: false, error: "Authorization check failed" },
      { status: 500 }
    );
  }
}

/**
 * Get all effective roles for a user (including inherited roles)
 */
async function getEffectiveRoles(
  client: ReturnType<typeof createClient>,
  username: string
): Promise<Set<string>> {
  const effectiveRoles = new Set<string>();

  try {
    // Get all role grants
    const allGrantsResult = await client.query<{
      user_name: string | null;
      role_name: string | null;
      granted_role_name: string;
    }>(`
      SELECT user_name, role_name, granted_role_name
      FROM system.role_grants
    `);

    // Build maps for efficient lookup
    const userRoles = new Map<string, string[]>();
    const roleInheritance = new Map<string, string[]>();

    for (const grant of allGrantsResult.data) {
      if (grant.user_name) {
        if (!userRoles.has(grant.user_name)) {
          userRoles.set(grant.user_name, []);
        }
        userRoles.get(grant.user_name)!.push(grant.granted_role_name);
      } else if (grant.role_name) {
        if (!roleInheritance.has(grant.role_name)) {
          roleInheritance.set(grant.role_name, []);
        }
        roleInheritance.get(grant.role_name)!.push(grant.granted_role_name);
      }
    }

    // Recursively collect all roles
    function collectRoles(roleName: string) {
      if (effectiveRoles.has(roleName)) return;
      effectiveRoles.add(roleName);

      const children = roleInheritance.get(roleName) || [];
      for (const child of children) {
        collectRoles(child);
      }
    }

    // Start from user's direct roles
    const directRoles = userRoles.get(username) || [];
    for (const role of directRoles) {
      collectRoles(role);
    }
  } catch {
    // If we can't get roles, return empty set
  }

  return effectiveRoles;
}

/**
 * Check if user has global access (*.*)
 */
async function checkGlobalAccess(username: string): Promise<boolean> {
  if (!isLensUserConfigured()) {
    return false;
  }

  const lensConfig = getLensConfig();
  if (!lensConfig) {
    return false;
  }

  try {
    const client = createClient(lensConfig);
    const safeUser = username.replace(/'/g, "''");

    // Get user's roles
    const rolesResult = await client.query(`
      SELECT granted_role_name as role
      FROM system.role_grants
      WHERE user_name = '${safeUser}'
    `);
    const rolesData = rolesResult.data as unknown as Array<{ role: string }>;

    const userRoles = rolesData
      .map((r) => `'${r.role.replace(/'/g, "''")}'`)
      .join(",");

    const grantFilter = userRoles
      ? `(user_name = '${safeUser}' OR role_name IN (${userRoles}))`
      : `user_name = '${safeUser}'`;

    // Check for global access
    const globalCheck = await client.query(`
      SELECT count() as cnt FROM system.grants
      WHERE ${grantFilter}
      AND (database IS NULL OR database = '*')
      AND access_type IN ('SELECT', 'ALL')
    `);

    const globalData = globalCheck.data as unknown as Array<{
      cnt: string | number;
    }>;
    const cnt = globalData[0]?.cnt;
    return cnt !== 0 && cnt !== "0" && cnt !== undefined;
  } catch {
    return false;
  }
}

/**
 * Check a specific permission based on roles and probes
 */
async function checkSpecificPermission(
  client: ReturnType<typeof createClient>,
  permission: Permission,
  effectiveRoles: Set<string>,
  hasGlobalAccess: boolean
): Promise<boolean> {
  switch (permission) {
    case "canManageUsers":
      // Check via probe or role
      if (effectiveRoles.has("clicklens_user_admin")) return true;
      try {
        await client.query("SHOW CREATE USER CURRENT_USER");
        return true;
      } catch {
        return false;
      }

    case "canViewProcesses":
      if (effectiveRoles.has("clicklens_query_monitor")) return true;
      try {
        await client.query("SELECT 1 FROM system.processes LIMIT 1");
        return true;
      } catch {
        return false;
      }

    case "canKillQueries":
      // Same as canManageUsers or query monitor role
      if (effectiveRoles.has("clicklens_user_admin")) return true;
      if (effectiveRoles.has("clicklens_query_monitor")) return true;
      try {
        await client.query("SHOW CREATE USER CURRENT_USER");
        return true;
      } catch {
        return false;
      }

    case "canViewCluster":
      if (effectiveRoles.has("clicklens_cluster_monitor")) return true;
      try {
        await client.query("SELECT 1 FROM system.metrics LIMIT 1");
        return true;
      } catch {
        return false;
      }

    case "canBrowseTables":
      if (effectiveRoles.has("clicklens_table_explorer")) return true;
      return hasGlobalAccess;

    case "canExecuteQueries":
    case "canDiscover":
      // Anyone with database access can execute queries
      return hasGlobalAccess || effectiveRoles.size > 0;

    case "canViewSettings":
      if (effectiveRoles.has("clicklens_settings_admin")) return true;
      return hasGlobalAccess;

    case "canViewSystemLogs":
    case "canViewServerLogs":
      if (effectiveRoles.has("clicklens_cluster_monitor")) return true;
      if (hasGlobalAccess) return true;
      try {
        await client.query("SELECT 1 FROM system.text_log LIMIT 1");
        return true;
      } catch {
        return false;
      }

    case "canViewCrashLogs":
      if (effectiveRoles.has("clicklens_cluster_monitor")) return true;
      if (hasGlobalAccess) return true;
      try {
        await client.query("SELECT 1 FROM system.crash_log LIMIT 1");
        return true;
      } catch {
        return false;
      }

    case "canViewSessionLogs":
      if (effectiveRoles.has("clicklens_cluster_monitor")) return true;
      if (hasGlobalAccess) return true;
      try {
        await client.query("SELECT 1 FROM system.session_log LIMIT 1");
        return true;
      } catch {
        return false;
      }

    default:
      return false;
  }
}
