/**
 * Query Executor Service
 *
 * Handles query execution with pagination support.
 */

import { ClickHouseConfig, createClient } from "@/lib/clickhouse";
import { validateSqlStatement } from "@/lib/sql/validator";
import { getQueryCache } from "@/lib/cache/query-cache";

export interface QueryExecutorOptions {
  config: ClickHouseConfig;
  sql: string;
  database?: string;
  settings?: Record<string, unknown>;
  timeout?: number;
  page?: number;
  pageSize?: number;
  cache?: boolean;
  queryId?: string;
}

export interface QueryExecutorResult {
  sql: string;
  clickhouseSettings: Record<string, unknown>;
  timeout: number | undefined;
  queryId: string | undefined;
  cacheKey: string | null;
  useCache: boolean;
}

const MAX_ROWS = 500000;
const MAX_QUERY_TIMEOUT_MS = 300000;
const QUERY_ID_PREFIX = "clicklens-";

export function prepareQuery(options: QueryExecutorOptions): QueryExecutorResult {
  const {
    config,
    sql,
    database,
    settings = {},
    timeout,
    page,
    pageSize,
    cache = true,
    queryId,
  } = options;

  if (timeout && timeout > MAX_QUERY_TIMEOUT_MS) {
    throw new Error(`Timeout exceeds maximum allowed (${MAX_QUERY_TIMEOUT_MS}ms)`);
  }

  let querySql = sql;

  if (typeof page === "number") {
    const actualPageSize = pageSize ?? 1000;
    const offset = page * actualPageSize;
    const cleanSql = querySql.trim().replace(/;$/, "");

    const isPaginatedQuery =
      /^(?:\/\*[\s\S]*?\*\/|--.*?\n|\s)*(?:WITH|SELECT)\b/i.test(cleanSql);

    if (isPaginatedQuery) {
      querySql = `SELECT * FROM (${cleanSql}) LIMIT ${actualPageSize} OFFSET ${offset}`;
    }
  }

  const clickhouseSettings: Record<string, unknown> = {
    max_result_rows: MAX_ROWS + 1,
    result_overflow_mode: "break",
    date_time_output_format: "iso",
    ...settings,
  };

  if (database) {
    clickhouseSettings.database = database;
  }

  const actualTimeout = timeout
    ? Math.min(timeout, MAX_QUERY_TIMEOUT_MS)
    : undefined;

  const actualQueryId = queryId
    ? `${QUERY_ID_PREFIX}${config.username}-${queryId}`
    : undefined;

  let cacheKey: string | null = null;
  const useCache = cache && /^\s*SELECT\b/i.test(querySql);

  if (useCache) {
    const queryCache = getQueryCache();
    cacheKey = queryCache.generateSqlKey(querySql, database);
  }

  return {
    sql: querySql,
    clickhouseSettings,
    timeout: actualTimeout,
    queryId: actualQueryId,
    cacheKey,
    useCache,
  };
}

export function validateQuery(sql: string): { valid: boolean; reason?: string } {
  return validateSqlStatement(sql);
}

export interface CachedQueryData {
  data: unknown;
  timestamp: number;
}

export function getCachedQueryResult(
  cacheKey: string,
): CachedQueryData | null {
  const queryCache = getQueryCache();
  const result = queryCache.getCachedQuery(cacheKey);
  return result ?? null;
}
