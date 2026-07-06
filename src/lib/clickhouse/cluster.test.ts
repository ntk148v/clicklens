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
    delete process.env.CLICKHOUSE_CLUSTER;
    resetClusterCache();
  });

  it("filters out replicated database auto-clusters", async () => {
    const client = createClient((sql) => {
      if (sql.includes("empty(")) {
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
      "empty(database_replica_name)",
    );
  });

  it("keeps a real cluster when a replicated database has the same name", async () => {
    const client = createClient(() => queryResult([{ cluster: "default" }]));

    const clusterName = await getClusterName(client);
    const sql = String(
      (client.query as ReturnType<typeof mock>).mock.calls[0][0],
    );
    const normalizedSql = sql.replace(/\s+/g, " ");

    expect(clusterName).toBe("default");
    expect(normalizedSql).toContain(
      "empty(database_replica_name)",
    );
    expect(normalizedSql).not.toContain("system.databases");
  });

  it("falls back to local queries when no usable cluster is detected", async () => {
    const client = createClient(() => queryResult([]));

    await expect(getClusterName(client)).resolves.toBeUndefined();
  });

  it("uses CLICKHOUSE_CLUSTER when configured", async () => {
    process.env.CLICKHOUSE_CLUSTER = "default";
    const client = createClient(() => queryResult([{ cluster: "ignored" }]));

    await expect(getClusterName(client)).resolves.toBe("default");
    expect(client.query).not.toHaveBeenCalled();
  });

  it("ignores blank CLICKHOUSE_CLUSTER", async () => {
    process.env.CLICKHOUSE_CLUSTER = "   ";
    const client = createClient(() => queryResult([{ cluster: "ch_bronze_company" }]));

    const clusterName = await getClusterName(client);
    expect(clusterName).toBe("ch_bronze_company");
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
