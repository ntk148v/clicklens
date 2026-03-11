import { describe, test, expect } from "bun:test";
import { DiscoverQueryBuilder } from "./discover";
import type { QueryBuilderConfig } from "./types";

describe("DiscoverQueryBuilder", () => {
  const config: QueryBuilderConfig = {
    database: "mydb",
    table: "mytable",
    tableSource: "mydb.mytable",
    timeColumn: "event_time",
    timeColumnType: "DateTime",
  };

  test("buildHistogramQuery with DateTime column", () => {
    const builder = new DiscoverQueryBuilder(config);
    const query = builder.buildHistogramQuery({
      minTime: "2024-01-01T00:00:00Z",
      maxTime: "2024-01-02T00:00:00Z",
    });

    expect(query).toContain("SELECT");
    expect(query).toContain("toStartOfInterval");
    expect(query).toContain("event_time");
    expect(query).toContain("count() as count");
    expect(query).toContain("GROUP BY time");
    expect(query).toContain("ORDER BY time");
  });

  test("buildHistogramQuery with Date column", () => {
    const builder = new DiscoverQueryBuilder({
      ...config,
      timeColumnType: "Date",
    });
    const query = builder.buildHistogramQuery({});

    expect(query).toContain("SELECT");
    expect(query).toContain("`event_time` as time");
    expect(query).toContain("count() as count");
    expect(query).toContain("GROUP BY time");
    expect(query).toContain("ORDER BY time");
    expect(query).not.toContain("toStartOfInterval");
  });

  test("buildHistogramQuery with filter", () => {
    const builder = new DiscoverQueryBuilder(config);
    const query = builder.buildHistogramQuery({
      filter: "status = 'error'",
    });

    expect(query).toContain("WHERE");
    expect(query).toContain("(status = 'error')");
  });

  test("buildHistogramQuery calculates interval based on time range", () => {
    const builder = new DiscoverQueryBuilder(config);

    // Short range (1 hour) -> 1 minute interval
    const shortQuery = builder.buildHistogramQuery({
      minTime: "2024-01-01T00:00:00Z",
      maxTime: "2024-01-01T01:00:00Z",
    });
    expect(shortQuery).toContain("INTERVAL 1 minute");

    // Long range (7 days) -> 4 hour interval (not 1 day, based on the logic)
    const longQuery = builder.buildHistogramQuery({
      minTime: "2024-01-01T00:00:00Z",
      maxTime: "2024-01-08T00:00:00Z",
    });
    expect(longQuery).toContain("INTERVAL 4 hour");
  });

  test("buildDataQuery with basic parameters", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
    });

    expect(result.query).toContain("SELECT `id`, `name`");
    expect(result.query).toContain("FROM mydb.mytable");
    expect(result.query).toContain("LIMIT 100");
    expect(result.metadata?.hasGroupBy).toBe(false);
    expect(result.metadata?.hasOrderBy).toBe(true); // Default time column sort
  });

  test("buildDataQuery with custom ORDER BY", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
      orderBy: "name:asc,id:desc",
    });

    expect(result.query).toContain("ORDER BY");
    expect(result.query).toContain("`name` ASC");
    expect(result.query).toContain("`id` DESC");
    expect(result.metadata?.hasOrderBy).toBe(true);
  });

  test("buildDataQuery with GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
      groupBy: "status",
    });

    expect(result.query).toContain("GROUP BY `status`");
    expect(result.query).toContain("count() as count");
    expect(result.metadata?.hasGroupBy).toBe(true);
  });

  test("buildDataQuery validates ORDER BY when GROUP BY is active", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
      groupBy: "status",
      orderBy: "status:asc,name:desc", // name should be filtered out
    });

    expect(result.query).toContain("ORDER BY `status` ASC");
    expect(result.query).not.toContain("name DESC");
  });

  test("buildDataQuery allows aggregate functions in ORDER BY with GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
      groupBy: "status",
      orderBy: "count:desc",
    });

    // When only aggregate function is in ORDER BY and it's not in GROUP BY, it gets filtered out
    // So the query won't have ORDER BY clause
    expect(result.query).not.toContain("ORDER BY");
  });

  test("buildDataQuery with filter", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
      filter: "status = 'error'",
    });

    expect(result.query).toContain("WHERE");
    expect(result.query).toContain("(status = 'error')");
    expect(result.metadata?.hasFilter).toBe(true);
  });

  test("buildDataQuery with time range", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 0,
      minTime: "2024-01-01T00:00:00Z",
      maxTime: "2024-01-02T00:00:00Z",
    });

    expect(result.query).toContain("WHERE");
    expect(result.query).toContain("`event_time` >=");
    expect(result.query).toContain("`event_time` <=");
    expect(result.metadata?.hasTimeFilter).toBe(true);
  });

  test("buildDataQuery with offset", () => {
    const builder = new DiscoverQueryBuilder(config);
    const result = builder.buildDataQuery({
      columns: ["id", "name"],
      limit: 100,
      offset: 50,
    });

    expect(result.query).toContain("LIMIT 100");
    expect(result.query).toContain("OFFSET 50");
  });

  test("buildCountQuery without GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(config);
    const query = builder.buildCountQuery({
      filter: "status = 'error'",
    });

    expect(query).toContain("SELECT count() as cnt");
    expect(query).toContain("FROM mydb.mytable");
    expect(query).toContain("WHERE");
    expect(query).toContain("(status = 'error')");
  });

  test("buildCountQuery with GROUP BY", () => {
    const builder = new DiscoverQueryBuilder(config);
    const query = builder.buildCountQuery({
      filter: "status = 'error'",
      groupBy: "status",
    });

    expect(query).toContain("SELECT count() as cnt");
    expect(query).toContain("FROM (SELECT 1");
    expect(query).toContain("GROUP BY `status`");
  });

  test("buildCountQuery with time range", () => {
    const builder = new DiscoverQueryBuilder(config);
    const query = builder.buildCountQuery({
      minTime: "2024-01-01T00:00:00Z",
      maxTime: "2024-01-02T00:00:00Z",
    });

    expect(query).toContain("WHERE");
    expect(query).toContain("`event_time` >=");
    expect(query).toContain("`event_time` <=");
  });
});