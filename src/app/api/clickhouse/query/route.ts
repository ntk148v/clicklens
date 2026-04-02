import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig, checkPermission } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";
import { formatQueryError } from "@/lib/errors";
import { validateSqlStatement } from "@/lib/sql/validator";
import { checkRateLimit } from "@/lib/cache/rate-limit";
import { getClientIdentifier } from "@/lib/auth/rate-limit";
import { requireCsrf } from "@/lib/auth/csrf";
import { getQueryCache } from "@/lib/cache/query-cache";
import { validateRequest, validationErrorResponse } from "@/lib/validation";
import { QueryRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const MAX_ROWS = 500000;
const MAX_QUERY_TIMEOUT_MS = 300000;
const QUERY_ID_PREFIX = "clicklens-";
const QUERY_RATE_LIMIT = process.env.RATE_LIMIT_QUERY ? parseInt(process.env.RATE_LIMIT_QUERY) : 120;
const QUERY_RATE_WINDOW_MS = 60000;
const BATCH_SIZE = parseInt(process.env.QUERY_BATCH_SIZE || "100", 10);

export async function POST(request: NextRequest) {
  try {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const clientId = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(`query:${clientId}`, {
      maxRequests: QUERY_RATE_LIMIT,
      windowMs: QUERY_RATE_WINDOW_MS,
    });
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

    const validation = await validateRequest(request, QueryRequestSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const reqBody = validation.data;

    const settings: Record<string, unknown> = {};
    if (reqBody.timezone) {
      settings.session_timezone = reqBody.timezone;
    }

    const client = createClient({ ...config, settings });

    const sqlValidation = validateSqlStatement(reqBody.sql);
    if (!sqlValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 403,
            message: sqlValidation.reason,
            type: "FORBIDDEN_STATEMENT",
            userMessage: sqlValidation.reason,
          },
        },
        { status: 403 },
      );
    }

    const queryCache = getQueryCache();
    const cacheEnabled = reqBody.cache !== false;

    let querySql = reqBody.sql;
    if (typeof reqBody.page === "number") {
      const pageSize = reqBody.pageSize ?? 1000;
      const offset = reqBody.page * pageSize;
      const cleanSql = querySql.trim().replace(/;$/, "");

      const isPaginatedQuery =
        /^(?:\/\*[\s\S]*?\*\/|--.*?\n|\s)*(?:WITH|SELECT)\b/i.test(cleanSql);

      if (isPaginatedQuery) {
        querySql = `SELECT * FROM (${cleanSql}) LIMIT ${pageSize} OFFSET ${offset}`;
      }
    }

    const clickhouseSettings: Record<string, unknown> = {
      max_result_rows: MAX_ROWS + 1,
      result_overflow_mode: "break",
      date_time_output_format: "iso",
    };

    if (reqBody.database) {
      clickhouseSettings.database = reqBody.database;
    }

    const timeout = reqBody.timeout
      ? Math.min(reqBody.timeout, MAX_QUERY_TIMEOUT_MS)
      : undefined;

    const queryId = reqBody.query_id
      ? `${QUERY_ID_PREFIX}${config.username}-${reqBody.query_id}`
      : undefined;

    if (cacheEnabled && /^\s*SELECT\b/i.test(querySql)) {
      const cacheKey = queryCache.generateSqlKey(querySql, reqBody.database);
      const cachedResult = queryCache.getCachedQuery(cacheKey);
      
      if (cachedResult) {
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

    const resultSet = await client.queryStream(querySql, {
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

    const customStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;

        const push = (data: unknown): boolean => {
          if (isClosed) return false;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
            return true;
          } catch {
            return false;
          }
        };

        const waitForBackpressure = async (): Promise<boolean> => {
          if (isClosed) return false;

          const startTime = Date.now();
          while (
            controller.desiredSize !== null &&
            controller.desiredSize <= 0
          ) {
            if (isClosed || Date.now() - startTime > 30000) {
              return false;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          return true;
        };

        try {
          let lineCount = 0;
          let colNames: string[] = [];
          let batch: unknown[] = [];

          for await (const chunk of stream) {
            if (isClosed) break;

            const items = Array.isArray(chunk) ? chunk : [chunk];

            for (const item of items) {
              if (isClosed) break;

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
                colNames = data as string[];
                lineCount++;
              } else if (lineCount === 1) {
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
    const formattedError = formatQueryError(
      error instanceof Error ? error : String(error),
      500,
      true,
    );
    return NextResponse.json(
      { success: false, error: formattedError },
      { status: 500 },
    );
  }
}
