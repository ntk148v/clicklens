import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getUserConfig,
  createClient,
  isClickHouseError,
} from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import {
  buildSmartSearchCondition,
  ColumnDefinition,
} from "@/lib/clickhouse/search";

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

/**
 * Generator that yields NDJSON chunks (strings)
 */
async function* fetchChunks({
  client,
  tableSource,
  whereConditions,
  timeColumn,
  minTime,
  maxTime,
  limit,
  initialOffset,
  selectClause,
  orderByClause,
  safeTimeCol,
}: {
  client: ReturnType<typeof createClient>;
  tableSource: string;
  whereConditions: string[];
  timeColumn?: string;
  minTime?: string;
  maxTime?: string;
  limit: number;
  initialOffset: number;
  selectClause: string;
  orderByClause: string;
  safeTimeCol: string;
}) {
  let rowsFetched = 0;

  // If no time column, we can't chunk by time. Fallback to single query.
  if (!timeColumn || !minTime) {
    // metadata chunk
    yield JSON.stringify({ meta: { totalHits: 0 } }) + "\n";

    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""}
      ${orderByClause}
      LIMIT ${limit}
      OFFSET ${initialOffset}
    `;

    try {
      const rs = await client.query(query); // Wrapper returns typed result
      const rows = rs.data;

      for (const row of rows) {
        yield JSON.stringify(row) + "\n";
      }
    } catch (e) {
      console.error("Query error", e);
      yield JSON.stringify({ error: String(e) }) + "\n";
    }
    return;
  }

  // Calculate Chunks
  // Start from maxTime (or now) down to minTime
  // Ensure valid times
  const MaxTimeNum = maxTime ? new Date(maxTime).getTime() : Date.now();
  const MinTimeNum = minTime
    ? new Date(minTime).getTime()
    : Date.now() - 24 * 3600 * 1000;

  const End = MaxTimeNum;
  const Start = MinTimeNum;

  const TotalDuration = End - Start;
  let ChunkSize = 6 * 60 * 60 * 1000; // 6 hours

  if (TotalDuration < ChunkSize && TotalDuration > 0) {
    ChunkSize = TotalDuration; // Single chunk
  }

  let currentHigh = End;
  let hasMoreChunks = true;

  // First yield metadata
  let totalHits = 0;
  try {
    const countQuery = `SELECT count() as cnt FROM ${tableSource} ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""}`;
    const countRes = await client.query(countQuery);
    // wrapper returns { data: [...] } where data is array of objects
    // data[0] should be { cnt: ... }
    totalHits = Number(countRes.data[0]?.cnt) || 0;
  } catch (e) {
    console.error("Count query failed", e);
  }

  yield JSON.stringify({ meta: { totalHits } }) + "\n";

  if (initialOffset > 0) {
    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""}
      ${orderByClause}
      LIMIT ${limit}
      OFFSET ${initialOffset}
    `;
    try {
      const rs = await client.query(query);
      const rows = rs.data;
      for (const row of rows) {
        yield JSON.stringify(row) + "\n";
      }
    } catch (e) {
      console.error("Query error", e);
      yield JSON.stringify({ error: String(e) }) + "\n";
    }
    return;
  }

  while (hasMoreChunks && rowsFetched < limit) {
    const currentLow = Math.max(Start, currentHigh - ChunkSize);

    const chunkWhere = [...whereConditions];

    const lowIso = new Date(currentLow).toISOString();
    const highIso = new Date(currentHigh).toISOString();

    // Chunk Time Range
    if (currentHigh === End) {
      chunkWhere.push(
        `\`${safeTimeCol}\` <= parseDateTimeBestEffort('${highIso}')`,
      );
    } else {
      chunkWhere.push(
        `\`${safeTimeCol}\` < parseDateTimeBestEffort('${highIso}')`,
      );
    }
    chunkWhere.push(
      `\`${safeTimeCol}\` >= parseDateTimeBestEffort('${lowIso}')`,
    );

    const chunkLimit = limit - rowsFetched;

    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      WHERE ${chunkWhere.join(" AND ")}
      ${orderByClause}
      LIMIT ${chunkLimit}
    `;

    try {
      const rs = await client.query(query);
      const rows = rs.data;

      for (const row of rows) {
        yield JSON.stringify(row) + "\n";
        rowsFetched++;
        if (rowsFetched >= limit) break;
      }

      // If we got fewer rows than chunkLimit (and we are not limited by global limit), it implies this chunk is exhausted?
      // Not necessarily, simply pushed to client.
    } catch (e) {
      console.error("Chunk query error", e);
      yield JSON.stringify({ error: String(e) }) + "\n";
      return;
    }

    if (currentLow <= Start) {
      hasMoreChunks = false;
    }
    currentHigh = currentLow;
  }
}

export async function GET(request: Request) {
  try {
    // Explicit session check matching databases/route.ts pattern
    const session = await getSession();
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Get config using helper
    const config = getUserConfig(session.user);
    if (!config) {
      // This generally means server environment variables are missing
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 },
      );
    }

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

    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 10000);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
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

    const safeDatabase = database.replace(/[`]/g, "");
    const safeTable = table.replace(/[`]/g, "");
    const tableSource = clusterName
      ? `clusterAllReplicas('${clusterName}', \`${safeDatabase}\`.\`${safeTable}\`)`
      : `\`${safeDatabase}\`.\`${safeTable}\``;

    if (mode === "histogram") {
      if (!timeColumn)
        return NextResponse.json({ success: true, histogram: [] });
      const safeTimeCol = timeColumn.replace(/[`]/g, "");

      const typeQuery = `SELECT type FROM system.columns WHERE database = '${safeDatabase}' AND table = '${safeTable}' AND name = '${safeTimeCol}'`;
      let columnType = "DateTime";
      try {
        const dataRes = await client.query(typeQuery);
        const data = dataRes.data as { type: string }[];
        if (data.length) columnType = data[0].type;
      } catch {}

      const isDateOnly = columnType === "Date" || columnType === "Date32";
      let histogramQuery = "";

      const whereConds = [];
      if (minTime)
        whereConds.push(
          `\`${safeTimeCol}\` >= parseDateTimeBestEffort('${minTime.replace(/'/g, "''")}')`,
        );
      if (maxTime)
        whereConds.push(
          `\`${safeTimeCol}\` <= parseDateTimeBestEffort('${maxTime.replace(/'/g, "''")}')`,
        );
      if (filter) whereConds.push(`(${filter})`);

      const whereClause = whereConds.length
        ? `WHERE ${whereConds.join(" AND ")}`
        : "";

      if (isDateOnly) {
        histogramQuery = `SELECT \`${safeTimeCol}\` as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
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
        histogramQuery = `SELECT toStartOfInterval(\`${safeTimeCol}\`, INTERVAL ${interval}) as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
      }

      const histRes = await client.query(histogramQuery);
      return NextResponse.json({ success: true, histogram: histRes.data });
    }

    // DATA MODE - Streaming & Chunking

    // 1. Build Base WHERE (Filter + Smart Search)
    const baseWhere: string[] = [];

    if (filter && filter.trim()) {
      // Sanitize
      const dangerousPatterns = [/;\s*(DROP|DELETE|ALTER|GRANT)/i];
      if (dangerousPatterns.some((p) => p.test(filter))) {
        return NextResponse.json(
          { success: false, error: "Invalid filter" },
          { status: 400 },
        );
      }
      baseWhere.push(`(${filter})`);
    }

    const searchTerm = searchParams.get("search");
    if (searchTerm) {
      const colsQuery = `SELECT name, type FROM system.columns WHERE database = '${safeDatabase}' AND table = '${safeTable}'`;
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
      ? columns.map((c: string) => `\`${c.replace(/`/g, "")}\``).join(", ")
      : "*";

    const safeTimeCol = timeColumn ? timeColumn.replace(/[`]/g, "") : "";
    const orderByClause = safeTimeCol ? `ORDER BY \`${safeTimeCol}\` DESC` : "";

    // 3. Start Stream
    const iterator = fetchChunks({
      client,
      tableSource,
      whereConditions: baseWhere,
      timeColumn: timeColumn || undefined,
      minTime: minTime || undefined,
      maxTime: maxTime || undefined,
      limit,
      initialOffset: offset,
      selectClause,
      orderByClause,
      safeTimeCol,
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
