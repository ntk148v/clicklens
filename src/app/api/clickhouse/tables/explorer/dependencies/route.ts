/**
 * API route for table dependencies graph
 * GET /api/clickhouse/tables/explorer/dependencies?database=xxx
 *
 * Extracts dependencies from:
 * - dependencies_table column in system.tables
 * - create_table_query column:
 *   - Materialized view TO clause (target table)
 *   - JOIN clauses (joined tables)
 *   - Distributed engine definition
 *   - Dictionary functions (dictGet, dictGetString, etc.)
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

// Edge types for different dependency relationships
export type EdgeType =
  | "source" // MV reads from source table (dependencies_table)
  | "target" // MV writes to target table (TO clause)
  | "join" // Table is joined in query
  | "distributed" // Distributed table references local table
  | "dictionary"; // Uses dictionary via dictGet functions

export interface TableEdge {
  id: string; // "{source}->{target}:{type}"
  source: string; // source table id
  target: string; // target table id
  type: EdgeType;
  label?: string; // Optional label for the edge
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
  create_table_query: string;
}

// Parsed dependency from create query
interface ParsedDependency {
  database: string;
  table: string;
  type: EdgeType;
}

/**
 * Remove SQL comments and string literals from query to avoid false positives
 * This prevents matching table names inside comments or strings
 */
function stripCommentsAndStrings(query: string): string {
  // Remove single-line comments (-- ...)
  let result = query.replace(/--[^\n]*/g, " ");

  // Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, " ");

  // Remove string literals ('...' and "...")
  // Handle escaped quotes inside strings
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');

  return result;
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

/**
 * Extract target table from Materialized View TO clause
 * Example: CREATE MATERIALIZED VIEW mv TO target_db.target_table AS SELECT ...
 */
function extractMVTargetTable(
  query: string,
  defaultDb: string
): ParsedDependency | null {
  // Match: TO [database.]table
  // Handle both `TO db.table` and `TO table`
  const toMatch = query.match(
    /\bTO\s+(?:`?([a-zA-Z_][a-zA-Z0-9_]*)`?\.)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i
  );
  if (toMatch) {
    return {
      database: toMatch[1] || defaultDb,
      table: toMatch[2],
      type: "target",
    };
  }
  return null;
}

/**
 * Extract joined tables from JOIN clauses
 * Example: ... JOIN other_db.other_table ON ...
 */
function extractJoinedTables(
  query: string,
  defaultDb: string
): ParsedDependency[] {
  const results: ParsedDependency[] = [];

  // Match various JOIN types: JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, etc.
  // Pattern: [type] JOIN [database.]table [alias] ON|USING
  const joinRegex =
    /\b(?:LEFT\s+|RIGHT\s+|INNER\s+|OUTER\s+|CROSS\s+|FULL\s+|SEMI\s+|ANTI\s+|ANY\s+|ALL\s+|ASOF\s+|GLOBAL\s+)*JOIN\s+(?:`?([a-zA-Z_][a-zA-Z0-9_]*)`?\.)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi;

  let match;
  while ((match = joinRegex.exec(query)) !== null) {
    const db = match[1] || defaultDb;
    const table = match[2];
    // Avoid duplicates
    if (!results.some((r) => r.database === db && r.table === table)) {
      results.push({
        database: db,
        table: table,
        type: "join",
      });
    }
  }

  return results;
}

/**
 * Extract local table from Distributed engine definition
 * Example: ENGINE = Distributed(cluster, database, table, ...)
 */
function extractDistributedTable(
  query: string,
  defaultDb: string
): ParsedDependency | null {
  // Match: Distributed(cluster, database, table, ...) or Distributed(cluster, currentDatabase(), table, ...)
  const distMatch = query.match(
    /\bDistributed\s*\(\s*'?[^,']+'?\s*,\s*(?:'([^']+)'|currentDatabase\(\))\s*,\s*'?([a-zA-Z_][a-zA-Z0-9_]*)'?/i
  );
  if (distMatch) {
    return {
      database: distMatch[1] || defaultDb,
      table: distMatch[2],
      type: "distributed",
    };
  }
  return null;
}

/**
 * Extract dictionaries from dictGet* function calls
 * Example: dictGet('dict_name', 'attr', key) or dictGetString('db.dict_name', ...)
 */
function extractDictionaries(
  query: string,
  defaultDb: string
): ParsedDependency[] {
  const results: ParsedDependency[] = [];

  // Match dictGet* functions: dictGet, dictGetString, dictGetUInt64, dictGetOrDefault, etc.
  const dictRegex =
    /\bdict(?:Get|Has|GetOrDefault|GetOrNull|GetHierarchy|GetDescendants|GetAll|GetString|GetUInt8|GetUInt16|GetUInt32|GetUInt64|GetInt8|GetInt16|GetInt32|GetInt64|GetFloat32|GetFloat64|GetDate|GetDateTime|GetUUID)\s*\(\s*'(?:([a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)'/gi;

  let match;
  while ((match = dictRegex.exec(query)) !== null) {
    const db = match[1] || defaultDb;
    const dict = match[2];
    // Avoid duplicates
    if (!results.some((r) => r.database === db && r.table === dict)) {
      results.push({
        database: db,
        table: dict,
        type: "dictionary",
      });
    }
  }

  return results;
}

/**
 * Parse create_table_query to extract all dependencies
 */
function parseCreateQuery(
  query: string,
  engine: string,
  defaultDb: string
): ParsedDependency[] {
  const deps: ParsedDependency[] = [];

  if (!query) return deps;

  // Strip comments and string literals to avoid false positives
  const cleanedQuery = stripCommentsAndStrings(query);

  // Extract MV target table (TO clause)
  if (engine.toLowerCase() === "materializedview") {
    const target = extractMVTargetTable(cleanedQuery, defaultDb);
    if (target) deps.push(target);
  }

  // Extract joined tables
  const joins = extractJoinedTables(cleanedQuery, defaultDb);
  deps.push(...joins);

  // Extract Distributed table reference
  if (engine.toLowerCase().startsWith("distributed")) {
    const dist = extractDistributedTable(cleanedQuery, defaultDb);
    if (dist) deps.push(dist);
  }

  // Extract dictionary references - use original query since dict names are in strings
  const dicts = extractDictionaries(query, defaultDb);
  deps.push(...dicts);

  return deps;
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

    // Query all tables with dependency info and create query
    const result = await client.query<RawTableRow>(`
      SELECT
        database,
        name,
        engine,
        total_rows,
        total_bytes,
        dependencies_database,
        dependencies_table,
        create_table_query
      FROM system.tables
      WHERE database = '${safeDatabase}'
    `);

    // Query all existing tables in the system to validate external references
    const allTablesResult = await client.query<{
      database: string;
      name: string;
      engine: string;
    }>(`
      SELECT database, name, engine
      FROM system.tables
    `);

    // Build a set of existing table IDs for fast lookup
    const existingTables = new Map<
      string,
      { database: string; name: string; engine: string }
    >();
    for (const row of allTablesResult.data) {
      existingTables.set(`${row.database}.${row.name}`, row);
    }

    // Build the graph
    const nodes: TableNode[] = [];
    const edges: TableEdge[] = [];
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    // Helper to add a node if not exists
    // Returns true if the node was added or already exists, false if the table doesn't exist
    const addNode = (
      id: string,
      database: string,
      name: string,
      engine: string = "Unknown",
      validateExists: boolean = false
    ): boolean => {
      if (nodeIds.has(id)) {
        return true;
      }

      // If validation is requested, check if table exists
      if (validateExists) {
        const existingTable = existingTables.get(id);
        if (!existingTable) {
          // Table doesn't exist, skip it
          return false;
        }
        // Use the actual engine from the database
        engine = existingTable.engine;
      }

      nodeIds.add(id);
      nodes.push({
        id,
        database,
        name,
        engine,
        type: getTableType(engine),
        totalRows: null,
        totalBytes: null,
      });
      return true;
    };

    // Helper to add an edge if not exists
    const addEdge = (source: string, target: string, type: EdgeType) => {
      const edgeId = `${source}->${target}:${type}`;
      if (!edgeIds.has(edgeId)) {
        edgeIds.add(edgeId);
        edges.push({
          id: edgeId,
          source,
          target,
          type,
        });
      }
    };

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

    // Second pass: create edges from all dependency sources
    for (const row of result.data) {
      const tableId = `${row.database}.${row.name}`;

      // 1. Dependencies from dependencies_table column (source tables)
      // These are from ClickHouse's metadata, so we validate they exist
      const depDbs = row.dependencies_database || [];
      const depTables = row.dependencies_table || [];

      for (let i = 0; i < depTables.length; i++) {
        const depDb = depDbs[i] || row.database;
        const depTable = depTables[i];
        const sourceId = `${depDb}.${depTable}`;

        // Add external node if it exists, skip if it doesn't
        const nodeAdded = addNode(sourceId, depDb, depTable, "Unknown", true);
        if (nodeAdded) {
          // Edge: source table -> this table (this table depends on source)
          addEdge(sourceId, tableId, "source");
        }
      }

      // 2. Dependencies parsed from create_table_query
      // These are from regex parsing, so we validate they exist to avoid false positives
      const parsedDeps = parseCreateQuery(
        row.create_table_query,
        row.engine,
        row.database
      );

      for (const dep of parsedDeps) {
        const depId = `${dep.database}.${dep.table}`;

        // Add external node only if it exists in the database
        const nodeAdded = addNode(depId, dep.database, dep.table, "Unknown", true);
        if (!nodeAdded) {
          // Table doesn't exist, skip this dependency
          continue;
        }

        if (dep.type === "target") {
          // MV writes TO target: this MV -> target table
          addEdge(tableId, depId, "target");
        } else if (dep.type === "distributed") {
          // Distributed references local: this distributed -> local table
          addEdge(tableId, depId, "distributed");
        } else {
          // join, dictionary: dep table -> this table
          addEdge(depId, tableId, dep.type);
        }
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
