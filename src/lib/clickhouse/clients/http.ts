import {
  type ClickHouseConfig,
  buildClickHouseUrl,
  buildAuthHeaders,
} from "../config";
import {
  type ClickHouseClient,
  type ClickHouseQueryResult,
  type ClickHouseError,
} from "./types";

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
 * HTTP ClickHouse Client
 * Uses fetch API for communication
 */
export class HttpClient implements ClickHouseClient {
  private config: ClickHouseConfig;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ClickHouseConfig) {
    this.config = config;
    this.baseUrl = buildClickHouseUrl(config);
    this.headers = buildAuthHeaders(config);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    options?: { timeout?: number; query_id?: string }
  ): Promise<ClickHouseQueryResult<T>> {
    const params = new URLSearchParams({
      default_format: "JSON",
      max_execution_time: String(options?.timeout || 300),
    });

    if (options?.query_id) {
      params.append("query_id", options.query_id);
    }

    const response = await fetch(`${this.baseUrl}/?${params}`, {
      method: "POST",
      headers: {
        ...this.headers,
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

    // Create query result with statistics fallback
    return {
      data: result.data,
      meta: result.meta,
      rows: result.rows,
      statistics: {
        elapsed: result.statistics?.elapsed || 0,
        rows_read: result.statistics?.rows_read || 0,
        bytes_read: result.statistics?.bytes_read || 0,
      },
      // HTTP response usually includes query_id in X-ClickHouse-Query-Id header
      query_id:
        response.headers.get("X-ClickHouse-Query-Id") || options?.query_id,
    };
  }

  async command(sql: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/`, {
      method: "POST",
      headers: {
        ...this.headers,
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
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: "GET",
        headers: this.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async version(): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/?query=${encodeURIComponent("SELECT version()")}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get version");
    }

    return (await response.text()).trim();
  }

  async killQuery(queryId: string): Promise<void> {
    await this.command(`KILL QUERY WHERE query_id = '${queryId}' SYNC`);
  }

  async explain(sql: string): Promise<string[]> {
    const result = await this.query<{ explain: string }>(`EXPLAIN ${sql}`);
    return result.data.map((row) => row.explain);
  }
}
