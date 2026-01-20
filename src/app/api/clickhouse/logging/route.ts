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
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "1000");
    const search = searchParams.get("search");
    const level = searchParams.get("level");
    const component = searchParams.get("component");
    const minTime = searchParams.get("minTime");
    source = searchParams.get("source") || "text_log"; // "text_log" or "crash_log"

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    let query = "";
    if (source === "crash_log") {
      const tableSource = clusterName
        ? `clusterAllReplicas('${clusterName}', system.crash_log)`
        : "system.crash_log";

      query = `
        SELECT
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
        FROM ${tableSource}
      `;
    } else if (source === "session_log") {
      const tableSource = clusterName
        ? `clusterAllReplicas('${clusterName}', system.session_log)`
        : "system.session_log";

      query = `
        SELECT
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
        FROM ${tableSource}
      `;
    } else {
      const tableSource = clusterName
        ? `clusterAllReplicas('${clusterName}', system.text_log)`
        : "system.text_log";

      query = `
        SELECT
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
        FROM ${tableSource}
      `;
    }

    const whereConditions: string[] = [];

    // Message search filter
    if (search) {
      const safeSearch = search.replace(/'/g, "''");
      whereConditions.push(`message ILIKE '%${safeSearch}%'`);
    }

    // Component filter
    if (component) {
      const safeComponent = component.replace(/'/g, "''");
      if (source === "crash_log") {
        // for crash log "component" is mostly signal or we can just ignore component filter or filter on other fields
        // but consistent UI might send it. Let's filter on thread_name or something relevant if needed?
        // Mapped component is 'signal'
        whereConditions.push(`toString(signal) ILIKE '%${safeComponent}%'`);
      } else if (source === "session_log") {
        whereConditions.push(`user ILIKE '%${safeComponent}%'`);
      } else {
        whereConditions.push(`logger_name ILIKE '%${safeComponent}%'`);
      }
    }

    // Level/Type filter (text_log uses level, session_log uses type)
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
      const timeCol =
        source === "crash_log" || source === "session_log"
          ? "event_time"
          : "event_time_microseconds";
      whereConditions.push(
        `${timeCol} > parseDateTimeBestEffort('${safeMin}')`,
      );
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    const orderCol =
      source === "crash_log" || source === "session_log"
        ? "event_time"
        : "event_time_microseconds";
    query += ` ORDER BY ${orderCol} DESC LIMIT ${limit}`;

    // Define the expected row structure
    interface LogRow {
      timestamp: string | number;
      type?: string;
      event_type?: string;
      component: string;
      message: string;
      details: string;
      event_time: string;
      thread_name: string;
      query_id: string;
      source_file: string;
      source_line: number;
    }

    const resultSet = await client.query<LogRow>(query);

    // Map result rows to standard LogEntry format
    const data = resultSet.data.map((row) => ({
      ...row,
      // For session_log, we aliased `type` as `event_type` to avoid ambiguity
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
    console.error("Failed to fetch logs:", error);

    if (isClickHouseError(error)) {
      // Handle UNKNOWN_TABLE (60) specifically for session_log
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (error as any).code;
      if ((code === 60 || code === "60") && source === "session_log") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Session logging is not enabled on this server. Please configure 'session_log' in config.xml.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error.userMessage || "Failed to fetch logs",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch logs",
      },
      { status: 500 },
    );
  }
}
