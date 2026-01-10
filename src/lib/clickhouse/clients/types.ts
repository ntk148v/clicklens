/**
 * Common types for ClickHouse clients (HTTP and Native)
 */

export { isClickHouseError } from "../types";
export type { ClickHouseError } from "../types";
export type { ClickHouseConfig } from "../config";

export interface ClickHouseStatistics {
  elapsed: number;
  rows_read: number;
  bytes_read: number;
  memory_usage?: number; // In bytes
}

export interface ClickHouseQueryResult<T = Record<string, unknown>> {
  data: T[];
  meta: Array<{ name: string; type: string }>;
  rows: number;
  rows_before_limit_at_least?: number;
  statistics: ClickHouseStatistics;
  query_id?: string;
}

export interface ClickHouseClient {
  /**
   * Execute a query and return results
   */
  query<T = Record<string, unknown>>(
    sql: string,
    options?: {
      timeout?: number;
      query_id?: string;
      clickhouse_settings?: Record<string, unknown>;
    }
  ): Promise<ClickHouseQueryResult<T>>;

  /**
   * Execute a command (DDL, INSERT, etc.) without expecting results
   */
  command(sql: string): Promise<void>;

  /**
   * Test connection with a simple query
   */
  ping(): Promise<boolean>;

  /**
   * Get ClickHouse version
   */
  version(): Promise<string>;

  /**
   * Kill a running query by ID
   */
  killQuery(queryId: string): Promise<void>;

  /**
   * Execute a query and return a streamable result set
   */
  queryStream(
    sql: string,
    options?: {
      timeout?: number;
      query_id?: string;
      format?: string;
      clickhouse_settings?: Record<string, unknown>;
    }
  ): Promise<unknown>; // returning unknown to avoid deep type dependencies for now, or use complex type

  explain(sql: string): Promise<string[]>;
}
