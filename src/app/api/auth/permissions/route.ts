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
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";
import { escapeSqlString } from "@/lib/clickhouse/utils";
import {
  hasGlobalAccessViaShowGrants,
  probeUserDatabaseAccess,
  probeUserTableAccess,
} from "@/lib/clickhouse/grants";

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
  username: string,
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
  const safeUser = escapeSqlString(username);

  try {
    // Get roles assigned to the user
    const rolesResult = await client.query(`
      SELECT granted_role_name as role
      FROM system.role_grants
      WHERE user_name = '${safeUser}'
    `);
    const rolesData = rolesResult.data as unknown as Array<{ role: string }>;

    const userRoles = rolesData
      .map((r) => `'${escapeSqlString(r.role)}'`)
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
    let hasGlobalAccess = cnt !== 0 && cnt !== "0" && cnt !== undefined;

    // Fallback: SHOW GRANTS catches XML-configured users and GRANT ALL
    // that may not appear in system.grants
    if (!hasGlobalAccess) {
      hasGlobalAccess = await hasGlobalAccessViaShowGrants(
        lensConfig,
        username,
      );
    }

    let databases: string[] = [];

    if (hasGlobalAccess) {
      // User has global access, get all non-system databases
      const result = await client.query(
        `SELECT name FROM system.databases ORDER BY name`,
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
        { status: 401 },
      );
    }

    const config = await getSessionClickHouseConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
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

    let accessibleDatabases = accessInfo.databases;
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
    canViewSettings = effectiveRoles.has("clicklens_settings_admin");

    // If user has global access (*.*), they imply settings access
    if (hasGlobalAccess) {
      canViewSettings = true;
    }

    // Check Kill Query
    const canKillQueries =
      canManageUsers || effectiveRoles.has("clicklens_query_monitor");

    // 5. Logging: via clicklens_cluster_monitor role OR global access OR probes
    const hasMonitorRole = effectiveRoles.has("clicklens_cluster_monitor");
    const hasLogAccess = hasMonitorRole || hasGlobalAccess;

    if (!canViewServerLogs) canViewServerLogs = hasLogAccess;
    if (!canViewCrashLogs) canViewCrashLogs = hasLogAccess;
    if (!canViewSessionLogs) canViewSessionLogs = hasLogAccess;

    const canViewSystemLogs =
      canViewServerLogs || canViewCrashLogs || canViewSessionLogs;

    // SQL Console and Discover: check accessInfo first, then probe fallback
    let canExecuteQueries = accessibleDatabases.length > 0 || hasGlobalAccess;
    let canDiscover = accessibleDatabases.length > 0 || hasGlobalAccess;

    // Table Explorer
    const hasTableExplorerRole = effectiveRoles.has("clicklens_table_explorer");
    let canBrowseTables = hasTableExplorerRole || hasGlobalAccess;

    // FALLBACK: If system.grants-based checks failed (e.g., XML-configured user),
    // probe with the user's own credentials to detect actual access
    if (
      !canExecuteQueries ||
      !canBrowseTables ||
      accessibleDatabases.length === 0
    ) {
      const probeResult = await probeUserDatabaseAccess(config);

      if (probeResult.hasAccess) {
        canExecuteQueries = true;
        canDiscover = true;

        // Use probed databases if we have none from system.grants
        if (accessibleDatabases.length === 0) {
          accessibleDatabases = probeResult.databases;
        }
      }

      if (!canBrowseTables && probeResult.hasAccess) {
        canBrowseTables = await probeUserTableAccess(config);
      }
    }

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

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check permissions. Please try again.",
      },
      { status: 500 },
    );
  }
}
