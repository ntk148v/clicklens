/**
 * Stateless ClickHouse HTTP client
 * Uses provided config for each request (no global state)
 */

import {
  type ClickHouseConfig,
  buildClickHouseUrl,
  buildAuthHeaders,
} from "./config";
import { type ClickHouseError, isClickHouseError } from "./types";

// Re-export types for convenience
export { isClickHouseError } from "./types";
export type { ClickHouseError } from "./types";
export type { ClickHouseConfig } from "./config";

// Query result type
export interface ClickHouseQueryResult<T = Record<string, unknown>> {
  data: T[];
  meta: Array<{ name: string; type: string }>;
  rows: number;
  rows_before_limit_at_least?: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

/**
 * Parse ClickHouse error response
 */
function parseError(text: string): ClickHouseError {
  // ClickHouse error format: Code: N. DB::Exception: Message. (ERROR_CODE)
  const codeMatch = text.match(/Code:\s*(\d+)/);
  const typeMatch = text.match(/\(([A-Z_]+)\)\s*$/);

  return {
    code: codeMatch ? parseInt(codeMatch[1], 10) : 0,
    message: text,
    type: typeMatch ? typeMatch[1] : "UNKNOWN_ERROR",
  };
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: ClickHouseError): string {
  const errorMessages: Record<string, string> = {
    AUTHENTICATION_FAILED: "Invalid username or password",
    ACCESS_DENIED: "Access denied - insufficient permissions",
    UNKNOWN_USER: "Unknown user",
    NETWORK_ERROR: "Network error - cannot reach ClickHouse server",
    TIMEOUT_EXCEEDED: "Query timeout exceeded",
    MEMORY_LIMIT_EXCEEDED: "Memory limit exceeded - try a smaller query",
    SYNTAX_ERROR: "SQL syntax error",
    UNKNOWN_TABLE: "Table not found",
    UNKNOWN_DATABASE: "Database not found",
    UNKNOWN_COLUMN: "Column not found",
  };

  return errorMessages[error.type] || error.message;
}

/**
 * Create a ClickHouse client with the given configuration
 */
export function createClientWithConfig(config: ClickHouseConfig) {
  const baseUrl = buildClickHouseUrl(config);
  const headers = buildAuthHeaders(config);

  return {
    /**
     * Execute a query and return results
     */
    async query<T = Record<string, unknown>>(
      sql: string,
      options?: { timeout?: number }
    ): Promise<ClickHouseQueryResult<T>> {
      const params = new URLSearchParams({
        default_format: "JSON",
        max_execution_time: String(options?.timeout || 300),
      });

      const response = await fetch(`${baseUrl}/?${params}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "text/plain",
        },
        body: sql,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = parseError(errorText);
        throw {
          ...error,
          userMessage: getUserFriendlyMessage(error),
        };
      }

      const result = (await response.json()) as ClickHouseQueryResult<T>;
      return result;
    },

    /**
     * Execute a command (DDL, INSERT, etc.) without expecting results
     */
    async command(sql: string): Promise<void> {
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "text/plain",
        },
        body: sql,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = parseError(errorText);
        throw {
          ...error,
          userMessage: getUserFriendlyMessage(error),
        };
      }
    },

    /**
     * Test connection with a simple query
     */
    async ping(): Promise<boolean> {
      try {
        const response = await fetch(`${baseUrl}/ping`, {
          method: "GET",
          headers,
        });
        return response.ok;
      } catch {
        return false;
      }
    },

    /**
     * Get ClickHouse version
     */
    async version(): Promise<string> {
      const response = await fetch(
        `${baseUrl}/?query=${encodeURIComponent("SELECT version()")}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get version");
      }

      return (await response.text()).trim();
    },

    /**
     * Kill a running query by ID
     */
    async killQuery(queryId: string): Promise<void> {
      await this.command(`KILL QUERY WHERE query_id = '${queryId}' SYNC`);
    },

    /**
     * Explain a query
     */
    async explain(sql: string): Promise<string[]> {
      const result = await this.query<{ explain: string }>(`EXPLAIN ${sql}`);
      return result.data.map((row) => row.explain);
    },
  };
}

/**
 * Legacy function for backwards compatibility
 * Creates a client using environment variables
 */
export function createClient() {
  const host = process.env.CLICKHOUSE_HOST;

  if (!host) {
    throw new Error("CLICKHOUSE_HOST environment variable is not set");
  }

  return createClientWithConfig({
    host,
    port: parseInt(process.env.CLICKHOUSE_PORT || "8123", 10),
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
    database: process.env.CLICKHOUSE_DATABASE || "default",
    protocol: (process.env.CLICKHOUSE_PROTOCOL as "http" | "https") || "http",
  });
}
