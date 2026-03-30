import type { ClickHouseClient, ClickHouseQueryResult } from "../../src/lib/clickhouse/clients/types";

export interface MockClickHouseClientOptions {
  queryDelay?: number;
  shouldFail?: boolean;
  errorMessage?: string;
}

export function createMockClickHouseClient(
  options: MockClickHouseClientOptions = {}
): ClickHouseClient {
  const { queryDelay = 0, shouldFail = false, errorMessage = "Mock error" } = options;

  return {
    query: async <T = Record<string, unknown>>(
      _sql: string,
      _options?: { timeout?: number; query_id?: string }
    ): Promise<ClickHouseQueryResult<T>> => {
      if (shouldFail) {
        throw new Error(errorMessage);
      }
      if (queryDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, queryDelay));
      }
      return {
        data: [] as T[],
        meta: [],
        rows: 0,
        statistics: {
          elapsed: 0,
          rows_read: 0,
          bytes_read: 0,
        },
      };
    },
    command: async (_sql: string, _options?: { timeout?: number }): Promise<void> => {
      if (shouldFail) {
        throw new Error(errorMessage);
      }
      if (queryDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, queryDelay));
      }
    },
    ping: async () => true,
    version: async () => "1.0.0",
    killQuery: async (_queryId: string) => {},
    queryStream: async (_sql: string) => ({
      readable: {
        getReader() {
          return {
            read: async () => ({ done: true, value: undefined }),
            cancel: async () => {},
          };
        },
      },
    }),
    explain: async (_sql: string) => [],
  };
}

export function createMockQueryResult<T>(
  data: T[],
  meta: Array<{ name: string; type: string }> = []
): ClickHouseQueryResult<T> {
  return {
    data,
    meta,
    rows: data.length,
    statistics: {
      elapsed: 0.1,
      rows_read: data.length,
      bytes_read: 1024,
    },
  };
}