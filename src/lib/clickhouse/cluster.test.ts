import { beforeEach, describe, expect, it, mock } from "bun:test";

import { getClusterName, resetClusterCache } from "./cluster";
import type { ClickHouseClient, ClickHouseQueryResult } from "./clients/types";

function queryResult<T>(data: T[]): ClickHouseQueryResult<T> {
  return {
    data,
    meta: [],
    rows: data.length,
    statistics: {
      elapsed: 0,
      rows_read: data.length,
      bytes_read: 0,
    },
  };
}

function createClient(
  query: (sql: string) => ClickHouseQueryResult<{ cluster: string }>,
): ClickHouseClient {
  return {
    query: mock(async (sql: string) => query(sql)),
    command: mock(async () => {}),
    ping: mock(async () => true),
    version: mock(async () => "26.2.4.23"),
    killQuery: mock(async () => {}),
    queryStream: mock(async () => ({})),
    explain: mock(async () => []),
  };
}

describe("getClusterName", () => {
  beforeEach(() => {
    resetClusterCache();
  });

  it("excludes replicated database names from cluster detection", async () => {
    const client = createClient((sql) => {
      if (
        sql.includes("system.databases") &&
        sql.includes("engine = 'Replicated'")
      ) {
        return queryResult([{ cluster: "real_cluster" }]);
      }

      return queryResult([{ cluster: "ch_bronze_company" }]);
    });

    const clusterName = await getClusterName(client);
    const sql = String(
      (client.query as ReturnType<typeof mock>).mock.calls[0][0],
    );
    const normalizedSql = sql.replace(/\s+/g, " ");

    expect(clusterName).toBe("real_cluster");
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(normalizedSql).toContain(
      "cluster NOT IN ( SELECT name FROM system.databases WHERE engine = 'Replicated' )",
    );
  });

  it("falls back to local queries when no usable cluster is detected", async () => {
    const client = createClient(() => queryResult([]));

    await expect(getClusterName(client)).resolves.toBeUndefined();
  });
});
