/**
 * Discover Query Builder
 *
 * Builds ClickHouse SQL queries for the Discover feature.
 * Separates query construction logic from route handlers for better testability and reusability.
 */

import { quoteIdentifier, escapeSqlString } from "../utils";
import type {
  DiscoverQueryParams,
  TableMetadata,
  HistogramQueryResult,
  DataQueryResult,
} from "./types";

export class DiscoverQueryBuilder {
  private params: DiscoverQueryParams;
  private metadata: TableMetadata;

  constructor(params: DiscoverQueryParams, metadata: TableMetadata) {
    this.params = params;
    this.metadata = metadata;
  }

  /**
   * Build histogram query for time-series visualization
   */
  buildHistogramQuery(columnType: string = "DateTime"): HistogramQueryResult {
    const { timeColumn, minTime, maxTime, filter } = this.params;
    const { tableSource } = this.metadata;

    if (!timeColumn) {
      return {
        query: "",
        isDateOnly: false,
      };
    }

    const quotedTimeCol = quoteIdentifier(timeColumn);
    const isDateOnly = columnType === "Date" || columnType === "Date32";

    const whereConds: string[] = [];
    if (minTime) {
      const minTimeNum = new Date(minTime).getTime();
      whereConds.push(
        `${quotedTimeCol} >= toDateTime64(${minTimeNum / 1000}, 3)`
      );
    }
    if (maxTime) {
      const maxTimeNum = new Date(maxTime).getTime();
      whereConds.push(
        `${quotedTimeCol} <= toDateTime64(${maxTimeNum / 1000}, 3)`
      );
    }
    if (filter) {
      whereConds.push(`(${filter})`);
    }

    const whereClause = whereConds.length
      ? `WHERE ${whereConds.join(" AND ")}`
      : "";

    let query: string;

    if (isDateOnly) {
      query = `SELECT ${quotedTimeCol} as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
    } else {
      const interval = this.calculateHistogramInterval(minTime || undefined, maxTime || undefined);
      query = `SELECT toStartOfInterval(${quotedTimeCol}, INTERVAL ${interval}) as time, count() as count FROM ${tableSource} ${whereClause} GROUP BY time ORDER BY time`;
    }

    return {
      query,
      isDateOnly,
    };
  }

  /**
   * Calculate histogram interval based on time range
   * Targets roughly 30-100 buckets to prevent frontend freeze
   */
  private calculateHistogramInterval(
    minTime: string | undefined,
    maxTime: string | undefined
  ): string {
    let interval = "1 week";

    if (minTime) {
      const diffMs =
        (maxTime ? new Date(maxTime).getTime() : Date.now()) -
        new Date(minTime).getTime();
      const diffHours = diffMs / 36e5;

      if (diffHours <= 1) interval = "1 minute";
      else if (diffHours <= 6) interval = "5 minute";
      else if (diffHours <= 24) interval = "15 minute";
      else if (diffHours <= 72) interval = "1 hour";
      else if (diffHours <= 24 * 7) interval = "4 hour";
      else if (diffHours <= 24 * 30) interval = "1 day";
      else if (diffHours <= 24 * 365) interval = "1 week";
      else interval = "1 month";
    }

    return interval;
  }

  /**
   * Build data query for fetching rows
   */
  buildDataQuery(): DataQueryResult {
    const { columns, filter, limit, offset, orderBy, groupBy, timeColumn, minTime, maxTime } = this.params;
    const { tableSource } = this.metadata;

    const selectClause = columns && columns.length > 0
      ? columns.map((c) => quoteIdentifier(c)).join(", ")
      : "*";

    const baseWhere: string[] = [];

    if (filter && filter.trim()) {
      baseWhere.push(`(${filter})`);
    }

    const timeWhereConditions = this.buildTimeWhereConditions(timeColumn, minTime, maxTime);
    baseWhere.push(...timeWhereConditions);

    const whereClause = baseWhere.length > 0
      ? `WHERE ${baseWhere.join(" AND ")}`
      : "";

    const orderByClause = this.buildOrderByClause(orderBy, groupBy, timeColumn);
    const groupByClause = this.buildGroupByClause(groupBy, selectClause);

    const finalSelectClause = groupByClause && groupBy ? this.getGroupBySelectClause(groupBy) : selectClause;

    const query = `
      SELECT ${finalSelectClause}
      FROM ${tableSource}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
      ${offset > 0 ? `OFFSET ${offset}` : ""}
    `;

    const countQuery = this.buildCountQuery(whereClause, groupByClause);

    return {
      query: query.trim(),
      countQuery,
      selectClause: finalSelectClause,
      groupByClause,
      orderByClause,
      whereClause,
    };
  }

  /**
   * Build time-based WHERE conditions
   */
  private buildTimeWhereConditions(
    timeCol: string | undefined,
    minT: string | undefined,
    maxT: string | undefined
  ): string[] {
    const conds: string[] = [];

    if (timeCol && minT) {
      const minTimeNum = new Date(minT).getTime();
      conds.push(
        `${quoteIdentifier(timeCol)} >= toDateTime64(${minTimeNum / 1000}, 3)`
      );
    }

    if (timeCol && maxT) {
      const maxTimeNum = new Date(maxT).getTime();
      conds.push(
        `${quoteIdentifier(timeCol)} <= toDateTime64(${maxTimeNum / 1000}, 3)`
      );
    }

    return conds;
  }

  /**
   * Build ORDER BY clause with validation for GROUP BY queries
   */
  private buildOrderByClause(
    orderBy: string | undefined,
    groupBy: string | undefined,
    timeColumn: string | undefined
  ): string {
    const quotedTimeSortCol = timeColumn ? quoteIdentifier(timeColumn) : "";
    let orderByClause = "";

    if (!groupBy && quotedTimeSortCol) {
      orderByClause = `ORDER BY ${quotedTimeSortCol} DESC`;
    }

    if (orderBy) {
      const sorts = orderBy.split(",").map((s) => {
        const [col, dir] = s.split(":");
        return `${quoteIdentifier(col)} ${dir.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
      });

      if (groupBy) {
        const validSorts = this.validateOrderByForGroupBy(orderBy, groupBy);
        if (validSorts.length > 0) {
          const parsedValidSorts = validSorts.map((s) => {
            const [col, dir] = s.split(":");
            return `${quoteIdentifier(col)} ${dir.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
          });
          orderByClause = `ORDER BY ${parsedValidSorts.join(", ")}`;
        } else {
          orderByClause = "";
        }
      } else {
        orderByClause = `ORDER BY ${sorts.join(", ")}`;
      }
    }

    return orderByClause;
  }

  /**
   * Validate ORDER BY columns when GROUP BY is active
   * SQL only allows ORDER BY on columns in GROUP BY or aggregate functions
   */
  private validateOrderByForGroupBy(orderBy: string, groupBy: string): string[] {
    const groupCols = groupBy
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const aggregateFunctions = [
      "count",
      "sum",
      "avg",
      "min",
      "max",
      "any",
      "anyLast",
    ];

    return orderBy.split(",").filter((sortStr) => {
      const [col] = sortStr.split(":");
      const colName = col.trim();

      if (groupCols.includes(colName)) return true;

      if (
        aggregateFunctions.some((agg) =>
          colName.toLowerCase().startsWith(agg + "(")
        )
      )
        return true;

      return false;
    });
  }

  /**
   * Build GROUP BY clause
   */
  private buildGroupByClause(groupBy: string | undefined, selectClause: string): string {
    if (!groupBy) return "";

    const groupCols = groupBy
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    if (groupCols.length === 0) return "";

    const quotedGroupCols = groupCols.map((c) => quoteIdentifier(c));
    return `GROUP BY ${quotedGroupCols.join(", ")}`;
  }

  /**
   * Get SELECT clause for GROUP BY queries
   * When GROUP BY is active, only select the grouped columns + count()
   */
  private getGroupBySelectClause(groupBy: string): string {
    const groupCols = groupBy
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const quotedGroupCols = groupCols.map((c) => quoteIdentifier(c));
    return `${quotedGroupCols.join(", ")}, count() as count`;
  }

  /**
   * Build count query for pagination
   */
  private buildCountQuery(whereClause: string, groupByClause: string): string {
    const { tableSource } = this.metadata;

    let countQuery = `SELECT count() as cnt FROM ${tableSource}`;

    if (whereClause) {
      countQuery += ` ${whereClause}`;
    }

    if (groupByClause) {
      countQuery = `SELECT count() as cnt FROM (SELECT 1 FROM ${tableSource} ${whereClause} ${groupByClause})`;
    }

    return countQuery;
  }

  /**
   * Validate SQL filter for dangerous operations
   */
  static validateFilter(filter: string): { valid: boolean; error?: string } {
    const DANGEROUS_KEYWORDS =
      /\b(DROP|DELETE|ALTER|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|CREATE|ATTACH|DETACH|RENAME|KILL|SYSTEM)\b/i;
    const DANGEROUS_PATTERNS = /;\s*\S/;

    if (DANGEROUS_KEYWORDS.test(filter) || DANGEROUS_PATTERNS.test(filter)) {
      return {
        valid: false,
        error: "Invalid filter: contains disallowed keywords",
      };
    }

    return { valid: true };
  }

  /**
   * Build query to get distinct values for a column with counts
   * Used for faceted exploration in the field sidebar
   */
  static getFieldValuesQuery(
    tableSource: string,
    quotedColumn: string,
    whereClause: string,
    limit: number
  ): string {
    return `SELECT ${quotedColumn} as value, count() as count FROM ${tableSource} ${whereClause} GROUP BY value ORDER BY count DESC LIMIT ${limit}`;
  }
}

export function getFieldValuesQuery(
  tableSource: string,
  quotedColumn: string,
  whereClause: string,
  limit: number
): string {
  return DiscoverQueryBuilder.getFieldValuesQuery(tableSource, quotedColumn, whereClause, limit);
}