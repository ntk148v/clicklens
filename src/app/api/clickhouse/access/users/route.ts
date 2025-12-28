/**
 * API route for managing ClickHouse users
 * POST /api/clickhouse/access/users - Create user
 * DELETE /api/clickhouse/access/users - Delete user
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
  data?: SystemUser[];
  error?: string;
}

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

    const result = await client.query<SystemUser>(`
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

    return NextResponse.json({
      success: true,
      data: result.data,
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

// Create a new user
export interface CreateUserRequest {
  name: string;
  password?: string;
  authType?: "plaintext_password" | "sha256_password" | "no_password";
  defaultDatabase?: string;
  defaultRoles?: string[];
  hostPattern?: string;
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

    // Build CREATE USER statement
    let sql = `CREATE USER IF NOT EXISTS ${quoteIdentifier(body.name)}`;

    // Authentication
    if (body.authType === "no_password") {
      sql += " NOT IDENTIFIED";
    } else if (body.password) {
      const authMethod =
        body.authType === "sha256_password"
          ? "SHA256_PASSWORD"
          : "PLAINTEXT_PASSWORD";
      sql += ` IDENTIFIED WITH ${authMethod} BY '${escapeString(
        body.password
      )}'`;
    }

    // Host pattern
    if (body.hostPattern) {
      sql += ` HOST LIKE '${escapeString(body.hostPattern)}'`;
    }

    // Default database
    if (body.defaultDatabase) {
      sql += ` DEFAULT DATABASE ${quoteIdentifier(body.defaultDatabase)}`;
    }

    // Default roles - use NONE by default (principle of least privilege)
    if (body.defaultRoles && body.defaultRoles.length > 0) {
      sql += ` DEFAULT ROLE ${body.defaultRoles
        .map(quoteIdentifier)
        .join(", ")}`;
    } else {
      sql += ` DEFAULT ROLE NONE`;
    }

    const client = createClientWithConfig(config);
    await client.command(sql);

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

// Delete a user
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

// Helper functions
function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

function escapeString(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}
