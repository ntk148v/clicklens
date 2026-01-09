import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";

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
    const limit = parseInt(searchParams.get("limit") || "1000");
    const search = searchParams.get("search");
    const level = searchParams.get("level");
    const component = searchParams.get("component");
    const minTime = searchParams.get("minTime");
    const source = searchParams.get("source") || "text_log"; // "text_log" or "crash_log"

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
      } else {
        whereConditions.push(`logger_name ILIKE '%${safeComponent}%'`);
      }
    }

    // Level filter (only for text_log)
    if (source === "text_log" && level && level !== "All") {
      const safeLevel = level.replace(/'/g, "''");
      whereConditions.push(`level = '${safeLevel}'`);
    }

    // Time filter
    if (minTime) {
      const safeMin = minTime.replace(/'/g, "''");
      const timeCol =
        source === "crash_log" ? "event_time" : "event_time_microseconds";
      whereConditions.push(
        `${timeCol} > parseDateTimeBestEffort('${safeMin}')`
      );
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    const orderCol =
      source === "crash_log" ? "event_time" : "event_time_microseconds";
    query += ` ORDER BY ${orderCol} DESC LIMIT ${limit}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultSet = await client.query<any>(query);

    return NextResponse.json({
      success: true,
      data: {
        data: resultSet.data,
        rows: resultSet.rows || resultSet.data.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json({
      success: false,
      error: isClickHouseError(error)
        ? error.userMessage
        : "Failed to fetch logs",
    });
  }
}
