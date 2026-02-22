/**
 * API route for fetching table schema and column metadata
 * GET /api/clickhouse/schema/table-columns?database=xxx&table=xxx
 *
 * Returns column information including types, whether they're time columns,
 * and the table's ORDER BY columns for optimal time filtering.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";
import { escapeSqlString } from "@/lib/clickhouse/utils";
import type {
  ColumnMetadata,
  TimeColumnCandidate,
  TableSchema,
} from "@/lib/types/discover";

interface SchemaResponse {
  success: boolean;
  data?: TableSchema;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

// DateTime types in ClickHouse that can be used as time columns
const TIME_TYPES = ["DateTime", "DateTime64", "Date", "Date32"];

function isTimeType(type: string): boolean {
  // Handle nullable and parameterized types
  const baseType = type
    .replace(/^Nullable\(/, "")
    .replace(/\)$/, "")
    .replace(/\(.*\)/, ""); // Remove parameters like DateTime64(3)
  return TIME_TYPES.some((t) => baseType.startsWith(t));
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<SchemaResponse>> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in first",
          },
        },
        { status: 401 },
      );
    }

    if (!isLensUserConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 500,
            message: "Lens user not configured",
            type: "CONFIG_ERROR",
            userMessage: "Server not properly configured",
          },
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");
    const table = searchParams.get("table");

    if (!database || !table) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "Missing required parameters",
            type: "INVALID_REQUEST",
            userMessage: "Database and table parameters are required",
          },
        },
        { status: 400 },
      );
    }

    const lensConfig = getLensConfig();
    if (!lensConfig) {
      return NextResponse.json({
        success: false,
        error: {
          code: 500,
          message: "Lens config not available",
          type: "CONFIG_ERROR",
          userMessage: "Server not properly configured",
        },
      });
    }

    const client = createClient(lensConfig);
    const safeDatabase = escapeSqlString(database);
    const safeTable = escapeSqlString(table);

    // Fetch column information
    const columnsResult = await client.query(`
      SELECT
        name,
        type,
        is_in_partition_key,
        is_in_sorting_key,
        is_in_primary_key,
        default_kind,
        comment
      FROM system.columns
      WHERE database = '${safeDatabase}'
        AND table = '${safeTable}'
      ORDER BY position
    `);

    interface ColumnRow {
      name: string;
      type: string;
      is_in_partition_key: number;
      is_in_sorting_key: number;
      is_in_primary_key: number;
      default_kind: string;
      comment: string;
    }

    const columnsData = columnsResult.data as unknown as ColumnRow[];

    if (columnsData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 404,
            message: "Table not found",
            type: "NOT_FOUND",
            userMessage: `Table ${database}.${table} not found or not accessible`,
          },
        },
        { status: 404 },
      );
    }

    // Fetch table info for engine
    const tableInfoResult = await client.query(`
      SELECT
        engine,
        sorting_key,
        partition_key
      FROM system.tables
      WHERE database = '${safeDatabase}'
        AND name = '${safeTable}'
    `);

    interface TableInfoRow {
      engine: string;
      sorting_key: string;
      partition_key: string;
    }

    const tableInfo = (tableInfoResult.data as unknown as TableInfoRow[])[0];

    // Build column metadata
    const columns: ColumnMetadata[] = columnsData.map((col) => ({
      name: col.name,
      type: col.type,
      isNullable: col.type.startsWith("Nullable"),
      defaultKind: col.default_kind || "",
      comment: col.comment || "",
    }));

    // Identify time column candidates
    const timeColumns: TimeColumnCandidate[] = columnsData
      .filter((col) => isTimeType(col.type))
      .map((col) => ({
        name: col.name,
        type: col.type,
        isPrimary: col.is_in_sorting_key === 1 || col.is_in_primary_key === 1,
      }));

    // Extract ORDER BY columns
    const orderByColumns = tableInfo?.sorting_key
      ? tableInfo.sorting_key.split(",").map((s) => s.trim())
      : [];

    const schema: TableSchema = {
      database,
      table,
      engine: tableInfo?.engine || "Unknown",
      columns,
      timeColumns,
      orderByColumns,
      partitionKey: tableInfo?.partition_key || null,
    };

    return NextResponse.json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error("Schema fetch error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          type: error.type,
          userMessage: error.userMessage || error.message,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 500,
        message: error instanceof Error ? error.message : "Unknown error",
        type: "INTERNAL_ERROR",
        userMessage: "Failed to fetch table schema",
      },
    });
  }
}
