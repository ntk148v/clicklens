import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

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

    // Build query for system.text_log
    let query = `
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
      FROM system.text_log
    `;

    const whereConditions: string[] = [];

    // Message search filter
    if (search) {
      const safeSearch = search.replace(/'/g, "''");
      whereConditions.push(`message ILIKE '%${safeSearch}%'`);
    }

    // Component filter (logger_name)
    if (component) {
      const safeComponent = component.replace(/'/g, "''");
      whereConditions.push(`logger_name ILIKE '%${safeComponent}%'`);
    }

    // Level filter - exact match for specific level
    if (level && level !== "All") {
      const safeLevel = level.replace(/'/g, "''");
      whereConditions.push(`level = '${safeLevel}'`);
    }

    // Time filter (minTime = "newer than")
    if (minTime) {
      const safeMin = minTime.replace(/'/g, "''");
      whereConditions.push(
        `event_time_microseconds > parseDateTimeBestEffort('${safeMin}')`
      );
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    query += ` ORDER BY event_time_microseconds DESC LIMIT ${limit}`;

    const client = createClientWithConfig(config);
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
