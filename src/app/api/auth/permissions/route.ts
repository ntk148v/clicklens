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
    canBrowseTables: boolean;
    canExecuteQueries: boolean;
    canViewSettings: boolean;
    username: string;
  };
  error?: string;
}

/**
 * Recursively resolve all effective roles for a user, including inherited roles.
 */
async function getEffectiveRoles(
  client: ReturnType<typeof createClientWithConfig>,
  username: string
): Promise<Set<string>> {
  const effectiveRoles = new Set<string>();

  // Get all role grants (both user->role and role->role)
  const allGrantsResult = await client.query<{
    user_name: string | null;
    role_name: string | null;
    granted_role_name: string;
  }>(`
    SELECT user_name, role_name, granted_role_name
    FROM system.role_grants
  `);

  // Build maps for efficient lookup
  const userRoles = new Map<string, string[]>(); // user -> direct roles
  const roleInheritance = new Map<string, string[]>(); // role -> child roles

  for (const grant of allGrantsResult.data) {
    if (grant.user_name) {
      // User -> Role grant
      if (!userRoles.has(grant.user_name)) {
        userRoles.set(grant.user_name, []);
      }
      userRoles.get(grant.user_name)!.push(grant.granted_role_name);
    } else if (grant.role_name) {
      // Role -> Role inheritance
      if (!roleInheritance.has(grant.role_name)) {
        roleInheritance.set(grant.role_name, []);
      }
      roleInheritance.get(grant.role_name)!.push(grant.granted_role_name);
    }
  }

  // Recursively collect all roles
  function collectRoles(roleName: string) {
    if (effectiveRoles.has(roleName)) return; // Avoid cycles
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

  return effectiveRoles;
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

    // Run permission probes and role resolution in parallel
    const [effectiveRolesResult, featuresResult] = await Promise.allSettled([
      // 1. Get all effective roles (including inherited)
      getEffectiveRoles(client, config.username),
      // 2. Run probes
      Promise.allSettled([
        // manage users probe
        client.query("SHOW CREATE USER CURRENT_USER"),
        // view processes probe
        client.query("SELECT 1 FROM system.processes LIMIT 1"),
        // view cluster probe (system.metrics)
        client.query("SELECT 1 FROM system.metrics LIMIT 1"),
        // browse tables probe (system.tables)
        client.query("SELECT 1 FROM system.tables LIMIT 1"),
        // execute queries probe (simple SELECT)
        client.query("SELECT 1"),
        // view settings probe (system.settings)
        client.query("SELECT 1 FROM system.settings LIMIT 1"),
      ]),
    ]);

    // Get effective roles
    const effectiveRoles =
      effectiveRolesResult.status === "fulfilled"
        ? effectiveRolesResult.value
        : new Set<string>();

    // Process Probes
    let canManageUsers = false;
    let canViewProcesses = false;
    let canViewCluster = false;
    let canBrowseTables = false;

    let canExecuteQueries = false;
    let canViewSettings = false;

    if (featuresResult.status === "fulfilled") {
      const results = featuresResult.value;

      // Index 0: canManageUsers
      if (results[0].status === "fulfilled") canManageUsers = true;

      // Index 1: canViewProcesses
      if (results[1].status === "fulfilled") canViewProcesses = true;

      // Index 2: canViewCluster
      if (results[2].status === "fulfilled") canViewCluster = true;

      // Index 3: canBrowseTables
      if (results[3].status === "fulfilled") canBrowseTables = true;

      // Index 4: canExecuteQueries
      if (results[4].status === "fulfilled") canExecuteQueries = true;

      // Index 5: canViewSettings
      if (results[5].status === "fulfilled") canViewSettings = true;
    }

    // Check permissions based on effective roles (including inherited)
    // 1. User Admin: via clicklens_user_admin role
    if (!canManageUsers) {
      canManageUsers = effectiveRoles.has("clicklens_user_admin");
    }

    // 2. Query Monitor: via clicklens_query_monitor role
    if (!canViewProcesses) {
      canViewProcesses = effectiveRoles.has("clicklens_query_monitor");
    }

    // 3. Cluster Monitor: via clicklens_cluster_monitor role
    if (!canViewCluster) {
      canViewCluster = effectiveRoles.has("clicklens_cluster_monitor");
    }

    // 4. Table Explorer: via clicklens_table_explorer role
    if (!canBrowseTables) {
      canBrowseTables = effectiveRoles.has("clicklens_table_explorer");
    }

    // 5. Settings Viewer: via clicklens_settings_admin role
    if (!canViewSettings) {
      canViewSettings = effectiveRoles.has("clicklens_settings_admin");
    }

    // Check Kill Query
    const canKillQueries =
      canManageUsers || effectiveRoles.has("clicklens_query_monitor");

    return NextResponse.json({
      success: true,
      permissions: {
        canManageUsers,
        canViewProcesses,
        canKillQueries,
        canViewCluster,
        canBrowseTables,
        canExecuteQueries,
        canViewSettings,
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
