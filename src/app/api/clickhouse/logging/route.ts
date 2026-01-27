// ... imports
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClient,
  isClickHouseError,
  type ClickHouseError,
} from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import { ApiErrors } from "@/lib/api";
import { fetchChunks } from "@/lib/clickhouse/stream";

export async function GET(request: Request) {
  let source = "text_log";

  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "1000"),
      10000,
    );
    const search = searchParams.get("search");
    const level = searchParams.get("level");
    const component = searchParams.get("component");
    const minTimeParam = searchParams.get("minTime"); // For Time Range or Live Mode (if no cursor)
    const cursor = searchParams.get("cursor"); // For history (older than cursor)
    source = searchParams.get("source") || "text_log"; // "text_log" or "crash_log"

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    // Determine Table and Columns
    const database = "system";
    let table = "text_log";
    // let filterCols: Record<string, string> = {}; // internal logic for custom filters

    if (source === "crash_log") {
      table = "crash_log";
    } else if (source === "session_log") {
      table = "session_log";
    }

    const safeDatabase = database;
    const safeTable = table;

    const tableSource = clusterName
      ? `clusterAllReplicas('${clusterName}', \`${safeDatabase}\`.\`${safeTable}\`)`
      : `\`${safeDatabase}\`.\`${safeTable}\``;

    // Time Column logic
    const timeColumn =
      source === "crash_log" || source === "session_log"
        ? "event_time"
        : "event_time_microseconds";

    // safeTimeCol for wrapper
    // const safeTimeCol = timeColumn;

    // Build SELECT and WHERE
    // We construct the "Projection" (columns) and "Selection" (rows)

    // Columns mapping
    // We want to return standard JSON objects matching our frontend LogEntry
    // BUT `fetchChunks` yields raw rows.
    // So we should construct a SELECT clause that aliases columns to the expected JSON keys
    // OR we transform in the stream?
    // Streaming raw text is faster. Let's do alias in SQL.

    let selectClause = "";
    if (source === "crash_log") {
      selectClause = `
          event_time as timestamp,
          'Fatal' as type,
          toString(signal) as component,
          concat(exception, '\nStack trace:\n', stack_trace) as message,
          concat('Thread ID: ', toString(thread_id), ', Protocol: ', toString(protocol_version)) as details,
          event_time,
          thread_name,
          query_id,
          source_file,
          source_line
      `;
    } else if (source === "session_log") {
      selectClause = `
          event_time as timestamp,
          toString(type) as type,
          user as component,
          concat('Auth: ', toString(auth_type), ', Remote: ', toString(client_address), ', Client: ', client_name) as message,
          concat('Interface: ', toString(interface), ', Session ID: ', session_id, if(failure_reason != '', concat(', Reason: ', failure_reason), '')) as details,
          event_time,
          client_hostname as thread_name,
          session_id as query_id,
          '' as source_file,
          0 as source_line
      `;
    } else {
      // text_log
      selectClause = `
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

    // Build WHERE
    const whereConditions: string[] = [];

    if (search) {
      const safeSearch = search.replace(/'/g, "''");
      whereConditions.push(`message ILIKE '%${safeSearch}%'`);
    }

    if (component) {
      const safeComponent = component.replace(/'/g, "''");
      if (source === "crash_log") {
        whereConditions.push(`toString(signal) ILIKE '%${safeComponent}%'`);
      } else if (source === "session_log") {
        whereConditions.push(`user ILIKE '%${safeComponent}%'`);
      } else {
        whereConditions.push(`logger_name ILIKE '%${safeComponent}%'`);
      }
    }

    if (level && level !== "All") {
      const safeLevel = level.replace(/'/g, "''");
      if (source === "text_log") {
        whereConditions.push(`level = '${safeLevel}'`);
      } else if (source === "session_log") {
        whereConditions.push(`type = '${safeLevel}'`);
      }
    }

    // minTime logic for Live Mode or Time Range
    // If we are scrolling BACK (cursor provided), minTime is strictly a lower bound (stop condition).
    // If we are refreshing LIVE (no cursor, maybe minTime is "last seen"), we want > minTime.

    // BUT `fetchChunks` assumes we are paginating DESCENDING (History).
    // How do we handle "Live Mode" (Newest, > last timestamp)?
    // `fetchChunks` is built for "History" (fetch older).

    // If this is a "Live Update" request, we probably don't need chunking, just a simple query.
    // Live update = "Give me everything since X". Usually small.
    // Let's differentiate:
    // 1. History Mode (standard load / scroll): ORDER BY time DESC.
    // 2. Live Mode (auto-refresh): ORDER BY time ASC (or DESC) WHERE time > last_seen.

    // Check if we are in "Live Mode" (fetching NEW data)
    // We can use a flag or infer from params.
    // Discover API unified everything into `fetchChunks` but it only supports [min, max] range.
    // If we want "Everything > minTime", we can set minTime=X, maxTime=Now.
    // `fetchChunks` works for that too! It chunks from Max down to Min.

    // However, for "Live Mode", typically we only want strict `> minTime`.
    // The current `fetchChunks` uses `>= minTime` (inclusive low) and `< maxTime` (exclusive high).

    // Let's trust `fetchChunks`. If we set `minTime` to the last seen timestamp,
    // it will fetch everything from Now down to that timestamp.
    // We just need to handle deduplication on frontend (since it is inclusive low).
    // OR we pass `minTime` slightly adjusted?
    // It's safer to just set `minTime`.

    const minTime = minTimeParam || undefined;
    const maxTime = undefined;

    const orderByClause = `ORDER BY ${timeColumn} DESC`;

    // Start Stream
    const iterator = fetchChunks({
      client,
      tableSource,
      whereConditions,
      timeColumn,
      minTime,
      maxTime,
      limit,
      cursor: cursor || undefined,
      selectClause,
      orderByClause,
      safeTimeCol: timeColumn,
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
    console.error("Failed to fetch logs:", error);

    if (isClickHouseError(error)) {
      const chError = error as ClickHouseError;
      if (chError.code === 60 && source === "session_log") {
        return ApiErrors.badRequest(
          "Session logging is not enabled on this server. Please configure 'session_log' in config.xml.",
        );
      }
      // We can't return JSON if we started streaming, but here we haven't started yet.
      return ApiErrors.fromError(error, "Failed to fetch logs");
    }

    return ApiErrors.internal("Failed to fetch logs");
  }
}
