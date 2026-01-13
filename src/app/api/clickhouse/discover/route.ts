import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";

export async function GET(request: Request) {
  let source = "text_log";

  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "1000");
    const search = searchParams.get("search");
    const level = searchParams.get("level");
    const component = searchParams.get("component");
    const minTime = searchParams.get("minTime");
    const mode = searchParams.get("mode") || "logs"; // "logs" or "histogram"
    source = searchParams.get("source") || "text_log";

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    // Determine table source
    let table = "system.text_log";
    if (source === "crash_log") table = "system.crash_log";
    if (source === "session_log") table = "system.session_log";

    const tableSource = clusterName
      ? `clusterAllReplicas('${clusterName}', ${table})`
      : table;

    const timeCol =
      source === "crash_log" || source === "session_log"
        ? "event_time"
        : "event_time_microseconds";

    // Build WHERE conditions
    const whereConditions: string[] = [];

    // Message search
    if (search) {
      const safeSearch = search.replace(/'/g, "''");
      if (source === "session_log") {
        whereConditions.push(
          `(user ILIKE '%${safeSearch}%' OR database ILIKE '%${safeSearch}%' OR client_name ILIKE '%${safeSearch}%')`
        );
      } else {
        whereConditions.push(`message ILIKE '%${safeSearch}%'`);
      }
    }

    // Component filter
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

    // Level/Type filter
    if (level && level !== "All") {
      const safeLevel = level.replace(/'/g, "''");
      if (source === "text_log") {
        whereConditions.push(`level = '${safeLevel}'`);
      } else if (source === "session_log") {
        whereConditions.push(`type = '${safeLevel}'`);
      }
    }

    // Time filter
    if (minTime) {
      const safeMin = minTime.replace(/'/g, "''");
      whereConditions.push(
        `${timeCol} > parseDateTimeBestEffort('${safeMin}')`
      );
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // --- HISTOGRAM QUERY ---
    if (mode === "histogram") {
      // Determine interval based on time range approx
      // Default to 1 hour buckets if no minTime, else adaptive
      let interval = "1 hour";
      if (minTime) {
        // Simple adaptive logic could be added here, currently sticking to sensible defaults
        // For now, let's hardcode a reasonable interval or let client pass it?
        // Let's settle on a dynamic interval based on the range logic purely in SQL if possible or fixed
        // Using 'toStartOfInterval' with dynamic string.
        // For simplicity validation, let's assume '1 minute' for short ranges, '1 hour' for long.
        // To make it robust, we can default to 'toStartOfHour' or similar.
        // Let's implement a simple heuristic:
        const now = new Date();
        const min = minTime
          ? new Date(minTime)
          : new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const diffHours = (now.getTime() - min.getTime()) / (1000 * 60 * 60);

        if (diffHours <= 1)
          interval = "1 minute"; // Last hour -> minute buckets
        else if (diffHours <= 24)
          interval = "15 minute"; // Last 24h -> 15 min buckets
        else interval = "1 hour"; // > 24h -> hour buckets
      }

      const query = `
        SELECT
          toStartOfInterval(${timeCol}, INTERVAL ${interval}) as time,
          count() as count
        FROM ${tableSource}
        ${whereClause}
        GROUP BY time
        ORDER BY time
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultSet = await client.query<any>(query);
      const data = resultSet.data;

      return NextResponse.json({ success: true, data });
    }

    // --- LOGS QUERY ---
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
    } else {
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

    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      ${whereClause}
      ORDER BY ${timeCol} DESC
      LIMIT ${limit}
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultSet = await client.query<any>(query);

    // Map result rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = resultSet.data.map((row: any) => ({
      ...row,
      type: row.event_type || row.type,
    }));

    return NextResponse.json({
      success: true,
      data: {
        data: data,
        rows: resultSet.rows || resultSet.data.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch discover data:", error);
    if (isClickHouseError(error)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (error as any).code;
      if ((code === 60 || code === "60") && source === "session_log") {
        return NextResponse.json({
          success: false,
          error: "Session logging not enabled",
        });
      }
    }
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch data",
    });
  }
}
