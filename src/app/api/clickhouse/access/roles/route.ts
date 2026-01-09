/**
 * API route for managing ClickHouse roles
 *
 * - Feature roles (clicklens_*) are auto-created and shown as view-only
 * - User roles can inherit from feature roles and have custom data privileges
 * - System database privileges are blocked
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClient,
  isClickHouseError,
  type SystemRole,
  type SystemGrant,
} from "@/lib/clickhouse";
import {
  FEATURE_ROLES,
  isFeatureRole,
  isRestrictedDatabase,
  getFeatureRole,
  checkConfiguredFeature,
  FEATURE_ROLE_PREFIX,
  type DataPrivilege,
  type DataPrivilegeType,
} from "@/lib/rbac";

export interface RoleWithPrivileges extends SystemRole {
  isFeatureRole: boolean;
  featureRoleInfo?: {
    name: string;
    description: string;
    details: string;
  };
  inheritedRoles?: string[]; // Child roles (including feature roles)
  dataPrivileges?: DataPrivilege[];
  grants?: SystemGrant[];
  effectiveFeatureRoles?: string[];
}

export interface RolesResponse {
  success: boolean;
  data?: RoleWithPrivileges[];
  error?: string;
}

import { quoteIdentifier } from "@/lib/clickhouse/utils";

// Ensure feature roles exist (auto-create on first access)
async function ensureFeatureRoles(
  client: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Check which feature roles exist
    const existingRoles = await client.query<{ name: string }>(`
      SELECT name FROM system.roles WHERE name LIKE '${FEATURE_ROLE_PREFIX}%'
    `);
    const existingSet = new Set(existingRoles.data.map((r) => r.name));

    // Create missing feature roles
    for (const fr of FEATURE_ROLES) {
      if (!existingSet.has(fr.id)) {
        try {
          await client.command(`CREATE ROLE IF NOT EXISTS \`${fr.id}\``);
          for (const grant of fr.grants) {
            try {
              await client.command(grant);
            } catch {
              // Ignore individual grant failures
            }
          }
        } catch {
          // Ignore role creation failures (may lack permissions)
        }
      }
    }
  } catch {
    // Ignore errors - user may not have permissions
  }
}

// Extract data privileges from grants (non-system grants)
function extractDataPrivileges(grants: SystemGrant[]): DataPrivilege[] {
  const dataPrivileges: DataPrivilege[] = [];
  const dataPrivMap = new Map<string, Set<DataPrivilegeType>>();

  const dataPrivTypes = ["SELECT", "INSERT", "ALTER", "CREATE", "DROP TABLE"];

  for (const grant of grants) {
    // Skip system database grants
    if (grant.database && isRestrictedDatabase(grant.database)) continue;

    const accessType = grant.access_type.toUpperCase();

    if (dataPrivTypes.includes(accessType)) {
      const key = `${grant.database || "*"}:${grant.table || "*"}`;
      if (!dataPrivMap.has(key)) {
        dataPrivMap.set(key, new Set());
      }
      dataPrivMap.get(key)!.add(accessType as DataPrivilegeType);
    }
  }

  for (const [key, privs] of dataPrivMap) {
    const [database, table] = key.split(":");
    dataPrivileges.push({
      database: database || "*",
      table: table || "*",
      privileges: Array.from(privs),
    });
  }

  return dataPrivileges;
}

// GET: List all roles (including feature roles as view-only)
export async function GET(): Promise<NextResponse<RolesResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClient(config);

    // Auto-create feature roles if missing
    await ensureFeatureRoles(client);

    // Get all roles
    const rolesResult = await client.query<SystemRole>(`
      SELECT name, id, storage
      FROM system.roles
      ORDER BY name
    `);

    // Get role grants (which roles are granted to which roles)
    const roleGrantsResult = await client.query<{
      role_name: string;
      granted_role_name: string;
    }>(`
      SELECT role_name, granted_role_name
      FROM system.role_grants
    `);

    // Get privilege grants for all roles
    const grantsResult = await client.query<SystemGrant>(`
      SELECT
        user_name,
        role_name,
        access_type,
        database,
        table,
        column,
        is_partial_revoke,
        grant_option
      FROM system.grants
      WHERE role_name IS NOT NULL
    `);

    // Build role -> inherited roles map
    const roleInheritedMap = new Map<string, string[]>();
    for (const rg of roleGrantsResult.data) {
      if (!roleInheritedMap.has(rg.role_name)) {
        roleInheritedMap.set(rg.role_name, []);
      }
      roleInheritedMap.get(rg.role_name)!.push(rg.granted_role_name);
    }

    // Build role -> grants map
    const roleGrantsMap = new Map<string, SystemGrant[]>();
    for (const grant of grantsResult.data) {
      if (grant.role_name) {
        if (!roleGrantsMap.has(grant.role_name)) {
          roleGrantsMap.set(grant.role_name, []);
        }
        roleGrantsMap.get(grant.role_name)!.push(grant);
      }
    }

    // Enrich roles
    const rolesWithPrivileges: RoleWithPrivileges[] = rolesResult.data.map(
      (role) => {
        const grants = roleGrantsMap.get(role.name) || [];
        const isFr = isFeatureRole(role.name);
        const frInfo = isFr ? getFeatureRole(role.name) : undefined;

        return {
          ...role,
          isFeatureRole: isFr,
          featureRoleInfo: frInfo
            ? {
                name: frInfo.name,
                description: frInfo.description,
                details: frInfo.details,
              }
            : undefined,
          grants,
          inheritedRoles: roleInheritedMap.get(role.name) || [],
          dataPrivileges: extractDataPrivileges(grants),
          effectiveFeatureRoles: !isFr
            ? FEATURE_ROLES.filter((fr) =>
                checkConfiguredFeature(
                  fr.id,
                  grants.map((g) => ({
                    access_type: g.access_type,
                    database: g.database || undefined,
                    table: g.table || undefined,
                  }))
                )
              ).map((fr) => fr.id)
            : undefined,
        };
      }
    );

    // Sort: feature roles first, then user roles
    rolesWithPrivileges.sort((a, b) => {
      if (a.isFeatureRole && !b.isFeatureRole) return -1;
      if (!a.isFeatureRole && b.isFeatureRole) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      data: rolesWithPrivileges,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);

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

// POST: Create a new role
export interface CreateRoleRequest {
  name: string;
  inheritedRoles?: string[]; // Roles to inherit (including feature roles)
  dataPrivileges?: DataPrivilege[];
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body: CreateRoleRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "Role name is required" },
        { status: 400 }
      );
    }

    // Block creating roles with feature role prefix
    if (isFeatureRole(body.name)) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot create roles with 'clicklens_' prefix",
        },
        { status: 400 }
      );
    }

    // Validate data privileges don't include restricted databases
    if (body.dataPrivileges) {
      for (const dp of body.dataPrivileges) {
        if (dp.database !== "*" && isRestrictedDatabase(dp.database)) {
          return NextResponse.json(
            {
              success: false,
              error: `Cannot grant privileges on '${dp.database}' database. Use feature roles for system access.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const client = createClient(config);
    const quotedRole = quoteIdentifier(body.name);

    // Create the role
    await client.command(`CREATE ROLE IF NOT EXISTS ${quotedRole}`);

    const errors: string[] = [];

    // Grant inherited roles
    if (body.inheritedRoles && body.inheritedRoles.length > 0) {
      for (const ir of body.inheritedRoles) {
        try {
          await client.command(`GRANT ${quoteIdentifier(ir)} TO ${quotedRole}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`Failed to grant role ${ir}:`, msg);
          errors.push(`Failed to grant role ${ir}: ${msg}`);
        }
      }
    }

    // Grant data privileges
    if (body.dataPrivileges && body.dataPrivileges.length > 0) {
      for (const dp of body.dataPrivileges) {
        const target =
          dp.database === "*" && dp.table === "*"
            ? "*.*"
            : dp.table === "*"
            ? `${quoteIdentifier(dp.database)}.*`
            : `${quoteIdentifier(dp.database)}.${quoteIdentifier(dp.table)}`;

        for (const priv of dp.privileges) {
          try {
            await client.command(`GRANT ${priv} ON ${target} TO ${quotedRole}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`Failed to grant ${priv} on ${target}:`, msg);
            errors.push(`Failed to grant ${priv} on ${target}: ${msg}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Role created but with errors: ${errors.join("; ")}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating role:", error);

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

// PUT: Update an existing role
export interface UpdateRoleRequest {
  name: string;
  inheritedRoles?: string[];
  dataPrivileges?: DataPrivilege[];
}

export async function PUT(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body: UpdateRoleRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "Role name is required" },
        { status: 400 }
      );
    }

    // Block editing feature roles
    if (isFeatureRole(body.name)) {
      return NextResponse.json(
        { success: false, error: "Cannot edit feature roles" },
        { status: 400 }
      );
    }

    // Validate data privileges don't include restricted databases
    if (body.dataPrivileges) {
      for (const dp of body.dataPrivileges) {
        if (dp.database !== "*" && isRestrictedDatabase(dp.database)) {
          return NextResponse.json(
            {
              success: false,
              error: `Cannot grant privileges on '${dp.database}' database`,
            },
            { status: 400 }
          );
        }
      }
    }

    const client = createClient(config);
    const quotedRole = quoteIdentifier(body.name);

    // Get current inherited roles
    const currentRoleGrants = await client.query<{
      granted_role_name: string;
    }>(`
      SELECT granted_role_name
      FROM system.role_grants
      WHERE role_name = '${body.name}'
    `);

    const currentInherited = currentRoleGrants.data.map(
      (r) => r.granted_role_name
    );
    const newInherited = body.inheritedRoles || [];

    const errors: string[] = [];

    // Revoke removed roles
    for (const ir of currentInherited) {
      if (!newInherited.includes(ir)) {
        try {
          await client.command(
            `REVOKE ${quoteIdentifier(ir)} FROM ${quotedRole}`
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`Failed to revoke role ${ir}:`, msg);
          errors.push(`Failed to revoke role ${ir}: ${msg}`);
        }
      }
    }

    // Grant new roles
    for (const ir of newInherited) {
      if (!currentInherited.includes(ir)) {
        try {
          await client.command(`GRANT ${quoteIdentifier(ir)} TO ${quotedRole}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`Failed to grant role ${ir}:`, msg);
          errors.push(`Failed to grant role ${ir}: ${msg}`);
        }
      }
    }

    // For data privileges, revoke and re-grant
    try {
      await client.command(`REVOKE ALL ON *.* FROM ${quotedRole}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("Could not revoke all privileges:", msg);
      errors.push(`Could not revoke all privileges: ${msg}`);
    }

    // Re-grant data privileges
    if (body.dataPrivileges && body.dataPrivileges.length > 0) {
      for (const dp of body.dataPrivileges) {
        const target =
          dp.database === "*" && dp.table === "*"
            ? "*.*"
            : dp.table === "*"
            ? `${quoteIdentifier(dp.database)}.*`
            : `${quoteIdentifier(dp.database)}.${quoteIdentifier(dp.table)}`;

        for (const priv of dp.privileges) {
          try {
            await client.command(`GRANT ${priv} ON ${target} TO ${quotedRole}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`Failed to grant ${priv} on ${target}:`, msg);
            errors.push(`Failed to grant ${priv} on ${target}: ${msg}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Role updated but with errors: ${errors.join("; ")}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating role:", error);

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

// DELETE: Delete a role
export interface DeleteRoleRequest {
  name: string;
}

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body: DeleteRoleRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "Role name is required" },
        { status: 400 }
      );
    }

    // Block deleting feature roles
    if (isFeatureRole(body.name)) {
      return NextResponse.json(
        { success: false, error: "Cannot delete feature roles" },
        { status: 400 }
      );
    }

    const client = createClient(config);
    await client.command(`DROP ROLE IF EXISTS ${quoteIdentifier(body.name)}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);

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
