/**
 * ClickHouse HTTP client
 * Stateless client for executing queries via ClickHouse HTTP interface
 */

import {
  getClickHouseConfig,
  getClickHouseUrl,
  type ClickHouseConfig,
} from "./config";
import type {
  QueryResult,
  QueryOptions,
  ClickHouseError,
  ClickHouseErrorType,
  ColumnMeta,
} from "./types";

// Raw response from ClickHouse JSON format
interface ClickHouseRawResponse {
  meta: Array<{ name: string; type: string }>;
  data: unknown[];
  rows: number;
  rows_before_limit_at_least?: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

/**
 * Parse ClickHouse error code to determine error type
 */
function parseErrorType(code: number, message: string): ClickHouseErrorType {
  // ClickHouse error codes: https://clickhouse.com/docs/en/interfaces/cli#exit-codes
  if (
    code === 516 ||
    message.includes("ACCESS_DENIED") ||
    message.includes("Not enough privileges")
  ) {
    return "permission_denied";
  }
  if (code === 159 || code === 160 || message.includes("TIMEOUT")) {
    return "timeout";
  }
  if (code === 62 || code === 47 || message.includes("Syntax error")) {
    return "syntax";
  }
  if (
    code === 60 ||
    message.includes("UNKNOWN_TABLE") ||
    message.includes("UNKNOWN_DATABASE")
  ) {
    return "not_found";
  }
  if (code === 241 || message.includes("MEMORY_LIMIT_EXCEEDED")) {
    return "oom";
  }
  return "unknown";
}

/**
 * Parse error response from ClickHouse
 */
async function parseError(response: Response): Promise<ClickHouseError> {
  const text = await response.text();

  // ClickHouse returns errors in format: "Code: XXX. DB::Exception: message"
  const codeMatch = text.match(/Code:\s*(\d+)/);
  const code = codeMatch ? parseInt(codeMatch[1], 10) : 0;

  return {
    code,
    message: text,
    type: parseErrorType(code, text),
  };
}

/**
 * ClickHouse HTTP client class
 */
export class ClickHouseClient {
  private config: ClickHouseConfig;
  private baseUrl: string;

  constructor(config?: ClickHouseConfig) {
    this.config = config || getClickHouseConfig();
    this.baseUrl = getClickHouseUrl(this.config);
  }

  /**
   * Execute a query and return typed results
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const params = new URLSearchParams({
      database: options.database || this.config.database,
      default_format: "JSON",
    });

    // Add optional parameters
    if (options.max_execution_time) {
      params.set("max_execution_time", options.max_execution_time.toString());
    }
    if (options.max_rows_to_read) {
      params.set("max_rows_to_read", options.max_rows_to_read.toString());
    }
    if (options.max_bytes_to_read) {
      params.set("max_bytes_to_read", options.max_bytes_to_read.toString());
    }
    if (options.readonly) {
      params.set("readonly", "1");
    }

    const url = `${this.baseUrl}/?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-ClickHouse-User": this.config.username,
        "X-ClickHouse-Key": this.config.password,
      },
      body: sql,
    });

    if (!response.ok) {
      const error = await parseError(response);
      throw error;
    }

    const rawResult: ClickHouseRawResponse = await response.json();

    return {
      data: rawResult.data as T[],
      rows: rawResult.rows,
      rows_before_limit_at_least: rawResult.rows_before_limit_at_least,
      meta: rawResult.meta as ColumnMeta[],
      statistics: rawResult.statistics,
    };
  }

  /**
   * Execute a command (no result expected)
   */
  async command(sql: string, options: QueryOptions = {}): Promise<void> {
    const params = new URLSearchParams({
      database: options.database || this.config.database,
    });

    const url = `${this.baseUrl}/?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-ClickHouse-User": this.config.username,
        "X-ClickHouse-Key": this.config.password,
      },
      body: sql,
    });

    if (!response.ok) {
      const error = await parseError(response);
      throw error;
    }
  }

  /**
   * Test connection to ClickHouse
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: "GET",
        headers: {
          "X-ClickHouse-User": this.config.username,
          "X-ClickHouse-Key": this.config.password,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get server version
   */
  async version(): Promise<string> {
    const result = await this.query<{ version: string }>(
      "SELECT version() as version"
    );
    return result.data[0]?.version || "unknown";
  }

  /**
   * Kill a query by its query_id
   */
  async killQuery(queryId: string): Promise<void> {
    // Escape single quotes in queryId
    const escapedId = queryId.replace(/'/g, "''");
    await this.command(`KILL QUERY WHERE query_id = '${escapedId}'`);
  }

  /**
   * Get EXPLAIN output for a query
   */
  async explain(
    sql: string,
    options: {
      type?: "AST" | "SYNTAX" | "QUERY TREE" | "PLAN" | "PIPELINE";
    } = {}
  ): Promise<string[]> {
    const explainType = options.type || "PLAN";
    const result = await this.query<{ explain: string }>(
      `EXPLAIN ${explainType} ${sql}`
    );
    return result.data.map((row) => row.explain);
  }
}

/**
 * Create a new ClickHouse client instance
 * Uses environment configuration by default
 */
export function createClient(config?: ClickHouseConfig): ClickHouseClient {
  return new ClickHouseClient(config);
}

/**
 * Check if an error is a ClickHouse error
 */
export function isClickHouseError(error: unknown): error is ClickHouseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "type" in error
  );
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: ClickHouseError): string {
  switch (error.type) {
    case "permission_denied":
      return "Permission denied. Check your ClickHouse user permissions.";
    case "timeout":
      return "Query timed out. Try reducing the scope or adding LIMIT.";
    case "syntax":
      return "SQL syntax error. Check your query syntax.";
    case "not_found":
      return "Table or database not found.";
    case "oom":
      return "Memory limit exceeded. Try adding LIMIT or optimizing your query.";
    case "network":
      return "Network error. Check ClickHouse connection.";
    default:
      return error.message;
  }
}
