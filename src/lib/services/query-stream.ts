/**
 * Query Streaming Utilities
 *
 * Handles NDJSON streaming with backpressure support.
 */

import { formatQueryError } from "@/lib/errors";

const MAX_ROWS = 500000;

export interface StreamConfig {
  maxRows?: number;
  batchSize?: number;
}

export function createQueryStream<T>(
  stream: AsyncIterable<T>,
  config: StreamConfig = {},
): ReadableStream {
  const {
    maxRows = MAX_ROWS,
    batchSize = 100,
  } = config;

  return new ReadableStream({
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
        let rowsRead = 0;
        let limitReached = false;
        let meta: { name: string; type: string }[] = [];
        let batch: T[] = [];

        for await (const chunk of stream) {
          if (isClosed) break;

          const items = Array.isArray(chunk) ? chunk : [chunk];

          for (const item of items) {
            if (isClosed) break;

            let data = item;
            if (
              data &&
              typeof data === "object" &&
              typeof (data as { text?: string }).text === "string"
            ) {
              try {
                data = JSON.parse((data as { text: string }).text);
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
              if (rowsRead >= maxRows) {
                limitReached = true;
                break;
              }

              rowsRead++;
              batch.push(data);

              if (batch.length >= batchSize) {
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
}
