import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig, checkPermission } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";
import { formatQueryError } from "@/lib/errors";
import { validateSqlStatement } from "@/lib/sql/validator";
import { checkRateLimit, getClientIdentifier } from "@/lib/auth/rate-limit";
import { requireCsrf } from "@/lib/auth/csrf";
import { getQueryCache } from "@/lib/cache/query-cache";

export const runtime = "nodejs";

const MAX_ROWS = 500000;
const MAX_QUERY_TIMEOUT_MS = 300000;
const QUERY_ID_PREFIX = "clicklens-";
const QUERY_RATE_LIMIT = 60;
const QUERY_RATE_WINDOW_MS = 60000;

export async function POST(request: NextRequest) {
  try {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`query:${clientId}`, QUERY_RATE_LIMIT, QUERY_RATE_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: { code: 429, message: "Too many queries", type: "RATE_LIMITED", userMessage: "Too many queries. Please slow down." } },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } },
      );
    }

    const authError = await checkPermission("canExecuteQueries");
    if (authError) return authError;

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
        { status: 401 },
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
        { status: 400 },
      );
    }

    // If timezone is provided, include it in the client configuration
    const settings: Record<string, unknown> = {};
    if (body.timezone && typeof body.timezone === "string") {
      settings.session_timezone = body.timezone;
    }

    const client = createClient({ ...config, settings });

    const validation = validateSqlStatement(body.sql);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 403,
            message: validation.reason,
            type: "FORBIDDEN_STATEMENT",
            userMessage: validation.reason,
          },
        },
        { status: 403 },
      );
    }

    // Initialize query cache
    const queryCache = getQueryCache();
    const cacheEnabled = body.cache !== false;

    let sql = body.sql;
    if (typeof body.page === "number") {
      const pageSize = typeof body.pageSize === "number" ? body.pageSize : 1000;
      const offset = body.page * pageSize;
      // Remove trailing semicolon
      const cleanSql = sql.trim().replace(/;$/, "");

      // Only paginate SELECT or WITH queries. Other statements (e.g. OPTIMIZE, ALTER, EXPLAIN, SHOW)
      // will fail if wrapped in a SELECT subquery.
      const isPaginatedQuery =
        /^(?:\/\*[\s\S]*?\*\/|--.*?\n|\s)*(?:WITH|SELECT)\b/i.test(cleanSql);

      if (isPaginatedQuery) {
        sql = `SELECT * FROM (${cleanSql}) LIMIT ${pageSize} OFFSET ${offset}`;
      }
    }

    // Build ClickHouse settings with optional database context
    const clickhouseSettings: Record<string, unknown> = {
      max_result_rows: MAX_ROWS + 1,
      result_overflow_mode: "break",
      date_time_output_format: "iso",
    };

    // If database is provided, set it as the default database for the query
    if (body.database && typeof body.database === "string") {
      clickhouseSettings.database = body.database;
    }

    // Validate and sanitize timeout
    const timeout =
      typeof body.timeout === "number" && body.timeout > 0
        ? Math.min(body.timeout, MAX_QUERY_TIMEOUT_MS)
        : undefined;

    // Prefix query_id with app identifier to prevent collision with other users' queries
    const queryId = body.query_id
      ? `${QUERY_ID_PREFIX}${config.username}-${body.query_id}`
      : undefined;

    // Check cache for SELECT queries (only cache small result sets)
    if (cacheEnabled && /^\s*SELECT\b/i.test(sql)) {
      const cacheKey = queryCache.generateSqlKey(sql, body.database);
      const cachedResult = queryCache.getCachedQuery(cacheKey);
      
      if (cachedResult) {
        // Return cached result as stream
        const cachedData = cachedResult.data as { meta?: unknown[]; data?: unknown[]; error?: string };
        
        const cachedStream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            try {
              if (cachedData.meta) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: "meta", data: cachedData.meta, rows: 0 }) + "\n"));
              }
              if (cachedData.data && Array.isArray(cachedData.data)) {
                for (const row of cachedData.data) {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: "data", data: [row], rows_count: cachedData.data.length }) + "\n"));
                }
              }
              controller.enqueue(encoder.encode(JSON.stringify({ 
                type: "done", 
                limit_reached: false,
                statistics: { elapsed: 0, rows_read: cachedData.data?.length || 0, bytes_read: 0 },
                cacheHit: true,
                cacheAge: Date.now() - cachedResult.timestamp,
              }) + "\n"));
            } catch (e) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: String(e) }) + "\n"));
            } finally {
              controller.close();
            }
          },
        });
        
        return new Response(cachedStream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    // Get the ClickHouse stream
    const resultSet = await client.queryStream(sql, {
      timeout,
      query_id: queryId,
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
    // PERFORMANCE FIX: Proper backpressure handling to prevent memory issues
    const customStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;

        // Helper to push JSON with closed check
        const push = (data: unknown): boolean => {
          if (isClosed) return false;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
            return true;
          } catch {
            return false;
          }
        };

        // Proper backpressure wait with timeout
        const waitForBackpressure = async (): Promise<boolean> => {
          if (isClosed) return false;

          const startTime = Date.now();
          while (
            controller.desiredSize !== null &&
            controller.desiredSize <= 0
          ) {
            if (isClosed || Date.now() - startTime > 30000) {
              return false; // Timeout after 30s
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          return true;
        };

        try {
          let lineCount = 0;
          let colNames: string[] = [];
          // PERFORMANCE FIX: Smaller batch size for better memory management
          const BATCH_SIZE = 100;
          let batch: unknown[] = [];

          for await (const chunk of stream) {
            if (isClosed) break;

            const items = Array.isArray(chunk) ? chunk : [chunk];

            for (const item of items) {
              if (isClosed) break;

              // Helper to handle ClickHouse stream chunks
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
                  meta = [{ name: "result", type: "String" }];
                }

                if (!push({ type: "meta", data: meta, rows: 0 })) {
                  isClosed = true;
                  break;
                }
                lineCount++;
              } else {
                if (rowsRead >= MAX_ROWS) {
                  limitReached = true;
                  break;
                }

                rowsRead++;
                batch.push(data);

                // PERFORMANCE FIX: Check backpressure before sending batch
                if (batch.length >= BATCH_SIZE) {
                  if (!(await waitForBackpressure())) {
                    isClosed = true;
                    break;
                  }

                  if (
                    !push({
                      type: "data",
                      data: batch,
                      rows_count: rowsRead,
                    })
                  ) {
                    isClosed = true;
                    break;
                  }
                  batch = [];

                  // PERFORMANCE FIX: Send progress less frequently
                  if (rowsRead % 5000 === 0) {
                    if (!push({ type: "progress", rows_read: rowsRead })) {
                      isClosed = true;
                      break;
                    }
                  }
                }
              }
            }
            if (limitReached || isClosed) break;
          }

          // Flush remaining items
          if (batch.length > 0 && !isClosed) {
            await waitForBackpressure();
            push({
              type: "data",
              data: batch,
              rows_count: rowsRead,
            });
          }

          if (!isClosed) {
            push({
              type: "done",
              limit_reached: limitReached,
              statistics: {
                elapsed: 0,
                rows_read: rowsRead,
                bytes_read: 0,
              },
            });
          }
        } catch (err) {
          if (!isClosed) {
            push({
              type: "error",
              error: formatQueryError(
                err instanceof Error ? err : String(err),
              ),
            });
          }
        } finally {
          isClosed = true;
          controller.close();
        }
      },

      // PERFORMANCE FIX: Handle client cancellation
      cancel(reason) {
        console.log("Query stream cancelled by client:", reason);
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
    // Format error using secure error handler
    const formattedError = formatQueryError(
      error instanceof Error ? error : String(error),
      500,
      true, // Log full details server-side
    );
    return NextResponse.json(
      { success: false, error: formattedError },
      { status: 500 },
    );
  }
}
