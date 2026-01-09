/**
 * API route to check current user's permissions/capabilities
 * GET /api/auth/permissions
 *
 * Uses LENS_USER (service account) to query system.grants for accurate
 * database-level permissions, similar to /api/clickhouse/databases.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClientWithConfig,
  isClickHouseError,
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";

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
    accessibleDatabases: string[];
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

/**
 * Get list of accessible non-system databases for the user.
 * Uses LENS_USER to query system.grants for accurate permission info.
 */
async function getAccessibleDatabases(username: string): Promise<string[]> {
  // System/internal databases to exclude from user database lists
  const SYSTEM_DATABASES = [
    "system",
    "information_schema",
    "INFORMATION_SCHEMA",
  ];

  if (!isLensUserConfigured()) {
    // Fallback: can't determine, assume default access
    return ["default"];
  }

  const lensConfig = getLensConfig();
  if (!lensConfig) {
    return ["default"];
  }

  const client = createClientWithConfig(lensConfig);
  const safeUser = username.replace(/'/g, "''");

  try {
    // Get roles assigned to the user
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

    // Check global access (direct or through roles)
    const globalCheckQuery = `
      SELECT count() as cnt FROM system.grants
      WHERE ${grantFilter}
      AND (database IS NULL OR database = '*')
      AND access_type IN ('SELECT', 'ALL')
    `;

    const globalCheck = await client.query(globalCheckQuery);
    const globalData = globalCheck.data as unknown as Array<{
      cnt: string | number;
    }>;
    const cnt = globalData[0]?.cnt;
    const hasGlobalAccess = cnt !== 0 && cnt !== "0" && cnt !== undefined;

    let databases: string[] = [];

    if (hasGlobalAccess) {
      // User has global access, get all non-system databases
      const result = await client.query(
        `SELECT name FROM system.databases ORDER BY name`
      );
      const allDbs = result.data as unknown as Array<{ name: string }>;
      databases = allDbs
        .map((db) => db.name)
        .filter((name) => !SYSTEM_DATABASES.includes(name));
    } else {
      // Get databases from direct grants and role grants
      const dbQuery = `
        SELECT DISTINCT database as name FROM system.grants
        WHERE ${grantFilter}
        AND database IS NOT NULL
        AND database != '*'
        AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
      `;

      const result = await client.query(`
        SELECT DISTINCT name FROM (
          ${dbQuery}
          UNION ALL
          SELECT 'default' as name
        )
        WHERE name IN (SELECT name FROM system.databases)
        ORDER BY name
      `);

      const grantedDbs = result.data as unknown as Array<{ name: string }>;
      databases = grantedDbs
        .map((db) => db.name)
        .filter((name) => !SYSTEM_DATABASES.includes(name));
    }

    return databases.length > 0 ? databases : [];
  } catch (error) {
    console.error("Failed to get accessible databases:", error);
    // Fallback to empty - safer than assuming access
    return [];
  }
}

export async function GET(): Promise<NextResponse<PermissionsResponse>> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const config = await getSessionClickHouseConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);
    const username = config.username;

    // Run permission probes and accessible databases query in parallel
    const [effectiveRolesResult, featuresResult, accessibleDbsResult] =
      await Promise.allSettled([
        // 1. Get all effective roles (including inherited)
        getEffectiveRoles(client, username),
        // 2. Run probes using user's credentials
        Promise.allSettled([
          // manage users probe
          client.query("SHOW CREATE USER CURRENT_USER"),
          // view processes probe
          client.query("SELECT 1 FROM system.processes LIMIT 1"),
          // view cluster probe (system.metrics)
          client.query("SELECT 1 FROM system.metrics LIMIT 1"),
          // view settings probe (system.settings)
          client.query("SELECT 1 FROM system.settings LIMIT 1"),
        ]),
        // 3. Get accessible databases using LENS_USER
        getAccessibleDatabases(username),
      ]);

    // Get effective roles
    const effectiveRoles =
      effectiveRolesResult.status === "fulfilled"
        ? effectiveRolesResult.value
        : new Set<string>();

    // Get accessible databases
    const accessibleDatabases =
      accessibleDbsResult.status === "fulfilled"
        ? accessibleDbsResult.value
        : [];

    // Process Probes
    let canManageUsers = false;
    let canViewProcesses = false;
    let canViewCluster = false;
    let canViewSettings = false;

    if (featuresResult.status === "fulfilled") {
      const results = featuresResult.value;

      // Index 0: canManageUsers
      if (results[0].status === "fulfilled") canManageUsers = true;

      // Index 1: canViewProcesses
      if (results[1].status === "fulfilled") canViewProcesses = true;

      // Index 2: canViewCluster
      if (results[2].status === "fulfilled") canViewCluster = true;

      // Index 3: canViewSettings
      if (results[3].status === "fulfilled") canViewSettings = true;
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

    // 4. Settings Viewer: via clicklens_settings_admin role
    if (!canViewSettings) {
      canViewSettings = effectiveRoles.has("clicklens_settings_admin");
    }

    // Check Kill Query
    const canKillQueries =
      canManageUsers || effectiveRoles.has("clicklens_query_monitor");

    // NEW: canBrowseTables and canExecuteQueries require at least one accessible database
    // or having the clicklens_table_explorer role
    const hasTableExplorerRole = effectiveRoles.has("clicklens_table_explorer");
    const canBrowseTables =
      hasTableExplorerRole || accessibleDatabases.length > 0;
    const canExecuteQueries = accessibleDatabases.length > 0;

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
        accessibleDatabases,
        username,
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
