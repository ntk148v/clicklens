/**
 * API route for managing ClickHouse role grants
 * GET /api/clickhouse/access/role-grants - List role grants
 * POST /api/clickhouse/access/role-grants - Grant role to user/role
 * DELETE /api/clickhouse/access/role-grants - Revoke role from user/role
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { quoteIdentifier } from "@/lib/clickhouse/utils";

interface RoleGrant {
  user_name: string | null;
  role_name: string | null;
  granted_role_name: string;
  with_admin_option: boolean;
}

export interface RoleGrantsResponse {
  success: boolean;
  data?: RoleGrant[];
  error?: string;
}

export async function GET(): Promise<NextResponse<RoleGrantsResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const client = createClient(config);

    const result = await client.query<RoleGrant>(`
      SELECT
        user_name,
        role_name,
        granted_role_name,
        with_admin_option
      FROM system.role_grants
      ORDER BY
        user_name NULLS LAST,
        role_name NULLS LAST,
        granted_role_name
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching role grants:", error);

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Grant a role to a user or another role
export interface GrantRoleRequest {
  roleName: string; // Role to grant
  granteeType: "user" | "role"; // Grant to user or role
  granteeName: string; // Name of user or role to grant to
  withAdminOption?: boolean; // Allow grantee to grant this role to others
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: GrantRoleRequest = await request.json();

    if (!body.roleName || !body.granteeName) {
      return NextResponse.json(
        { success: false, error: "Role name and grantee name are required" },
        { status: 400 },
      );
    }

    // Build GRANT statement: GRANT role TO user/role [WITH ADMIN OPTION]
    const grantee =
      body.granteeType === "role"
        ? `ROLE ${quoteIdentifier(body.granteeName)}`
        : quoteIdentifier(body.granteeName);

    let sql = `GRANT ${quoteIdentifier(body.roleName)} TO ${grantee}`;

    if (body.withAdminOption) {
      sql += " WITH ADMIN OPTION";
    }

    const client = createClient(config);
    await client.command(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error granting role:", error);

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Revoke a role from a user or another role
export interface RevokeRoleRequest {
  roleName: string; // Role to revoke
  granteeType: "user" | "role"; // Revoke from user or role
  granteeName: string; // Name of user or role to revoke from
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: RevokeRoleRequest = await request.json();

    if (!body.roleName || !body.granteeName) {
      return NextResponse.json(
        { success: false, error: "Role name and grantee name are required" },
        { status: 400 },
      );
    }

    // Build REVOKE statement: REVOKE role FROM user/role
    const grantee =
      body.granteeType === "role"
        ? `ROLE ${quoteIdentifier(body.granteeName)}`
        : quoteIdentifier(body.granteeName);

    const sql = `REVOKE ${quoteIdentifier(body.roleName)} FROM ${grantee}`;

    const client = createClient(config);
    await client.command(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking role:", error);

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}
