/**
 * API route for managing ClickHouse grants
 * GET - List grants
 * POST - Grant permission
 * DELETE - Revoke permission
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig, checkPermission } from "@/lib/auth";
import {
  createClient,
  isClickHouseError,
  type SystemGrant,
} from "@/lib/clickhouse";

/**
 * Allowlist of valid ClickHouse access types to prevent SQL injection.
 * These are the standard privilege types recognized by ClickHouse.
 */
const VALID_ACCESS_TYPES = new Set([
  "SELECT",
  "INSERT",
  "ALTER",
  "CREATE",
  "DROP",
  "TRUNCATE",
  "OPTIMIZE",
  "SHOW",
  "KILL QUERY",
  "ACCESS MANAGEMENT",
  "SYSTEM",
  "INTROSPECTION",
  "SOURCES",
  "CLUSTER",
  "ALL",
  // Granular ALTER privileges
  "ALTER TABLE",
  "ALTER VIEW",
  "ALTER UPDATE",
  "ALTER DELETE",
  "ALTER COLUMN",
  "ALTER INDEX",
  "ALTER CONSTRAINT",
  "ALTER TTL",
  "ALTER SETTINGS",
  "ALTER MOVE PARTITION",
  "ALTER FETCH PARTITION",
  "ALTER FREEZE PARTITION",
  // Granular CREATE/DROP privileges
  "CREATE DATABASE",
  "CREATE TABLE",
  "CREATE VIEW",
  "CREATE DICTIONARY",
  "CREATE TEMPORARY TABLE",
  "CREATE FUNCTION",
  "DROP DATABASE",
  "DROP TABLE",
  "DROP VIEW",
  "DROP DICTIONARY",
  "DROP FUNCTION",
  // Granular SHOW privileges
  "SHOW DATABASES",
  "SHOW TABLES",
  "SHOW COLUMNS",
  "SHOW DICTIONARIES",
  // System privileges
  "SYSTEM RELOAD",
  "SYSTEM SHUTDOWN",
  "SYSTEM DROP CACHE",
  "SYSTEM FLUSH",
  "SYSTEM MERGES",
  "SYSTEM TTL MERGES",
  "SYSTEM FETCHES",
  "SYSTEM MOVES",
  "SYSTEM SENDS",
  "SYSTEM REPLICATION QUEUES",
  "SYSTEM RESTART REPLICA",
  "SYSTEM SYNC REPLICA",
  // dictGet
  "dictGet",
]);

/**
 * Validate that an access type string is a known ClickHouse privilege.
 * Prevents SQL injection by rejecting any value not in the allowlist.
 */
function isValidAccessType(accessType: string): boolean {
  return VALID_ACCESS_TYPES.has(accessType.toUpperCase());
}

export interface GrantsResponse {
  success: boolean;
  data?: SystemGrant[];
  error?: string;
}

export async function GET(): Promise<NextResponse<GrantsResponse>> {
  try {
    const authError = await checkPermission("canManageUsers");
    if (authError) return authError;

    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
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
  request: NextRequest,
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const authError = await checkPermission("canManageUsers");
    if (authError) return authError;

    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: GrantRequest = await request.json();

    if (!body.accessType || !body.granteeName) {
      return NextResponse.json(
        { success: false, error: "Access type and grantee name are required" },
        { status: 400 },
      );
    }

    // Validate accessType against allowlist to prevent SQL injection
    if (!isValidAccessType(body.accessType)) {
      return NextResponse.json(
        { success: false, error: `Invalid access type: ${body.accessType}` },
        { status: 400 },
      );
    }

    // Build GRANT statement
    let target = "";
    if (body.database && body.table) {
      target = `ON ${quoteIdentifier(body.database)}.${quoteIdentifier(
        body.table,
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

    let sql = `GRANT ${body.accessType.toUpperCase()} ${target} TO ${grantee}`;

    if (body.withGrantOption) {
      sql += " WITH GRANT OPTION";
    }

    const client = createClient(config);
    await client.command(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error granting permission:", error);

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

// Revoke permission
export interface RevokeRequest {
  accessType: string;
  database?: string;
  table?: string;
  granteeType: "user" | "role";
  granteeName: string;
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const authError = await checkPermission("canManageUsers");
    if (authError) return authError;

    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: RevokeRequest = await request.json();

    if (!body.accessType || !body.granteeName) {
      return NextResponse.json(
        { success: false, error: "Access type and grantee name are required" },
        { status: 400 },
      );
    }

    // Validate accessType against allowlist to prevent SQL injection
    if (!isValidAccessType(body.accessType)) {
      return NextResponse.json(
        { success: false, error: `Invalid access type: ${body.accessType}` },
        { status: 400 },
      );
    }

    // Build REVOKE statement
    let target = "";
    if (body.database && body.table) {
      target = `ON ${quoteIdentifier(body.database)}.${quoteIdentifier(
        body.table,
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

    const sql = `REVOKE ${body.accessType.toUpperCase()} ${target} FROM ${grantee}`;

    const client = createClient(config);
    await client.command(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking permission:", error);

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

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}
