import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import {
  buildSmartSearchCondition,
  ColumnDefinition,
} from "@/lib/clickhouse/search";
import { fetchChunks } from "@/lib/clickhouse/stream";
import { quoteIdentifier, escapeSqlString } from "@/lib/clickhouse/utils";

// ... Legacy sources handling could be preserved or refactored.
// For this major refactor, I will keep legacy support but adapt it to the new structure where possible.
// Or effectively re-implement it.
// Since "Smart Search" relies on schema, legacy sources (system tables) also have schema.

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
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { config } = auth;

    const { searchParams } = new URL(request.url);
    const legacySource = searchParams.get("source");
    let database = searchParams.get("database");
    let table = searchParams.get("table");
    let timeColumn = searchParams.get("timeColumn");

    if (legacySource && LEGACY_SOURCES[legacySource]) {
      const legacy = LEGACY_SOURCES[legacySource];
      database = database || legacy.database;
      table = table || legacy.table;
      timeColumn = timeColumn || legacy.timeColumn;
    }

    if (!database || !table) {
      return NextResponse.json(
        { success: false, error: "Missing DB/Table" },
        { status: 400 },
      );
    }

    const parsedLimit = parseInt(searchParams.get("limit") || "100", 10);
    const limit = isNaN(parsedLimit) ? 100 : Math.min(parsedLimit, 10000);
    const cursor = searchParams.get("cursor");
    const mode = searchParams.get("mode") || "data";
    const filter = searchParams.get("filter") || "";
    const minTime = searchParams.get("minTime");
    const maxTime = searchParams.get("maxTime");
    const columnsParam = searchParams.get("columns");
    const columns = columnsParam
      ? columnsParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    const quotedDb = quoteIdentifier(database);
    const quotedTable = quoteIdentifier(table);
    const safeDbStr = escapeSqlString(database);
    const safeTableStr = escapeSqlString(table);
    const tableSource = clusterName
      ? `clusterAllReplicas('${escapeSqlString(clusterName)}', ${quotedDb}.${quotedTable})`
      : `${quotedDb}.${quotedTable}`;

    if (mode === "histogram") {
      if (!timeColumn)
        return NextResponse.json({ success: true, histogram: [] });
      const quotedTimeCol = quoteIdentifier(timeColumn);

      const typeQuery = `SELECT type FROM system.columns WHERE database = '${safeDbStr}' AND table = '${safeTableStr}' AND name = '${escapeSqlString(timeColumn)}'`;
      let columnType = "DateTime";
      try {
        const dataRes = await client.query(typeQuery);
        const data = dataRes.data as { type: string }[];
        if (data.length) columnType = data[0].type;
      } catch {}

      const isDateOnly = columnType === "Date" || columnType === "Date32";
      let histogramQuery = "";

      const whereConds = [];
      if (minTime) {
        const minTimeNum = new Date(minTime).getTime();
        whereConds.push(
          `${quotedTimeCol} >= toDateTime64(${minTimeNum / 1000}, 3)`,
        );
      }
      if (maxTime) {
        const maxTimeNum = new Date(maxTime).getTime();
        whereConds.push(
          `${quotedTimeCol} <= toDateTime64(${maxTimeNum / 1000}, 3)`,
        );
      }
      if (filter) whereConds.push(`(${filter})`);

      const whereClause = whereConds.length
        ? `WHERE ${whereConds.join(" AND ")}`
        : "";

      if (isDateOnly) {
        histogramQuery = `SELECT ${quotedTimeCol} as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
      } else {
        let interval = "1 hour";
        if (minTime) {
          const diffHours =
            (new Date().getTime() - new Date(minTime).getTime()) / 36e5;
          if (diffHours <= 1) interval = "1 minute";
          else if (diffHours <= 6) interval = "5 minute";
          else if (diffHours <= 24) interval = "15 minute";
          else if (diffHours <= 72) interval = "1 hour";
          else interval = "6 hour";
        }
        histogramQuery = `SELECT toStartOfInterval(${quotedTimeCol}, INTERVAL ${interval}) as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
      }

      const histRes = await client.query(histogramQuery);
      return NextResponse.json({ success: true, histogram: histRes.data });
    }

    // DATA MODE - Streaming & Chunking

    // 1. Build Base WHERE (Filter + Smart Search)
    const baseWhere: string[] = [];

    if (filter && filter.trim()) {
      // Defense-in-depth: block dangerous SQL keywords that could modify data/schema
      const DANGEROUS_KEYWORDS =
        /\b(DROP|DELETE|ALTER|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|CREATE|ATTACH|DETACH|RENAME|KILL|SYSTEM)\b/i;
      const DANGEROUS_PATTERNS = /;\s*\S/; // semicolons followed by more SQL
      if (DANGEROUS_KEYWORDS.test(filter) || DANGEROUS_PATTERNS.test(filter)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid filter: contains disallowed keywords",
          },
          { status: 400 },
        );
      }
      baseWhere.push(`(${filter})`);
    }

    const searchTerm = searchParams.get("search");
    if (searchTerm) {
      const colsQuery = `SELECT name, type FROM system.columns WHERE database = '${safeDbStr}' AND table = '${safeTableStr}'`;
      const colsRes = await client.query(colsQuery);
      const tableCols = colsRes.data as unknown as ColumnDefinition[];

      const smartCond = buildSmartSearchCondition(tableCols, searchTerm);
      if (smartCond && smartCond !== "0") {
        baseWhere.push(smartCond);
      } else if (smartCond === "0") {
        return NextResponse.json({
          success: true,
          data: { rows: [], totalHits: 0 },
        });
      }
    }

    // 2. Prepare Chunker
    const selectClause = columns.length
      ? columns.map((c: string) => quoteIdentifier(c)).join(", ")
      : "*";

    const quotedTimeSortCol = timeColumn ? quoteIdentifier(timeColumn) : "";
    const orderByClause = quotedTimeSortCol
      ? `ORDER BY ${quotedTimeSortCol} DESC`
      : "";

    // 3. Start Stream
    const iterator = fetchChunks({
      client,
      tableSource,
      whereConditions: baseWhere,
      timeColumn: timeColumn || undefined,
      minTime: minTime || undefined,
      maxTime: maxTime || undefined,
      limit,
      cursor: cursor || undefined,
      selectClause,
      orderByClause,
      safeTimeCol: quotedTimeSortCol,
    });

    const stream = new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Discover API Error", error);

    if (isClickHouseError(error)) {
      const code = String(error.code);
      if (code === "60") {
        return NextResponse.json(
          { success: false, error: "Table not found" },
          { status: 404 },
        );
      }
      if (code === "497" || error.message.includes("Access denied")) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
