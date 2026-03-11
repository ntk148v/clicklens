import { createClient } from "./client";
import {
  generateTimeWindowsDescending,
  shouldUseWindowing,
  type TimeWindow,
} from "./time-windows";
import type { DiscoverRow } from "@/lib/types/discover";

export interface FetchChunksParams {
  client: ReturnType<typeof createClient>;
  tableSource: string;
  whereConditions: string[];
  timeColumn?: string;
  minTime?: string;
  maxTime?: string;
  limit: number;
  cursor?: string;
  selectClause: string;
  orderByClause: string;
  safeTimeCol: string;
}

/**
 * Generator that yields NDJSON chunks (strings)
 * Supports time-based chunking for efficient deep pagination
 */
export async function* fetchChunks({
  client,
  tableSource,
  whereConditions: callerConditions,
  timeColumn,
  minTime,
  maxTime,
  limit,
  cursor,
  selectClause,
  orderByClause,
  safeTimeCol,
}: FetchChunksParams) {
  // Clone to avoid mutating the caller's array (e.g. on retry or parallel calls)
  const whereConditions = [...callerConditions];
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

  // Calculate Chunks using progressive time windowing
  const MaxTimeNum = maxTime ? new Date(maxTime).getTime() : Date.now();
  const MinTimeNum = minTime
    ? new Date(minTime).getTime()
    : Date.now() - 24 * 3600 * 1000;

  const startDate = new Date(MinTimeNum);
  const endDate = new Date(MaxTimeNum);

  let windows: TimeWindow[] = [];

  if (shouldUseWindowing(startDate, endDate)) {
    windows = generateTimeWindowsDescending(startDate, endDate);
  } else {
    // Single window for small time ranges
    windows = [
      {
        startTime: startDate,
        endTime: endDate,
        windowIndex: 0,
        direction: "DESC",
      },
    ];
  }

  if (cursor) {
    const cursorTimeNum = new Date(cursor).getTime();
    whereConditions.push(
      `${safeTimeCol} < toDateTime64(${cursorTimeNum / 1000}, 3)`,
    );
  }

  // Run count query in parallel with the first data chunk to avoid waterfall
  const countWhereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
  const countPromise = client
    .query(`SELECT count() as cnt FROM ${tableSource} ${countWhereClause}`)
    .then((res) => Number(res.data[0]?.cnt) || 0)
    .catch((e) => {
      console.error("Count query failed", e);
      return 0;
    });

  // Yield a preliminary meta (totalHits will be updated when count finishes)
  let countResolved = false;
  let totalHits = 0;
  countPromise.then((count) => {
    totalHits = count;
    countResolved = true;
  });

  yield JSON.stringify({ meta: { totalHits: -1 } }) + "\n";

  // Execute chunks in parallel (max 3 concurrent)
  const MAX_CONCURRENT_CHUNKS = 3;
  const chunkPromises: Promise<{ rows: DiscoverRow[]; windowIndex: number }>[] = [];

  for (let i = 0; i < windows.length && rowsFetched < limit; i++) {
    const window = windows[i];
    const currentLow = window.startTime.getTime();
    const currentHigh = window.endTime.getTime();

    const chunkWhere = [...whereConditions];

    // Chunk Time Range
    if (i === 0) {
      chunkWhere.push(
        `${safeTimeCol} <= toDateTime64(${currentHigh / 1000}, 3)`,
      );
    } else {
      chunkWhere.push(
        `${safeTimeCol} < toDateTime64(${currentHigh / 1000}, 3)`,
      );
    }
    chunkWhere.push(
      `${safeTimeCol} >= toDateTime64(${currentLow / 1000}, 3)`,
    );

    const chunkLimit = limit - rowsFetched;

    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      WHERE ${chunkWhere.join(" AND ")}
      ${orderByClause}
      LIMIT ${chunkLimit}
    `;

    const promise = client
      .query(query)
      .then((rs) => ({
        rows: rs.data as DiscoverRow[],
        windowIndex: i,
      }))
      .catch((e) => {
        console.error("Chunk query error", e);
        return { rows: [], windowIndex: i };
      });

    chunkPromises.push(promise);

    if (chunkPromises.length >= MAX_CONCURRENT_CHUNKS || i === windows.length - 1) {
      const results = await Promise.all(chunkPromises);

      for (const result of results) {
        for (const row of result.rows) {
          yield JSON.stringify(row) + "\n";
          rowsFetched++;
          if (rowsFetched >= limit) break;
        }
        if (rowsFetched >= limit) break;
      }

      chunkPromises.length = 0;
    }
  }

  // Emit resolved count as a trailing metadata update
  if (!countResolved) {
    totalHits = await countPromise;
  }
  yield JSON.stringify({ meta: { totalHits } }) + "\n";
}
