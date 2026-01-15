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
  createClient,
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
    canViewSystemLogs: boolean;
    canViewServerLogs: boolean;
    canViewCrashLogs: boolean;
    canViewSessionLogs: boolean;
    canDiscover: boolean;
    accessibleDatabases: string[];
    username: string;
  };
  error?: string;
}

/**
 * Recursively resolve all effective roles for a user, including inherited roles.
 */
async function getEffectiveRoles(
  client: ReturnType<typeof createClient>,
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
 * Get access info including accessible databases and global access status.
 * Uses LENS_USER to query system.grants for accurate permission info.
 */
async function getAccessInfo(username: string): Promise<{
  databases: string[];
  hasGlobalAccess: boolean;
}> {
  // System/internal databases to exclude from user database lists
  const SYSTEM_DATABASES = [
    "system",
    "information_schema",
    "INFORMATION_SCHEMA",
  ];

  if (!isLensUserConfigured()) {
    // Fallback: can't determine, assume default access
    return { databases: ["default"], hasGlobalAccess: false };
  }

  const lensConfig = getLensConfig();
  if (!lensConfig) {
    return { databases: ["default"], hasGlobalAccess: false };
  }

  const client = createClient(lensConfig);
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

    return {
      databases: databases.length > 0 ? databases : [],
      hasGlobalAccess,
    };
  } catch (error) {
    console.error("Failed to get accessible databases:", error);
    // Fallback - safer than assuming access
    return { databases: [], hasGlobalAccess: false };
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

    const client = createClient(config);
    const username = config.username;

    // Run permission probes and accessible databases query in parallel
    const [effectiveRolesResult, featuresResult, accessInfoResult] =
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
          // view settings probe (system.settings) - WE USE THIS BUT ENFORCE STRICTER CHECKS LATER
          client.query("SELECT 1 FROM system.settings LIMIT 1"),
          // view server logs probe (system.text_log)
          client.query("SELECT 1 FROM system.text_log LIMIT 1"),
          // view crash logs probe
          client.query("SELECT 1 FROM system.crash_log LIMIT 1"),
          // view session logs probe
          client.query("SELECT 1 FROM system.session_log LIMIT 1"),
        ]),
        // 3. Get access info (databases + global flag) using LENS_USER
        getAccessInfo(username),
      ]);

    // Get effective roles
    const effectiveRoles =
      effectiveRolesResult.status === "fulfilled"
        ? effectiveRolesResult.value
        : new Set<string>();

    // Get access info
    const accessInfo =
      accessInfoResult.status === "fulfilled"
        ? accessInfoResult.value
        : { databases: [], hasGlobalAccess: false };

    const accessibleDatabases = accessInfo.databases;
    const hasGlobalAccess = accessInfo.hasGlobalAccess;

    // Process Probes
    let canManageUsers = false;
    let canViewProcesses = false;
    let canViewCluster = false;
    let canViewSettings = false;
    let canViewServerLogs = false;
    let canViewCrashLogs = false;
    let canViewSessionLogs = false;

    if (featuresResult.status === "fulfilled") {
      const results = featuresResult.value;

      // Index 0: canManageUsers
      if (results[0].status === "fulfilled") canManageUsers = true;

      // Index 1: canViewProcesses
      if (results[1].status === "fulfilled") canViewProcesses = true;

      // Index 2: canViewCluster
      if (results[2].status === "fulfilled") canViewCluster = true;

      // Index 3: canViewSettings (Probe only)
      // if (results[3].status === "fulfilled") hasSettingsAccessProbe = true;

      // Index 4: canViewServerLogs
      if (results[4]?.status === "fulfilled") canViewServerLogs = true;
      // Index 5: canViewCrashLogs
      if (results[5]?.status === "fulfilled") canViewCrashLogs = true;
      // Index 6: canViewSessionLogs
      if (results[6]?.status === "fulfilled") canViewSessionLogs = true;
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

    // 4. Settings Viewer: via clicklens_settings_admin role OR global access
    // STRICT CHECK: The probe might succeed for limited users if system.settings is public,
    // but the UI should only be shown for Global Admins or Role Holders.
    // We overwrite whatever the probe returned to enforce strict UI visibility.
    canViewSettings = effectiveRoles.has("clicklens_settings_admin");

    // If user has global access (*.*), they imply settings access
    if (hasGlobalAccess) {
      canViewSettings = true;
    }

    // Fallback: If the strict probe succeeds AND they have at least *some* database access beyond default?
    // Actually, user requested strictness. "no settings" for dungbh5.
    // So we invoke STRICT mode: Only Role OR Global Access allows Settings UI.
    // We IGNORE hasSettingsAccessProbe for the UI boolean, to be safe.
    // (Note: They can still query system.settings in SQL Console if ClickHouse allows it,
    // but the UI tab will be hidden).

    // Check Kill Query
    const canKillQueries =
      canManageUsers || effectiveRoles.has("clicklens_query_monitor");

    // 5. Logging: via clicklens_cluster_monitor role OR global access
    const hasMonitorRole = effectiveRoles.has("clicklens_cluster_monitor");
    const hasLogAccess = hasMonitorRole || hasGlobalAccess;

    if (!canViewServerLogs) canViewServerLogs = hasLogAccess;
    if (!canViewCrashLogs) canViewCrashLogs = hasLogAccess;
    if (!canViewSessionLogs) canViewSessionLogs = hasLogAccess;

    const canViewSystemLogs =
      canViewServerLogs || canViewCrashLogs || canViewSessionLogs;

    // NEW STRICT LOGIC for Tables and Queries

    // SQL Console: open to anyone who can query at least ONE database (user or system)
    // accessInfo.databases has user DBs. If they have global access, they have databases.
    const canExecuteQueries = accessibleDatabases.length > 0 || hasGlobalAccess;
    const canDiscover = accessibleDatabases.length > 0 || hasGlobalAccess;

    // Table Explorer: STRICTER.
    // Requires explicitly finding roles OR Global Access.
    // Mere access to 'logs' database is NOT enough to enable the full Table Explorer UI.
    const hasTableExplorerRole = effectiveRoles.has("clicklens_table_explorer");
    const canBrowseTables = hasTableExplorerRole || hasGlobalAccess;

    return NextResponse.json({
      success: true,
      permissions: {
        canManageUsers,
        canViewProcesses,
        canKillQueries,
        canViewCluster,
        canBrowseTables,
        canExecuteQueries,
        canDiscover,
        canViewSettings,
        canViewSystemLogs,
        canViewServerLogs,
        canViewCrashLogs,
        canViewSessionLogs,
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
