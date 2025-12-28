/**
 * API route for managing saved queries
 * GET /api/saved-queries - List saved queries
 * POST /api/saved-queries - Save a new query
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";
import {
  ensureMetadataInfrastructure,
  METADATA_DB,
  SAVED_QUERIES_TABLE,
} from "@/lib/clickhouse/metadata";

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  description: string;
  created_by: string;
  created_at: string;
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (!isLensUserConfigured()) {
    return NextResponse.json(
      { success: false, error: "Metadata storage not configured" },
      { status: 503 }
    );
  }

  try {
    const config = getLensConfig();
    const client = createClientWithConfig(config!); // Checked by isLensUserConfigured

    // Ensure table exists (idempotent, fast enough to check or cache)
    // For now we just run it, assuming it's cheap IF NOT EXISTS
    // Or we could try-catch the select and create if missing
    await ensureMetadataInfrastructure();

    const result = await client.query<SavedQuery>(`
      SELECT * FROM ${METADATA_DB}.${SAVED_QUERIES_TABLE}
      WHERE created_by = '${session.user.username}'
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Failed to fetch saved queries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch saved queries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, sql, description = "" } = body;

    if (!name || !sql) {
      return NextResponse.json(
        { success: false, error: "Name and SQL are required" },
        { status: 400 }
      );
    }

    const config = getLensConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Metadata storage not configured" },
        { status: 503 }
      );
    }

    const client = createClientWithConfig(config);
    await ensureMetadataInfrastructure();

    const id = crypto.randomUUID();
    const safeSql = sql.replace(/'/g, "''");
    const safeName = name.replace(/'/g, "''");
    const safeDesc = description.replace(/'/g, "''");
    const safeUser = session.user.username.replace(/'/g, "''");

    await client.command(`
      INSERT INTO ${METADATA_DB}.${SAVED_QUERIES_TABLE} (id, name, sql, description, created_by)
      VALUES ('${id}', '${safeName}', '${safeSql}', '${safeDesc}', '${safeUser}')
    `);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to save query:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save query" },
      { status: 500 }
    );
  }
}
