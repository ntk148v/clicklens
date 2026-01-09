/**
 * API route for managing ClickHouse grants
 * GET - List grants
 * POST - Grant permission
 * DELETE - Revoke permission
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClient,
  isClickHouseError,
  type SystemGrant,
} from "@/lib/clickhouse";

export interface GrantsResponse {
  success: boolean;
  data?: SystemGrant[];
  error?: string;
}

export async function GET(): Promise<NextResponse<GrantsResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClient(config);

    const result = await client.query<SystemGrant>(`
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
      ORDER BY
        user_name NULLS LAST,
        role_name NULLS LAST,
        access_type
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching grants:", error);

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

// Grant permission
export interface GrantRequest {
  accessType: string; // SELECT, INSERT, CREATE, etc.
  database?: string; // Optional - if not provided, grants on all databases
  table?: string; // Optional - if not provided, grants on all tables
  granteeType: "user" | "role";
  granteeName: string;
  withGrantOption?: boolean;
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

    const body: GrantRequest = await request.json();

    if (!body.accessType || !body.granteeName) {
      return NextResponse.json(
        { success: false, error: "Access type and grantee name are required" },
        { status: 400 }
      );
    }

    // Build GRANT statement
    let target = "";
    if (body.database && body.table) {
      target = `ON ${quoteIdentifier(body.database)}.${quoteIdentifier(
        body.table
      )}`;
    } else if (body.database) {
      target = `ON ${quoteIdentifier(body.database)}.*`;
    } else {
      target = "ON *.*";
    }

    const grantee =
      body.granteeType === "role"
        ? `ROLE ${quoteIdentifier(body.granteeName)}`
        : quoteIdentifier(body.granteeName);

    let sql = `GRANT ${body.accessType} ${target} TO ${grantee}`;

    if (body.withGrantOption) {
      sql += " WITH GRANT OPTION";
    }

    const client = createClient(config);
    await client.command(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error granting permission:", error);

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

// Revoke permission
export interface RevokeRequest {
  accessType: string;
  database?: string;
  table?: string;
  granteeType: "user" | "role";
  granteeName: string;
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

    const body: RevokeRequest = await request.json();

    if (!body.accessType || !body.granteeName) {
      return NextResponse.json(
        { success: false, error: "Access type and grantee name are required" },
        { status: 400 }
      );
    }

    // Build REVOKE statement
    let target = "";
    if (body.database && body.table) {
      target = `ON ${quoteIdentifier(body.database)}.${quoteIdentifier(
        body.table
      )}`;
    } else if (body.database) {
      target = `ON ${quoteIdentifier(body.database)}.*`;
    } else {
      target = "ON *.*";
    }

    const grantee =
      body.granteeType === "role"
        ? `ROLE ${quoteIdentifier(body.granteeName)}`
        : quoteIdentifier(body.granteeName);

    const sql = `REVOKE ${body.accessType} ${target} FROM ${grantee}`;

    const client = createClient(config);
    await client.command(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking permission:", error);

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

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}
