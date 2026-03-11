import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import { getTableEngine } from "@/lib/clickhouse/schema";
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
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
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

    const orderByParam = searchParams.get("orderBy");
    const groupByParam = searchParams.get("groupBy");

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    const quotedDb = quoteIdentifier(database);
    const quotedTable = quoteIdentifier(table);
    const safeDbStr = escapeSqlString(database);
    const safeTableStr = escapeSqlString(table);

    const engine = await getTableEngine(client, database, table);
    const isDistributed = engine === "Distributed" || engine === "Dictionary";

    const tableSource =
      clusterName && !isDistributed
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
        // Target roughly 30-100 buckets to prevent frontend freeze
        let interval = "1 week";
        if (minTime) {
          const diffMs =
            (maxTime ? new Date(maxTime).getTime() : Date.now()) -
            new Date(minTime).getTime();
          const diffHours = diffMs / 36e5;

          if (diffHours <= 1)
            interval = "1 minute"; // ~60 buckets
          else if (diffHours <= 6)
            interval = "5 minute"; // ~72 buckets
          else if (diffHours <= 24)
            interval = "15 minute"; // ~96 buckets
          else if (diffHours <= 72)
            interval = "1 hour"; // ~72 buckets
          else if (diffHours <= 24 * 7)
            interval = "4 hour"; // ~42 buckets
          else if (diffHours <= 24 * 30)
            interval = "1 day"; // ~30 buckets
          else if (diffHours <= 24 * 365)
            interval = "1 week"; // ~52 buckets
          else interval = "1 month";
        }
        histogramQuery = `SELECT toStartOfInterval(${quotedTimeCol}, INTERVAL ${interval}) as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
      }

      const histRes = await client.query(histogramQuery);
      return NextResponse.json({ success: true, histogram: histRes.data });
    }

    // DATA MODE - Streaming & Chunking

    // Helper function to build time-based WHERE conditions
    const buildTimeWhereConditions = (
      timeCol: string | null,
      minT: string | null,
      maxT: string | null
    ): string[] => {
      const conds: string[] = [];
      if (timeCol && minT) {
        const minTimeNum = new Date(minT).getTime();
        conds.push(
          `${quoteIdentifier(timeCol)} >= toDateTime64(${minTimeNum / 1000}, 3)`
        );
      }
      if (timeCol && maxT) {
        const maxTimeNum = new Date(maxT).getTime();
        conds.push(
          `${quoteIdentifier(timeCol)} <= toDateTime64(${maxTimeNum / 1000}, 3)`
        );
      }
      return conds;
    };

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

    // 2. Prepare Chunker / Query properties
    let selectClause = columns.length
      ? columns.map((c: string) => quoteIdentifier(c)).join(", ")
      : "*";

    // 2a. Order By
    const quotedTimeSortCol = timeColumn ? quoteIdentifier(timeColumn) : "";
    let orderByClause = quotedTimeSortCol
      ? `ORDER BY ${quotedTimeSortCol} DESC`
      : "";

    if (orderByParam) {
      // Expects format "col:desc,col2:asc"
      const sorts = orderByParam.split(",").map((s) => {
        const [col, dir] = s.split(":");
        return `${quoteIdentifier(col)} ${dir.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
      });
      orderByClause = `ORDER BY ${sorts.join(", ")}`;
    }

    // 2b. Single Query branch (for Group By or ORDER BY)
    // ORDER BY requires offset-based pagination since time-based cursor doesn't work with custom sorting
    if (groupByParam || orderByParam) {
      let groupByClause = "";

      if (groupByParam) {
        const groupCols = groupByParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

        if (groupCols.length > 0) {
          // Build GROUP BY
          const quotedGroupCols = groupCols.map((c) => quoteIdentifier(c));
          groupByClause = `GROUP BY ${quotedGroupCols.join(", ")}`;

          // When GROUP BY is active, only select the grouped columns + count()
          // Ignore the user's selected columns to avoid invalid SQL (selecting unaggregated cols)
          selectClause = `${quotedGroupCols.join(", ")}, count() as count`;
        }
      }

      // If we are grouping but have no orderBy, clear orderByClause
      // because sorting by time makes no sense if we lack it in group.
      if (groupByParam && !orderByParam) {
        orderByClause = "";
      }

      // Add time filtering conditions
      const timeWhereConditions = buildTimeWhereConditions(timeColumn, minTime, maxTime);
      baseWhere.push(...timeWhereConditions);

      const query = `
        SELECT ${selectClause}
        FROM ${tableSource}
        ${baseWhere.length > 0 ? `WHERE ${baseWhere.join(" AND ")}` : ""}
        ${groupByClause}
        ${orderByClause}
        LIMIT ${limit}
        ${offset > 0 ? `OFFSET ${offset}` : ""}
      `;

      // Run count query in parallel
      let countQuery = `SELECT count() as cnt FROM ${tableSource}`;
      if (baseWhere.length > 0) countQuery += ` WHERE ${baseWhere.join(" AND ")}`;
      if (groupByClause) {
        // If we group, the total hits is the number of distinct groups.
        countQuery = `SELECT count() as cnt FROM (SELECT 1 FROM ${tableSource} ${baseWhere.length > 0 ? `WHERE ${baseWhere.join(" AND ")}` : ""} ${groupByClause})`;
      }

      const countPromise = client
        .query(countQuery)
        .then((res) => Number(res.data[0]?.cnt) || 0)
        .catch((e) => {
          console.error("Count query failed", e);
          return 0;
        });

      // Create direct NDJSON stream for aggregation / specific order / specific pagination
      const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(JSON.stringify({ meta: { totalHits: -1 } }) + "\n");
              
              // Run actual query
              const rs = await client.query(query);
              const rows = rs.data;
              for (const row of rows) {
                controller.enqueue(JSON.stringify(row) + "\n");
              }
              
              const totalHits = await countPromise;
              controller.enqueue(JSON.stringify({ meta: { totalHits } }) + "\n");
            } catch (err) {
              controller.enqueue(JSON.stringify({ error: String(err) }) + "\n");
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "X-Content-Type-Options": "nosniff",
          },
        });
    }

    // 3. Start Stream (No GROUP BY)
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
