import {
  createClient,
  type ClickHouseClient as OfficialClickHouseClient,
} from "@clickhouse/client";
import { type ClickHouseConfig, buildConnectionUrl } from "../config";
import { type ClickHouseClient, type ClickHouseQueryResult } from "./types";

/**
 * ClickHouse Client Implementation
 * Uses @clickhouse/client (HTTP interface) for communication
 */
export class ClickHouseClientImpl implements ClickHouseClient {
  private client: OfficialClickHouseClient;

  constructor(config: ClickHouseConfig) {
    this.client = createClient({
      url: buildConnectionUrl(config),
      username: config.username,
      password: config.password,
      database: config.database,
      request_timeout: 300_000, // Default 300s
      application: "ClickLens",
      // Note: @clickhouse/client automatically uses TLS when URL starts with https://
      // For self-signed certificates, set NODE_TLS_REJECT_UNAUTHORIZED=0 in env
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    options?: {
      timeout?: number;
      query_id?: string;
      clickhouse_settings?: Record<string, unknown>;
    }
  ): Promise<ClickHouseQueryResult<T>> {
    const resultSet = await this.client.query({
      query: sql,
      format: "JSON",
      query_id: options?.query_id,
      clickhouse_settings: {
        date_time_output_format: "iso",
        ...(options?.clickhouse_settings || {}),
        ...(options?.timeout
          ? { max_execution_time: options.timeout }
          : undefined),
      },
    });

    const result = await resultSet.json<{
      data: T[];
      meta: Array<{ name: string; type: string }>;
      rows: number;
      statistics: {
        elapsed: number;
        rows_read: number;
        bytes_read: number;
      };
    }>();

    return {
      data: (result.data as T[]) || [],
      meta: result.meta || [],
      rows: result.rows || 0,
      statistics: {
        elapsed: result.statistics?.elapsed || 0,
        rows_read: result.statistics?.rows_read || 0,
        bytes_read: result.statistics?.bytes_read || 0,
      },
      query_id: resultSet.query_id,
    };
  }

  async command(sql: string): Promise<void> {
    await this.client.command({
      query: sql,
    });
  }

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result.success;
  }

  async version(): Promise<string> {
    const result = await this.client.query({
      query: "SELECT version()",
      format: "JSON",
    });
    // The key in JSON is "version()"
    const json = await result.json<{ data: Record<string, string>[] }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (json as any).data as Record<string, string>[];
    return rows[0]["version()"];
  }

  async killQuery(queryId: string): Promise<void> {
    await this.client.command({
      query: `KILL QUERY WHERE query_id = '${queryId}' SYNC`,
    });
  }

  async explain(sql: string): Promise<string[]> {
    const result = await this.query<{ explain: string }>(`EXPLAIN ${sql}`);
    return result.data.map((row) => row.explain);
  }
  async queryStream(
    sql: string,
    options?: {
      timeout?: number;
      query_id?: string;
      format?: string;
      clickhouse_settings?: Record<string, unknown>;
    }
  ): Promise<unknown> {
    const settings: Record<string, unknown> = {
      ...(options?.clickhouse_settings || {}),
    };

    if (options?.timeout) {
      settings.max_execution_time = options.timeout;
    }

    return this.client.query({
      query: sql,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      format: (options?.format as any) || "JSON",
      query_id: options?.query_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clickhouse_settings: settings as any,
    });
  }
}
