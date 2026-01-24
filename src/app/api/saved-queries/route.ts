/**
 * API route for managing saved queries
 * GET /api/saved-queries - List saved queries
 * POST /api/saved-queries - Save a new query
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";
import { generateUUID } from "@/lib/utils";
import {
  ensureMetadataInfrastructure,
  METADATA_DB,
  SAVED_QUERIES_TABLE,
} from "@/lib/clickhouse/metadata";
import { ApiErrors, apiError } from "@/lib/api";

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
    return ApiErrors.unauthorized();
  }

  if (!isLensUserConfigured()) {
    return apiError(503, "INTERNAL_ERROR", "Metadata storage not configured", "Saved queries feature is not configured");
  }

  try {
    const config = getLensConfig();
    const client = createClient(config!); // Checked by isLensUserConfigured

    // Ensure table exists (idempotent, fast enough to check or cache)
    // For now we just run it, assuming it's cheap IF NOT EXISTS
    // Or we could try-catch the select and create if missing
    await ensureMetadataInfrastructure();

    // Escape username to prevent SQL injection
    const safeUsername = session.user.username.replace(/'/g, "''");
    const result = await client.query<SavedQuery>(`
      SELECT * FROM ${METADATA_DB}.${SAVED_QUERIES_TABLE}
      WHERE created_by = '${safeUsername}'
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Failed to fetch saved queries:", error);
    return ApiErrors.fromError(error, "Failed to fetch saved queries");
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return ApiErrors.unauthorized();
  }

  try {
    const body = await request.json();
    const { name, sql, description = "" } = body;

    if (!name || !sql) {
      return ApiErrors.badRequest("Name and SQL are required");
    }

    const config = getLensConfig();
    if (!config) {
      return apiError(503, "INTERNAL_ERROR", "Metadata storage not configured", "Saved queries feature is not configured");
    }

    const client = createClient(config);
    await ensureMetadataInfrastructure();

    const id = generateUUID();
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
    return ApiErrors.fromError(error, "Failed to save query");
  }
}
