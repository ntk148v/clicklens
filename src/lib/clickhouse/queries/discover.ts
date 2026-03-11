/**
 * ClickHouse Discover/Explore SQL Queries
 *
 * Centralized queries for field-value faceting in the discover page.
 */

import { quoteIdentifier, escapeSqlString } from "../utils";
import type {
  QueryBuilderConfig,
  HistogramOptions,
  DataQueryOptions,
  CountQueryOptions,
  QueryBuilderResult,
} from "./types";

// =============================================================================
// Discover Query Builder
// =============================================================================

export class DiscoverQueryBuilder {
  private config: QueryBuilderConfig;

  constructor(config: QueryBuilderConfig) {
    this.config = config;
  }

  buildHistogramQuery(options: HistogramOptions = {}): string {
    const { minTime, maxTime, filter } = options;
    const { tableSource, timeColumn, timeColumnType } = this.config;

    if (!timeColumn) {
      return `SELECT '' as time, 0 as count`;
    }

    const quotedTimeCol = quoteIdentifier(timeColumn);
    const isDateOnly = timeColumnType === "Date" || timeColumnType === "Date32";

    const whereConds: string[] = [];
    if (minTime) {
      const minTimeNum = new Date(minTime).getTime();
      whereConds.push(
        `${quotedTimeCol} >= toDateTime64(${minTimeNum / 1000}, 3)`,
      );
    }
    if (maxTime) {
      const maxTimeNum = new Date(maxTime).getTime();
      whereConds.push(
        `${quotedTimeCol} <= toDateTime64(${maxTimeNum / 1000}, 3)`,
      );
    }
    if (filter) whereConds.push(`(${filter})`);

    const whereClause = whereConds.length
      ? `WHERE ${whereConds.join(" AND ")}`
      : "";

    if (isDateOnly) {
      return `SELECT ${quotedTimeCol} as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
    }

    const interval = options.interval || this.calculateInterval(minTime, maxTime);
    return `SELECT toStartOfInterval(${quotedTimeCol}, INTERVAL ${interval}) as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
  }

  buildDataQuery(options: DataQueryOptions): QueryBuilderResult {
    const {
      columns,
      filter,
      search,
      minTime,
      maxTime,
      limit,
      offset,
      orderBy,
      groupBy,
    } = options;
    const { tableSource, timeColumn } = this.config;

    const metadata = {
      hasGroupBy: !!groupBy,
      hasOrderBy: !!orderBy || !!timeColumn,
      hasTimeFilter: !!(minTime || maxTime),
      hasFilter: !!filter,
      hasSearch: !!search,
    };

    let selectClause = columns.length
      ? columns.map((c) => quoteIdentifier(c)).join(", ")
      : "*";

    let groupByClause = "";
    let groupCols: string[] = [];

    if (groupBy) {
      groupCols = groupBy
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      if (groupCols.length > 0) {
        const quotedGroupCols = groupCols.map((c) => quoteIdentifier(c));
        groupByClause = `GROUP BY ${quotedGroupCols.join(", ")}`;
        selectClause = `${quotedGroupCols.join(", ")}, count() as count`;
      }
    }

    let orderByClause = "";
    if (timeColumn && !orderBy) {
      orderByClause = `ORDER BY ${quoteIdentifier(timeColumn)} DESC`;
    }

    if (orderBy) {
      const validatedOrderBy = this.validateOrderBy(orderBy, groupCols);
      if (validatedOrderBy) {
        orderByClause = `ORDER BY ${validatedOrderBy}`;
      }
    }

    const whereConds: string[] = [];
    if (filter) whereConds.push(`(${filter})`);
    if (search) whereConds.push(`(${search})`);

    if (timeColumn && minTime) {
      const minTimeNum = new Date(minTime).getTime();
      whereConds.push(
        `${quoteIdentifier(timeColumn)} >= toDateTime64(${minTimeNum / 1000}, 3)`,
      );
    }
    if (timeColumn && maxTime) {
      const maxTimeNum = new Date(maxTime).getTime();
      whereConds.push(
        `${quoteIdentifier(timeColumn)} <= toDateTime64(${maxTimeNum / 1000}, 3)`,
      );
    }

    const whereClause = whereConds.length
      ? `WHERE ${whereConds.join(" AND ")}`
      : "";

    const query = `
      SELECT ${selectClause}
      FROM ${tableSource}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
      ${offset > 0 ? `OFFSET ${offset}` : ""}
    `.trim();

    return { query, metadata };
  }

  buildCountQuery(options: CountQueryOptions): string {
    const { filter, search, minTime, maxTime, groupBy } = options;
    const { tableSource, timeColumn } = this.config;

    const whereConds: string[] = [];
    if (filter) whereConds.push(`(${filter})`);
    if (search) whereConds.push(`(${search})`);

    if (timeColumn && minTime) {
      const minTimeNum = new Date(minTime).getTime();
      whereConds.push(
        `${quoteIdentifier(timeColumn)} >= toDateTime64(${minTimeNum / 1000}, 3)`,
      );
    }
    if (timeColumn && maxTime) {
      const maxTimeNum = new Date(maxTime).getTime();
      whereConds.push(
        `${quoteIdentifier(timeColumn)} <= toDateTime64(${maxTimeNum / 1000}, 3)`,
      );
    }

    const whereClause = whereConds.length
      ? `WHERE ${whereConds.join(" AND ")}`
      : "";

    if (groupBy) {
      const groupCols = groupBy
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const quotedGroupCols = groupCols.map((c) => quoteIdentifier(c));
      const groupByClause = `GROUP BY ${quotedGroupCols.join(", ")}`;

      return `SELECT count() as cnt FROM (SELECT 1 FROM ${tableSource} ${whereClause} ${groupByClause})`;
    }

    return `SELECT count() as cnt FROM ${tableSource} ${whereClause}`;
  }

  private calculateInterval(minTime?: string, maxTime?: string): string {
    if (!minTime) return "1 week";

    const diffMs =
      (maxTime ? new Date(maxTime).getTime() : Date.now()) -
      new Date(minTime).getTime();
    const diffHours = diffMs / 36e5;

    if (diffHours <= 1) return "1 minute";
    if (diffHours <= 6) return "5 minute";
    if (diffHours <= 24) return "15 minute";
    if (diffHours <= 72) return "1 hour";
    if (diffHours <= 24 * 7) return "4 hour";
    if (diffHours <= 24 * 30) return "1 day";
    if (diffHours <= 24 * 365) return "1 week";
    return "1 month";
  }

  private validateOrderBy(orderBy: string, groupCols: string[]): string | null {
    if (!groupCols.length) {
      const sorts = orderBy.split(",").map((s) => {
        const [col, dir] = s.split(":");
        return `${quoteIdentifier(col)} ${dir.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
      });
      return sorts.join(", ");
    }

    const aggregateFunctions = [
      "count",
      "sum",
      "avg",
      "min",
      "max",
      "any",
      "anyLast",
    ];

    const validSorts = orderBy.split(",").filter((sortStr) => {
      const [col] = sortStr.split(":");
      const colName = col.trim();

      if (groupCols.includes(colName)) return true;
      if (
        aggregateFunctions.some((agg) =>
          colName.toLowerCase().startsWith(agg + "("),
        )
      )
        return true;

      return false;
    });

    if (validSorts.length === 0) return null;

    const sorts = validSorts.map((s) => {
      const [col, dir] = s.split(":");
      return `${quoteIdentifier(col)} ${dir.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
    });
    return sorts.join(", ");
  }
}

// =============================================================================
// Field Values (Faceted Exploration)
// =============================================================================

/** Get top distinct values for a column, used by field sidebar */
export const getFieldValuesQuery = (
  tableSource: string,
  quotedCol: string,
  whereClause: string,
  limit: number,
) =>
  `SELECT ${quotedCol} AS value, count() AS count FROM ${tableSource} ${whereClause} GROUP BY value ORDER BY count DESC LIMIT ${limit}`;
