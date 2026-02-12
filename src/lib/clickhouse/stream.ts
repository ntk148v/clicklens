import { createClient } from "./client";

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

  // Calculate Chunks
  // Start from maxTime (or now) down to minTime
  // Ensure valid times
  const MaxTimeNum = maxTime ? new Date(maxTime).getTime() : Date.now();
  const MinTimeNum = minTime
    ? new Date(minTime).getTime()
    : Date.now() - 24 * 3600 * 1000;

  const End = MaxTimeNum;
  const Start = MinTimeNum;

  const TotalDuration = End - Start;
  let ChunkSize = 6 * 60 * 60 * 1000; // 6 hours

  if (TotalDuration < ChunkSize && TotalDuration > 0) {
    ChunkSize = TotalDuration; // Single chunk
  }

  let currentHigh = End;
  let hasMoreChunks = true;

  if (cursor) {
    const cursorTimeNum = new Date(cursor).getTime();
    whereConditions.push(
      `\`${safeTimeCol}\` < toDateTime64(${cursorTimeNum / 1000}, 3)`,
    );
  }

  // First yield metadata
  let totalHits = 0;
  try {
    const countQuery = `SELECT count() as cnt FROM ${tableSource} ${
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""
    }`;
    const countRes = await client.query(countQuery);
    // wrapper returns { data: [...] } where data is array of objects
    // data[0] should be { cnt: ... }
    totalHits = Number(countRes.data[0]?.cnt) || 0;
  } catch (e) {
    console.error("Count query failed", e);
  }

  yield JSON.stringify({ meta: { totalHits } }) + "\n";

  while (hasMoreChunks && rowsFetched < limit) {
    const currentLow = Math.max(Start, currentHigh - ChunkSize);

    const chunkWhere = [...whereConditions];

    // Chunk Time Range
    // If we are at the very top (End), we include <= highIso IF it's the first chunk logic,
    // but typically we want < highIso for subsequent chunks.
    // However, our loop logic is: [low, high).
    // Let's stick to the existing logic:
    // If currentHigh == End (first iteration), use <= if no cursor?
    // Actually, if we have a cursor, we already added `safeTimeCol < cursor`.
    // The chunk logic is `safeTimeCol >= low` AND `safeTimeCol < high`.
    // Exception: If currentHigh is the absolute max requested, we might want <= ?
    // But typically usually logs are continuous.

    // Original Logic:
    if (currentHigh === End) {
      if (cursor) {
        // If cursor exists, we use < cursor explicitly handled before loop
        // But for the range top check in loop:
        chunkWhere.push(
          `\`${safeTimeCol}\` <= toDateTime64(${currentHigh / 1000}, 3)`,
        );
      } else {
        chunkWhere.push(
          `\`${safeTimeCol}\` <= toDateTime64(${currentHigh / 1000}, 3)`,
        );
      }
    } else {
      chunkWhere.push(
        `\`${safeTimeCol}\` < toDateTime64(${currentHigh / 1000}, 3)`,
      );
    }
    chunkWhere.push(
      `\`${safeTimeCol}\` >= toDateTime64(${currentLow / 1000}, 3)`,
    );

    const chunkLimit = limit - rowsFetched;

    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      WHERE ${chunkWhere.join(" AND ")}
      ${orderByClause}
      LIMIT ${chunkLimit}
    `;

    try {
      const rs = await client.query(query);
      const rows = rs.data;

      for (const row of rows) {
        yield JSON.stringify(row) + "\n";
        rowsFetched++;
        if (rowsFetched >= limit) break;
      }
    } catch (e) {
      console.error("Chunk query error", e);
      yield JSON.stringify({ error: String(e) }) + "\n";
      return;
    }

    if (currentLow <= Start) {
      hasMoreChunks = false;
    }
    currentHigh = currentLow;
  }
}
