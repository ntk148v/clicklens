/**
 * API route for managing ClickHouse users
 *
 * Following RBAC best practices:
 * - Users are granted ONLY roles (no direct privileges)
 * - Privileges are managed at the role level
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClientWithConfig,
  isClickHouseError,
  type SystemUser,
} from "@/lib/clickhouse";

export interface UsersResponse {
  success: boolean;
  data?: (SystemUser & { assigned_roles?: string[] })[];
  error?: string;
}

import { quoteIdentifier, escapeString } from "@/lib/clickhouse/utils";

// GET: List all users with their assigned roles
export async function GET(): Promise<NextResponse<UsersResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    // Get users
    const usersResult = await client.query<SystemUser>(`
      SELECT
        name,
        id,
        storage,
        auth_type,
        host_ip,
        host_names,
        host_names_regexp,
        host_names_like,
        default_roles_all,
        default_roles_list,
        default_roles_except,
        grantees_any,
        grantees_list,
        grantees_except,
        default_database
      FROM system.users
      ORDER BY name
    `);

    // Get role grants to users
    const roleGrantsResult = await client.query<{
      user_name: string;
      granted_role_name: string;
    }>(`
      SELECT user_name, granted_role_name
      FROM system.role_grants
      WHERE user_name IS NOT NULL
    `);

    // Build a map of user -> roles
    const userRolesMap = new Map<string, string[]>();
    for (const grant of roleGrantsResult.data) {
      if (!userRolesMap.has(grant.user_name)) {
        userRolesMap.set(grant.user_name, []);
      }
      userRolesMap.get(grant.user_name)!.push(grant.granted_role_name);
    }

    // Merge roles into users
    const usersWithRoles = usersResult.data.map((user) => ({
      ...user,
      assigned_roles: userRolesMap.get(user.name) || [],
    }));

    return NextResponse.json({
      success: true,
      data: usersWithRoles,
    });
  } catch (error) {
    console.error("Error fetching users:", error);

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

// POST: Create a new user with role assignments
export interface CreateUserRequest {
  name: string;
  password?: string;
  roles?: string[]; // Roles to assign (not direct privileges!)
  defaultDatabase?: string;
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

    const body: CreateUserRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "User name is required" },
        { status: 400 }
      );
    }

    const client = createClientWithConfig(config);
    const quotedUser = quoteIdentifier(body.name);

    // Build CREATE USER statement
    let sql = `CREATE USER IF NOT EXISTS ${quotedUser}`;

    if (body.password) {
      sql += ` IDENTIFIED WITH sha256_password BY '${escapeString(
        body.password
      )}'`;
    } else {
      sql += " NOT IDENTIFIED";
    }

    if (body.defaultDatabase) {
      sql += ` DEFAULT DATABASE ${quoteIdentifier(body.defaultDatabase)}`;
    }

    await client.command(sql);

    // Grant roles to user (not direct privileges!)
    if (body.roles && body.roles.length > 0) {
      for (const role of body.roles) {
        await client.command(`GRANT ${quoteIdentifier(role)} TO ${quotedUser}`);
      }

      // Set as default roles
      const roleList = body.roles.map(quoteIdentifier).join(", ");
      await client.command(`SET DEFAULT ROLE ${roleList} TO ${quotedUser}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating user:", error);

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

// PUT: Update an existing user
export interface UpdateUserRequest {
  name: string;
  newPassword?: string;
  roles?: string[]; // Complete list of roles (replaces existing)
  defaultDatabase?: string;
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

    const body: UpdateUserRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "User name is required" },
        { status: 400 }
      );
    }

    const client = createClientWithConfig(config);
    const quotedUser = quoteIdentifier(body.name);

    // Update password if provided
    if (body.newPassword) {
      await client.command(
        `ALTER USER ${quotedUser} IDENTIFIED WITH sha256_password BY '${escapeString(
          body.newPassword
        )}'`
      );
    }

    // Update default database if provided
    if (body.defaultDatabase !== undefined) {
      if (body.defaultDatabase) {
        await client.command(
          `ALTER USER ${quotedUser} DEFAULT DATABASE ${quoteIdentifier(
            body.defaultDatabase
          )}`
        );
      }
    }

    // Update roles if provided
    if (body.roles !== undefined) {
      // Get current roles
      const currentRolesResult = await client.query<{
        granted_role_name: string;
      }>(`
        SELECT granted_role_name
        FROM system.role_grants
        WHERE user_name = '${escapeString(body.name)}'
      `);
      const currentRoles = currentRolesResult.data.map(
        (r) => r.granted_role_name
      );

      const newRoles = body.roles;

      // Revoke removed roles
      for (const role of currentRoles) {
        if (!newRoles.includes(role)) {
          try {
            await client.command(
              `REVOKE ${quoteIdentifier(role)} FROM ${quotedUser}`
            );
          } catch (e) {
            console.error(
              `Failed to revoke role ${role} from user ${body.name}:`,
              e
            );
          }
        }
      }

      // Grant new roles
      for (const role of newRoles) {
        if (!currentRoles.includes(role)) {
          try {
            await client.command(
              `GRANT ${quoteIdentifier(role)} TO ${quotedUser}`
            );
          } catch (e) {
            console.error(
              `Failed to grant role ${role} to user ${body.name}:`,
              e
            );
          }
        }
      }

      // Set default roles - ALWAYS update this to match the new roles
      if (newRoles.length > 0) {
        const roleList = newRoles.map(quoteIdentifier).join(", ");
        try {
          await client.command(`SET DEFAULT ROLE ${roleList} TO ${quotedUser}`);
        } catch (e) {
          console.error(
            `Failed to set default roles for user ${body.name}:`,
            e
          );
        }
      } else {
        try {
          await client.command(`SET DEFAULT ROLE NONE TO ${quotedUser}`);
        } catch (e) {
          console.error(
            `Failed to clear default roles for user ${body.name}:`,
            e
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);

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

// DELETE: Delete a user
export interface DeleteUserRequest {
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

    const body: DeleteUserRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "User name is required" },
        { status: 400 }
      );
    }

    const client = createClientWithConfig(config);
    await client.command(`DROP USER IF EXISTS ${quoteIdentifier(body.name)}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);

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
