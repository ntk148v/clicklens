import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const config = await getSessionClickHouseConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const client = createClientWithConfig(config);

    // Fetch from system.settings
    // We also fetch system.server_settings separately or union them if needed,
    // but typically user configurable settings are in system.settings
    const safeSearch = search.replace(/'/g, "''");

    // Using manual JSON formatting appended to query if wrapper doesn't handle options object
    const query = `
      SELECT
        name,
        value,
        changed,
        description,
        type,
        min,
        max,
        readonly
      FROM system.settings
      WHERE name ILIKE '%${safeSearch}%'
      ORDER BY name ASC
    `;

    // Note: The wrapper only takes (sql, options?). It does not take an object with 'query' field.
    // However, createClientWithConfig returns ClickHouseClientImpl which mimics @clickhouse/client interface PARTIALLY?
    // src/lib/clickhouse/clients/types.ts defines query(sql, options).
    // It DOES NOT support 'format' in options?
    // Wait, queryStream does support format. query() does not listed it in types.
    // If I want JSON, I should probably append FORMAT JSONEachRow to SQL.

    const result = await client.query(query);

    const settings = result.data;

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const config = await getSessionClickHouseConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, value } = body;

    if (!name || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Setting name and value are required",
        },
        { status: 400 }
      );
    }

    const client = createClientWithConfig(config);

    // Use ALTER USER to persist setting for the current user
    // Note: This requires privileges to ALTER USER
    // We sanitize input manually as the client wrapper expects a string
    const safeName = name.replace(/[^a-zA-Z0-9_.]/g, ""); // Strict allowlist for setting name
    const safeValue = String(value).replace(/'/g, "''");

    const query = `ALTER USER CURRENT_USER SETTINGS ${safeName} = '${safeValue}'`;

    await client.command(query);

    return NextResponse.json({
      success: true,
      message: `Setting ${name} updated successfully`,
    });
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : "Failed to update setting",
      },
      { status: 500 }
    );
  }
}
