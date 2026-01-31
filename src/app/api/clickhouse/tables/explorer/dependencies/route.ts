/**
 * API route for table dependencies graph
 * GET /api/clickhouse/tables/explorer/dependencies?database=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

// Types for dependency graph
export interface TableNode {
  id: string; // "{database}.{table}"
  database: string;
  name: string;
  engine: string;
  type: "table" | "materialized_view" | "view" | "distributed" | "dictionary";
  totalRows: number | null;
  totalBytes: number | null;
}

export interface TableEdge {
  id: string; // "{source}->{target}"
  source: string; // source table id (the dependency)
  target: string; // target table id (the dependent)
  type: "dependency";
}

export interface DependencyGraph {
  nodes: TableNode[];
  edges: TableEdge[];
}

interface DependencyGraphResponse {
  success: boolean;
  data?: DependencyGraph;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

// Raw row from ClickHouse query
interface RawTableRow {
  database: string;
  name: string;
  engine: string;
  total_rows: number | null;
  total_bytes: number | null;
  dependencies_database: string[];
  dependencies_table: string[];
}

// Determine table type from engine
function getTableType(
  engine: string
): "table" | "materialized_view" | "view" | "distributed" | "dictionary" {
  const engineLower = engine.toLowerCase();
  if (engineLower === "materializedview") return "materialized_view";
  if (engineLower === "view") return "view";
  if (engineLower.startsWith("distributed")) return "distributed";
  if (engineLower === "dictionary") return "dictionary";
  return "table";
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<DependencyGraphResponse>> {
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
        { status: 401 }
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
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");

    if (!database) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "Database parameter is required",
            type: "BAD_REQUEST",
            userMessage: "Please specify a database",
          },
        },
        { status: 400 }
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
    const safeDatabase = database.replace(/'/g, "''");

    // Query all tables with dependency info
    const result = await client.query<RawTableRow>(`
      SELECT
        database,
        name,
        engine,
        total_rows,
        total_bytes,
        dependencies_database,
        dependencies_table
      FROM system.tables
      WHERE database = '${safeDatabase}'
    `);

    // Build the graph
    const nodes: TableNode[] = [];
    const edges: TableEdge[] = [];
    const nodeIds = new Set<string>();

    // First pass: create nodes for all tables in the database
    for (const row of result.data) {
      const nodeId = `${row.database}.${row.name}`;
      nodeIds.add(nodeId);

      nodes.push({
        id: nodeId,
        database: row.database,
        name: row.name,
        engine: row.engine,
        type: getTableType(row.engine),
        totalRows: row.total_rows,
        totalBytes: row.total_bytes,
      });
    }

    // Second pass: create edges and add external dependency nodes
    for (const row of result.data) {
      const targetId = `${row.database}.${row.name}`;
      const depDbs = row.dependencies_database || [];
      const depTables = row.dependencies_table || [];

      // Create edges for each dependency
      for (let i = 0; i < depTables.length; i++) {
        const depDb = depDbs[i] || row.database;
        const depTable = depTables[i];
        const sourceId = `${depDb}.${depTable}`;

        // Add external node if not already present
        if (!nodeIds.has(sourceId)) {
          nodeIds.add(sourceId);
          nodes.push({
            id: sourceId,
            database: depDb,
            name: depTable,
            engine: "Unknown",
            type: "table",
            totalRows: null,
            totalBytes: null,
          });
        }

        // Create edge from dependency to dependent
        const edgeId = `${sourceId}->${targetId}`;
        edges.push({
          id: edgeId,
          source: sourceId,
          target: targetId,
          type: "dependency",
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nodes,
        edges,
      },
    });
  } catch (error) {
    console.error("Table dependencies error:", error);

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
        userMessage: "Failed to fetch table dependencies",
      },
    });
  }
}
