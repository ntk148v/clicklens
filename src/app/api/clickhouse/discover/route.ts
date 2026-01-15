/**
 * Discover API - Flexible data exploration for any ClickHouse table
 *
 * GET /api/clickhouse/discover?
 *   database=logs&
 *   table=access_log&
 *   columns=timestamp,host,status,message&
 *   timeColumn=timestamp&
 *   minTime=2026-01-14T00:00:00Z&
 *   maxTime=2026-01-14T12:00:00Z&
 *   filter=status >= 400&
 *   limit=100&
 *   mode=data|histogram
 *
 * Supports:
 * - Dynamic table selection (any user-accessible table)
 * - Custom WHERE clause filtering
 * - Column selection (controls SELECT clause)
 * - Time range filtering
 * - Histogram aggregation for visualization
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import type { DiscoverResponse, DiscoverRow } from "@/lib/types/discover";

// Legacy source mapping for backward compatibility
const LEGACY_SOURCES: Record<
  string,
  { database: string; table: string; timeColumn: string }
> = {
  text_log: {
    database: "system",
    table: "text_log",
    timeColumn: "event_time_microseconds",
  },
  crash_log: {
    database: "system",
    table: "crash_log",
    timeColumn: "event_time",
  },
  session_log: {
    database: "system",
    table: "session_log",
    timeColumn: "event_time",
  },
};

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

    // Support both new params and legacy "source" param
    const legacySource = searchParams.get("source");
    let database = searchParams.get("database");
    let table = searchParams.get("table");
    let timeColumn = searchParams.get("timeColumn");

    // Legacy compatibility
    if (legacySource && LEGACY_SOURCES[legacySource]) {
      const legacy = LEGACY_SOURCES[legacySource];
      database = database || legacy.database;
      table = table || legacy.table;
      timeColumn = timeColumn || legacy.timeColumn;
    }

    // Validate required params
    if (!database || !table) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: database and table",
        },
        { status: 400 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 10000);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
    const mode = searchParams.get("mode") || "data"; // "data" or "histogram"
    const filter = searchParams.get("filter") || "";
    const minTime = searchParams.get("minTime");
    const maxTime = searchParams.get("maxTime");
    const columnsParam = searchParams.get("columns");

    // Legacy search param (for backward compatibility)
    const legacySearch = searchParams.get("search");

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    // Safe identifiers
    const safeDatabase = database.replace(/[`]/g, "");
    const safeTable = table.replace(/[`]/g, "");

    // Determine table source
    const tableSource = clusterName
      ? `clusterAllReplicas('${clusterName}', \`${safeDatabase}\`.\`${safeTable}\`)`
      : `\`${safeDatabase}\`.\`${safeTable}\``;

    // Build WHERE conditions
    const whereConditions: string[] = [];

    // Time column filtering - need to detect column type for proper comparison
    if (timeColumn && (minTime || maxTime)) {
      const safeTimeCol = timeColumn.replace(/[`]/g, "");

      // First, get the column type to use appropriate comparison
      const typeQuery = `
        SELECT type
        FROM system.columns
        WHERE database = '${safeDatabase}'
          AND table = '${safeTable}'
          AND name = '${safeTimeCol}'
      `;

      let columnType = "DateTime";
      try {
        const typeResult = await client.query(typeQuery);
        const typeData = typeResult.data as unknown as { type: string }[];
        if (typeData.length > 0) {
          columnType = typeData[0].type;
        }
      } catch {
        // Fall back to DateTime if we can't get the type
      }

      // Check if it's a Date type (not DateTime)
      const isDateOnly = columnType === "Date" || columnType === "Date32";

      if (minTime) {
        const safeMinTime = minTime.replace(/'/g, "''");
        if (isDateOnly) {
          // For Date columns, parse the ISO timestamp first then convert to Date
          whereConditions.push(
            `\`${safeTimeCol}\` >= toDate(parseDateTimeBestEffort('${safeMinTime}'))`
          );
        } else {
          // For DateTime columns, use parseDateTimeBestEffort
          whereConditions.push(
            `\`${safeTimeCol}\` >= parseDateTimeBestEffort('${safeMinTime}')`
          );
        }
      }

      if (maxTime) {
        const safeMaxTime = maxTime.replace(/'/g, "''");
        if (isDateOnly) {
          whereConditions.push(
            `\`${safeTimeCol}\` <= toDate(parseDateTimeBestEffort('${safeMaxTime}'))`
          );
        } else {
          whereConditions.push(
            `\`${safeTimeCol}\` <= parseDateTimeBestEffort('${safeMaxTime}')`
          );
        }
      }
    }

    // Custom filter (user's WHERE expression)
    if (filter && filter.trim()) {
      // Basic SQL injection protection:
      // - Disallow dangerous keywords/statements
      // - The actual protection is via ClickHouse user permissions
      const dangerousPatterns = [
        /;\s*(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|CREATE|GRANT|REVOKE)/i,
        /--/,
        /\/\*/,
      ];

      const hasDangerous = dangerousPatterns.some((p) => p.test(filter));
      if (hasDangerous) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid filter expression: contains disallowed keywords",
          },
          { status: 400 }
        );
      }

      whereConditions.push(`(${filter})`);
    }

    // Legacy search compatibility
    if (legacySearch && legacySearch.trim()) {
      const safeSearch = legacySearch.replace(/'/g, "''");
      // Try to find a message-like column for backward compat
      if (legacySource === "session_log") {
        whereConditions.push(
          `(user ILIKE '%${safeSearch}%' OR database ILIKE '%${safeSearch}%' OR client_name ILIKE '%${safeSearch}%')`
        );
      } else {
        whereConditions.push(`message ILIKE '%${safeSearch}%'`);
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // --- HISTOGRAM MODE ---
    if (mode === "histogram") {
      if (!timeColumn) {
        return NextResponse.json({
          success: true,
          histogram: [],
        });
      }

      const safeTimeCol = timeColumn.replace(/[`]/g, "");

      // First, get the column type to determine the appropriate grouping function
      const typeQuery = `
        SELECT type
        FROM system.columns
        WHERE database = '${safeDatabase}'
          AND table = '${safeTable}'
          AND name = '${safeTimeCol}'
      `;

      let columnType = "DateTime";
      try {
        const typeResult = await client.query(typeQuery);
        const typeData = typeResult.data as unknown as { type: string }[];
        if (typeData.length > 0) {
          columnType = typeData[0].type;
        }
      } catch {
        // Fall back to DateTime if we can't get the type
      }

      // Check if it's a Date type (not DateTime)
      const isDateOnly = columnType === "Date" || columnType === "Date32";

      // For Date columns, we can only group by day
      // For DateTime columns, we use toStartOfInterval with adaptive intervals
      let histogramQuery: string;

      if (isDateOnly) {
        // Date columns: group by day (the finest granularity possible)
        histogramQuery = `
          SELECT
            \`${safeTimeCol}\` as time,
            count() as count
          FROM ${tableSource}
          ${whereClause}
          GROUP BY time
          ORDER BY time
        `;
      } else {
        // DateTime columns: use adaptive interval
        let interval = "1 hour";
        if (minTime) {
          const now = new Date();
          const min = new Date(minTime);
          const diffHours = (now.getTime() - min.getTime()) / (1000 * 60 * 60);

          if (diffHours <= 1) interval = "1 minute";
          else if (diffHours <= 6) interval = "5 minute";
          else if (diffHours <= 24) interval = "15 minute";
          else if (diffHours <= 72) interval = "1 hour";
          else interval = "6 hour";
        }

        histogramQuery = `
          SELECT
            toStartOfInterval(\`${safeTimeCol}\`, INTERVAL ${interval}) as time,
            count() as count
          FROM ${tableSource}
          ${whereClause}
          GROUP BY time
          ORDER BY time
        `;
      }

      const histResult = await client.query(histogramQuery);
      const histData = histResult.data as unknown as {
        time: string;
        count: number;
      }[];

      return NextResponse.json({
        success: true,
        histogram: histData,
      } as DiscoverResponse);
    }

    // --- DATA MODE ---

    // Determine columns to select
    let selectClause: string;

    if (columnsParam) {
      // User-specified columns
      const columns = columnsParam
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `\`${c.replace(/[`]/g, "")}\``);

      if (columns.length === 0) {
        selectClause = "*";
      } else {
        selectClause = columns.join(", ");
      }
    } else if (legacySource) {
      // Legacy column mapping for backward compatibility
      selectClause = getLegacySelectClause(legacySource);
    } else {
      selectClause = "*";
    }

    // Build ORDER BY
    const orderByClause = timeColumn
      ? `ORDER BY \`${timeColumn.replace(/[`]/g, "")}\` DESC`
      : "";

    const dataQuery = `
      SELECT ${selectClause}
      FROM ${tableSource}
      ${whereClause}
      ${orderByClause}
      LIMIT ${limit}
      ${offset > 0 ? `OFFSET ${offset}` : ""}
    `;

    const dataResult = await client.query(dataQuery);
    const rows = dataResult.data as unknown as DiscoverRow[];

    // Get approximate total count (for display purposes)
    let totalHits = rows.length;
    if (rows.length === limit) {
      // There might be more, get approximate count
      try {
        const countQuery = `
          SELECT count() as cnt
          FROM ${tableSource}
          ${whereClause}
        `;
        const countResult = await client.query(countQuery);
        const countData = countResult.data as unknown as { cnt: number }[];
        totalHits = Number(countData[0]?.cnt) || rows.length;
      } catch {
        // Count query failed, use rows length
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        rows: legacySource ? transformLegacyRows(rows, legacySource) : rows,
        totalHits,
        cursor: null, // Will implement cursor pagination in Phase 2
      },
    } as DiscoverResponse);
  } catch (error) {
    console.error("Failed to fetch discover data:", error);

    if (isClickHouseError(error)) {
      const code = String(error.code);
      // Table doesn't exist
      if (code === "60") {
        return NextResponse.json({
          success: false,
          error: "Table not found or not accessible",
        });
      }
      // Access denied
      if (code === "497") {
        return NextResponse.json({
          success: false,
          error: "Access denied to this table",
        });
      }
      // Syntax error in filter
      if (code === "62") {
        return NextResponse.json({
          success: false,
          error: `Invalid filter syntax: ${error.message}`,
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch data",
    });
  }
}

/**
 * Legacy SELECT clause mapping for backward compatibility
 */
function getLegacySelectClause(source: string): string {
  switch (source) {
    case "crash_log":
      return `
        event_time as timestamp,
        'Fatal' as type,
        toString(signal) as component,
        concat(exception, '\\nStack trace:\\n', stack_trace) as message,
        concat('Thread ID: ', toString(thread_id), ', Protocol: ', toString(protocol_version)) as details,
        event_time,
        thread_name,
        query_id,
        source_file,
        source_line
      `;
    case "session_log":
      return `
        event_time as timestamp,
        toString(type) as event_type,
        user as component,
        concat('Auth: ', toString(auth_type), ', Remote: ', toString(client_address), ', Client: ', client_name) as message,
        concat('Interface: ', toString(interface), ', Session ID: ', session_id, if(failure_reason != '', concat(', Reason: ', failure_reason), '')) as details,
        event_time,
        client_hostname as thread_name,
        session_id as query_id,
        '' as source_file,
        0 as source_line
      `;
    default: // text_log
      return `
        event_time_microseconds as timestamp,
        level as type,
        logger_name as component,
        message,
        concat('Source: ', source_file, ':', toString(source_line), ', Query ID: ', query_id) as details,
        event_time,
        thread_name,
        query_id,
        source_file,
        source_line
      `;
  }
}

/**
 * Transform rows for legacy format compatibility
 */
function transformLegacyRows(
  rows: DiscoverRow[],
  source: string
): DiscoverRow[] {
  if (source === "session_log") {
    return rows.map((row) => ({
      ...row,
      type: row.event_type || row.type,
    }));
  }
  return rows;
}
