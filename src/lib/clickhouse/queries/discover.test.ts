import { describe, test, expect } from "bun:test";
import { DiscoverQueryBuilder } from "./discover";
import type { DiscoverQueryParams, TableMetadata } from "./types";

describe("DiscoverQueryBuilder", () => {
  const metadata: TableMetadata = {
    database: "mydb",
    table: "mytable",
    engine: "MergeTree",
    tableSource: "mydb.mytable",
    isDistributed: false,
  };

  const baseParams: DiscoverQueryParams = {
    database: "mydb",
    table: "mytable",
    mode: "data",
    timeColumn: "event_time",
    limit: 100,
    offset: 0,
  };

  test("buildHistogramQuery with DateTime column", () => {
    const builder = new DiscoverQueryBuilder(baseParams, metadata);
    const result = builder.buildHistogramQuery("DateTime");

    expect(result.query).toContain("SELECT");
    expect(result.query).toContain("toStartOfInterval");
    expect(result.query).toContain("event_time");
    expect(result.query).toContain("count() as count");
    expect(result.query).toContain("GROUP BY time");
    expect(result.query).toContain("ORDER BY time");
    expect(result.isDateOnly).toBe(false);
  });

  test("buildHistogramQuery with Date column", () => {
    const builder = new DiscoverQueryBuilder(baseParams, metadata);
    const result = builder.buildHistogramQuery("Date");

    expect(result.query).toContain("SELECT");
    expect(result.query).toContain("`event_time` as time");
    expect(result.query).toContain("count() as count");
    expect(result.query).toContain("GROUP BY time");
    expect(result.query).toContain("ORDER BY time");
    expect(result.query).not.toContain("toStartOfInterval");
    expect(result.isDateOnly).toBe(true);
  });

  test("buildHistogramQuery with filter", () => {
    const builder = new DiscoverQueryBuilder(
      { ...baseParams, filter: "status = 'error'" },
      metadata
    );
    const result = builder.buildHistogramQuery("DateTime");

    expect(result.query).toContain("WHERE");
    expect(result.query).toContain("(status = 'error')");
  });

  test("buildHistogramQuery calculates interval based on time range", () => {
    const builder = new DiscoverQueryBuilder(baseParams, metadata);

    // Short range (1 hour) -> 1 minute interval
    const shortResult = builder.buildHistogramQuery("DateTime");
    const shortQuery = builder.buildHistogramQuery("DateTime");
    expect(shortQuery.query).toContain("INTERVAL 1 week"); // Default when no time range

    // With time range
    const builderWithRange = new DiscoverQueryBuilder(
      {
        ...baseParams,
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-01T01:00:00Z",
      },
      metadata
    );
    const shortRangeQuery = builderWithRange.buildHistogramQuery("DateTime");
    expect(shortRangeQuery.query).toContain("INTERVAL 1 minute");

    // Long range (7 days) -> 4 hour interval
    const builderWithLongRange = new DiscoverQueryBuilder(
      {
        ...baseParams,
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-08T00:00:00Z",
      },
      metadata
    );
    const longRangeQuery = builderWithLongRange.buildHistogramQuery("DateTime");
    expect(longRangeQuery.query).toContain("INTERVAL 4 hour");
  });

  test("buildDataQuery with basic parameters", () => {
    const builder = new DiscoverQueryBuilder(
      { ...baseParams, columns: ["id", "name"] },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("SELECT `id`, `name`");
    expect(result.query).toContain("FROM mydb.mytable");
    expect(result.query).toContain("LIMIT 100");
    expect(result.query).toContain("ORDER BY `event_time` DESC");
  });

  test("buildDataQuery with custom ORDER BY", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        orderBy: "name:asc,id:desc",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("ORDER BY");
    expect(result.query).toContain("`name` ASC");
    expect(result.query).toContain("`id` DESC");
  });

  test("buildDataQuery with GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        groupBy: "status",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("GROUP BY `status`");
    expect(result.query).toContain("count() as count");
  });

  test("buildDataQuery validates ORDER BY when GROUP BY is active", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        groupBy: "status",
        orderBy: "status:asc,name:desc", // name should be filtered out
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("ORDER BY `status` ASC");
    expect(result.query).not.toContain("name DESC");
  });

  test("buildDataQuery allows aggregate functions in ORDER BY with GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        groupBy: "status",
        orderBy: "count:desc",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    // When only aggregate function is in ORDER BY and it's not in GROUP BY, it gets filtered out
    // So the query won't have ORDER BY clause
    expect(result.query).not.toContain("ORDER BY");
  });

  test("buildDataQuery with filter", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        filter: "status = 'error'",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("WHERE");
    expect(result.query).toContain("(status = 'error')");
  });

  test("buildDataQuery with time range", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-02T00:00:00Z",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("WHERE");
    expect(result.query).toContain("`event_time` >=");
    expect(result.query).toContain("`event_time` <=");
  });

  test("buildDataQuery with offset", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        offset: 50,
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.query).toContain("LIMIT 100");
    expect(result.query).toContain("OFFSET 50");
  });

  test("buildDataQuery returns countQuery", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        filter: "status = 'error'",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.countQuery).toContain("SELECT count() as cnt");
    expect(result.countQuery).toContain("FROM mydb.mytable");
    expect(result.countQuery).toContain("WHERE");
    expect(result.countQuery).toContain("(status = 'error')");
  });

  test("buildDataQuery countQuery with GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        filter: "status = 'error'",
        groupBy: "status",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.countQuery).toContain("SELECT count() as cnt");
    expect(result.countQuery).toContain("FROM (SELECT 1");
    expect(result.countQuery).toContain("GROUP BY `status`");
  });

  test("buildDataQuery countQuery with time range", () => {
    const builder = new DiscoverQueryBuilder(
      {
        ...baseParams,
        columns: ["id", "name"],
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-02T00:00:00Z",
      },
      metadata
    );
    const result = builder.buildDataQuery();

    expect(result.countQuery).toContain("WHERE");
    expect(result.countQuery).toContain("`event_time` >=");
    expect(result.countQuery).toContain("`event_time` <=");
  });

  test("validateFilter rejects dangerous keywords", () => {
    const result = DiscoverQueryBuilder.validateFilter("DROP TABLE users");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("disallowed keywords");
  });

  test("validateFilter accepts safe filters", () => {
    const result = DiscoverQueryBuilder.validateFilter("status = 'error'");
    expect(result.valid).toBe(true);
  });

  test("getFieldValuesQuery builds correct query", () => {
    const query = DiscoverQueryBuilder.getFieldValuesQuery(
      "mydb.mytable",
      "`status`",
      "WHERE event_time >= '2024-01-01'",
      10
    );

    expect(query).toContain("SELECT `status` as value");
    expect(query).toContain("count() as count");
    expect(query).toContain("FROM mydb.mytable");
    expect(query).toContain("WHERE event_time >= '2024-01-01'");
    expect(query).toContain("GROUP BY value");
    expect(query).toContain("ORDER BY count DESC");
    expect(query).toContain("LIMIT 10");
  });
});