import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import { quoteIdentifier, escapeSqlString } from "@/lib/clickhouse/utils";

const MAX_VALUES = 10;
const QUERY_TIMEOUT_MS = 15_000;

/**
 * GET /api/clickhouse/discover/field-values
 *
 * Returns top distinct values for a given column, scoped to
 * the current time range and filter. Used by the field sidebar
 * for faceted exploration.
 *
 * Query params:
 *   database, table, column (required)
 *   timeColumn, minTime, maxTime, filter (optional)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { config } = auth;

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");
    const table = searchParams.get("table");
    const column = searchParams.get("column");

    if (!database || !table || !column) {
      return NextResponse.json(
        { success: false, error: "Missing database, table, or column" },
        { status: 400 },
      );
    }

    const timeColumn = searchParams.get("timeColumn");
    const minTime = searchParams.get("minTime");
    const maxTime = searchParams.get("maxTime");
    const filter = searchParams.get("filter");

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    const quotedDb = quoteIdentifier(database);
    const quotedTable = quoteIdentifier(table);
    const quotedCol = quoteIdentifier(column);

    const tableSource = clusterName
      ? `clusterAllReplicas('${escapeSqlString(clusterName)}', ${quotedDb}.${quotedTable})`
      : `${quotedDb}.${quotedTable}`;

    const whereConds: string[] = [];

    if (timeColumn && minTime) {
      const quotedTimeCol = quoteIdentifier(timeColumn);
      const minTimeNum = new Date(minTime).getTime();
      whereConds.push(
        `${quotedTimeCol} >= toDateTime64(${minTimeNum / 1000}, 3)`,
      );
      if (maxTime) {
        const maxTimeNum = new Date(maxTime).getTime();
        whereConds.push(
          `${quotedTimeCol} <= toDateTime64(${maxTimeNum / 1000}, 3)`,
        );
      }
    }

    if (filter?.trim()) {
      const DANGEROUS_KEYWORDS =
        /\b(DROP|DELETE|ALTER|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|CREATE|ATTACH|DETACH|RENAME|KILL|SYSTEM)\b/i;
      if (DANGEROUS_KEYWORDS.test(filter)) {
        return NextResponse.json(
          { success: false, error: "Invalid filter" },
          { status: 400 },
        );
      }
      whereConds.push(`(${filter})`);
    }

    const whereClause = whereConds.length
      ? `WHERE ${whereConds.join(" AND ")}`
      : "";

    const query = `SELECT ${quotedCol} AS value, count() AS count FROM ${tableSource} ${whereClause} GROUP BY value ORDER BY count DESC LIMIT ${MAX_VALUES}`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      QUERY_TIMEOUT_MS,
    );

    try {
      const result = await client.query(query);
      clearTimeout(timeout);

      const values = (result.data as { value: unknown; count: number }[]).map(
        (row) => ({
          value: row.value,
          count: Number(row.count),
        }),
      );

      return NextResponse.json({ success: true, data: values });
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  } catch (error) {
    console.error("Field values API error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
