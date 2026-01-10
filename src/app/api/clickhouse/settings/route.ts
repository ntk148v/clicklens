import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";

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
    const scope = searchParams.get("scope") || "session";

    const client = createClient(config);

    const safeSearch = search.replace(/'/g, "''");
    let query = "";

    if (scope === "server") {
      // Fetch from system.server_settings
      query = `
        SELECT
          name,
          value,
          default,
          changed,
          description,
          type,
          changeable_without_restart as is_hot_reloadable
        FROM system.server_settings
        WHERE name ILIKE '%${safeSearch}%'
        ORDER BY name ASC
      `;
    } else {
      // Default: Fetch from system.settings (Session settings)
      query = `
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
    }

    // Note: The wrapper only takes (sql, options?). It does not take an object with 'query' field.
    // However, createClient returns ClickHouseClientImpl which mimics @clickhouse/client interface PARTIALLY?
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

    const client = createClient(config);

    // First, get the current username since ALTER USER requires a literal name
    const userResult = await client.query("SELECT currentUser() AS user");
    const currentUsername = userResult.data?.[0]?.user;

    if (!currentUsername) {
      return NextResponse.json(
        { success: false, error: "Could not determine current user" },
        { status: 500 }
      );
    }

    // Use ALTER USER to persist setting for the current user
    // Note: This requires privileges to ALTER USER
    // We sanitize input manually as the client wrapper expects a string
    const safeName = name.replace(/[^a-zA-Z0-9_.]/g, ""); // Strict allowlist for setting name
    const safeValue = String(value).replace(/'/g, "''");
    // Sanitize username as well to prevent injection
    const safeUsername = String(currentUsername).replace(/`/g, "``");

    const query = `ALTER USER \`${safeUsername}\` SETTINGS ${safeName} = '${safeValue}'`;

    await client.command(query);

    return NextResponse.json({
      success: true,
      message: `Setting ${name} updated successfully`,
    });
  } catch (error) {
    console.error("Error updating setting:", error);

    // Check for readonly storage error (users defined in XML config)
    const errorMessage = isClickHouseError(error)
      ? error.userMessage || error.message
      : String(error);

    if (errorMessage.includes("storage is readonly")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot modify settings for this user. The user is defined in ClickHouse's XML configuration file (users.xml), which is readonly. To change settings for this user, modify the XML configuration file directly.",
        },
        { status: 403 }
      );
    }

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
