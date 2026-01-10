import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";

export const runtime = "nodejs";

const MAX_ROWS = 500000;

export async function POST(request: NextRequest) {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in to ClickHouse first",
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.sql || typeof body.sql !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "SQL query is required",
            type: "BAD_REQUEST",
            userMessage: "SQL query is required",
          },
        },
        { status: 400 }
      );
    }

    const client = createClient(config);

    let sql = body.sql;
    if (typeof body.page === "number") {
      const pageSize = typeof body.pageSize === "number" ? body.pageSize : 1000;
      const offset = body.page * pageSize;
      // Remove trailing semicolon
      const cleanSql = sql.trim().replace(/;$/, "");
      sql = `SELECT * FROM (${cleanSql}) LIMIT ${pageSize} OFFSET ${offset}`;
    }

    // Build ClickHouse settings with optional database context
    const clickhouseSettings: Record<string, unknown> = {
      max_result_rows: MAX_ROWS + 1,
      result_overflow_mode: "break",
      date_time_output_format: "iso",
    };

    // If timezone is provided, set it in settings
    if (body.timezone && typeof body.timezone === "string") {
      clickhouseSettings.session_timezone = body.timezone;
    }

    // If database is provided, set it as the default database for the query
    if (body.database && typeof body.database === "string") {
      clickhouseSettings.database = body.database;
    }

    // Get the ClickHouse stream
    const resultSet = await client.queryStream(sql, {
      timeout: body.timeout,
      query_id: body.query_id,
      format: "JSONCompactEachRowWithNamesAndTypes",
      clickhouse_settings: clickhouseSettings,
    });

    const stream = (
      resultSet as unknown as { stream: () => AsyncIterable<unknown> }
    ).stream();
    let rowsRead = 0;
    let limitReached = false;
    let meta: { name: string; type: string }[] = [];

    // Create a new stream that transforms ClickHouse output to our NDJSON format
    const customStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper to push JSON
        const push = (data: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          let lineCount = 0;
          let colNames: string[] = [];

          for await (const chunk of stream) {
            const items = Array.isArray(chunk) ? chunk : [chunk];

            for (const item of items) {
              // Helper to handle ClickHouse stream chunks which might be wrapped in { text: "..." }
              // or just be the data itself (though Client usually returns objects)
              let data = item;
              if (
                data &&
                typeof data === "object" &&
                typeof data.text === "string"
              ) {
                try {
                  data = JSON.parse(data.text);
                } catch {
                  // keep as is if parse fails
                }
              }

              if (lineCount === 0) {
                // Column Names
                colNames = data as string[];
                lineCount++;
              } else if (lineCount === 1) {
                // Column Types
                const colTypes = data as string[];
                if (Array.isArray(colNames) && Array.isArray(colTypes)) {
                  meta = colNames.map((name, i) => ({
                    name: String(name),
                    type: String(colTypes[i]),
                  }));
                } else {
                  // Fallback if format is unexpected
                  meta = [{ name: "result", type: "String" }];
                }

                // Send Schema
                push({ type: "meta", data: meta, rows: 0 }); // Initial meta
                lineCount++;
              } else {
                // Data Row
                // Backpressure handling
                if (
                  controller.desiredSize !== null &&
                  controller.desiredSize <= 0
                ) {
                  await new Promise((resolve) => setTimeout(resolve, 0));
                }

                if (rowsRead >= MAX_ROWS) {
                  limitReached = true;
                  break;
                }

                rowsRead++;

                // Send row data
                push({ type: "data", data: [data], rows_count: rowsRead });

                // Send progress occasionally
                if (rowsRead % 1000 === 0) {
                  push({ type: "progress", rows_read: rowsRead });
                }
              }
            }
            if (limitReached) break;
          }

          if (limitReached) {
            // If we stopped early
          } else {
            // We finished naturally
          }

          push({
            type: "done",
            limit_reached: limitReached,
            statistics: {
              elapsed: 0, // Not easily available in stream
              rows_read: rowsRead,
              bytes_read: 0,
            },
          });
        } catch (err) {
          console.error("Stream processing error", err);
          push({
            type: "error",
            error: {
              message: err instanceof Error ? err.message : String(err),
            },
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error", error);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
