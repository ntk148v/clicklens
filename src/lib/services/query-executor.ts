/**
 * Query Executor Service
 *
 * Handles query execution with pagination support.
 */

import { ClickHouseConfig, createClient } from "@/lib/clickhouse";
import {
  isSelectStatement,
  paginate,
  parseSql,
  validateReadOnlySql,
} from "@/lib/sql/parser";
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
  clusterId?: string;
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

  const parsed = parseSql(sql)
  const statement =
    parsed.ok && parsed.statements.length === 1 ? parsed.statements[0] : null

  let querySql = sql
  if (statement && typeof page === "number") {
    querySql = paginate(statement, sql, page, pageSize ?? 1000)
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
  const useCache = cache && statement !== null && isSelectStatement(statement);

  if (useCache) {
    const queryCache = getQueryCache();
    cacheKey = queryCache.generateSqlKey(querySql, database, options.clusterId);
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
  const result = validateReadOnlySql(sql)
  return result.ok ? { valid: true } : { valid: false, reason: result.reason }
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
