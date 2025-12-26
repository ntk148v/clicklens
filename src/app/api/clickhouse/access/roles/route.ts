/**
 * API route for managing ClickHouse roles
 * GET - List roles
 * POST - Create role
 * DELETE - Delete role
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClientWithConfig,
  isClickHouseError,
  type SystemRole,
} from "@/lib/clickhouse";

export interface RolesResponse {
  success: boolean;
  data?: SystemRole[];
  error?: string;
}

export async function GET(): Promise<NextResponse<RolesResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    const result = await client.query<SystemRole>(`
      SELECT
        name,
        id,
        storage
      FROM system.roles
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
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

// Create role
export interface CreateRoleRequest {
  name: string;
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

    const client = createClientWithConfig(config);
    await client.command(
      `CREATE ROLE IF NOT EXISTS ${quoteIdentifier(body.name)}`
    );

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

// Delete role
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

    const client = createClientWithConfig(config);
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

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}
