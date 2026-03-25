/**
 * ClickHouse Query Timeout Handling
 *
 * Provides utilities for managing query timeouts with:
 * - Configurable timeout limits (default 60s, max 300s)
 * - Graceful timeout error handling
 * - User-friendly error messages
 */

import type { ClickHouseClient } from "./clients/types";
import type { ClickHouseQueryResult } from "./clients/types";

// Timeout constants (in seconds)
export const TIMEOUT_DEFAULTS = {
  /** Default timeout for queries (60 seconds) */
  DEFAULT: 60,
  /** Maximum allowed timeout (300 seconds / 5 minutes) */
  MAX: 300,
  /** Minimum allowed timeout (1 second) */
  MIN: 1,
} as const;

/**
 * Timeout error class for better error handling
 */
export class QueryTimeoutError extends Error {
  public readonly timeoutSeconds: number;
  public readonly query: string;

  constructor(timeoutSeconds: number, query: string) {
    super(
      `Query timeout after ${timeoutSeconds} seconds. Consider optimizing your query or increasing the timeout.`,
    );
    this.name = "QueryTimeoutError";
    this.timeoutSeconds = timeoutSeconds;
    this.query = query;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QueryTimeoutError);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return `Query timed out after ${this.timeoutSeconds} seconds. The query took too long to execute. Try adding more specific filters or limiting the result set.`;
  }

  /**
   * Get hint for optimization
   */
  getHint(): string {
    return "Consider adding WHERE conditions, using LIMIT, or optimizing JOINs. For large datasets, consider using sampling or pre-aggregated tables.";
  }
}

/**
 * Clamp timeout value to allowed range
 *
 * @param timeout - Requested timeout in seconds
 * @returns Timeout clamped between MIN and MAX
 */
export function clampTimeout(timeout: number): number {
  return Math.max(TIMEOUT_DEFAULTS.MIN, Math.min(timeout, TIMEOUT_DEFAULTS.MAX));
}

/**
 * Validate timeout value
 *
 * @param timeout - Timeout to validate
 * @throws Error if timeout is invalid
 */
export function validateTimeout(timeout: number): void {
  if (typeof timeout !== "number" || !Number.isFinite(timeout)) {
    throw new Error("Timeout must be a finite number");
  }
  if (timeout < TIMEOUT_DEFAULTS.MIN) {
    throw new Error(
      `Timeout must be at least ${TIMEOUT_DEFAULTS.MIN} second`,
    );
  }
  if (timeout > TIMEOUT_DEFAULTS.MAX) {
    throw new Error(
      `Timeout cannot exceed ${TIMEOUT_DEFAULTS.MAX} seconds`,
    );
  }
}

/**
 * Check if an error is a timeout error
 *
 * @param error - Error to check
 * @returns True if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof QueryTimeoutError) {
    return true;
  }
  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();
    return (
      error.name === "AbortError" ||
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out") ||
      lowerMessage.includes("exceeded")
    );
  }
  return false;
}

/**
 * Format timeout error for user display
 *
 * @param error - Timeout error
 * @returns Formatted error object with user-friendly message
 */
export function formatTimeoutError(
  error: QueryTimeoutError,
): {
  message: string;
  userMessage: string;
  hint: string;
  code: number;
} {
  return {
    message: error.message,
    userMessage: error.getUserMessage(),
    hint: error.getHint(),
    code: 159, // ClickHouse TIMEOUT_EXCEEDED error code
  };
}

/**
 * Execute a query with timeout enforcement
 *
 * @param client - ClickHouse client instance
 * @param query - SQL query to execute
 * @param timeoutSeconds - Timeout in seconds (default: 60, max: 300)
 * @returns Query result
 * @throws QueryTimeoutError if timeout is exceeded
 * @throws Error if query fails for other reasons
 */
export async function queryWithTimeout<T = Record<string, unknown>>(
  client: ClickHouseClient,
  query: string,
  timeoutSeconds: number = TIMEOUT_DEFAULTS.DEFAULT,
): Promise<ClickHouseQueryResult<T>> {
  // Validate and clamp timeout
  validateTimeout(timeoutSeconds);
  const effectiveTimeout = clampTimeout(timeoutSeconds);

  const controller = new AbortController();
  const timeoutMs = effectiveTimeout * 1000;

  // Set up timeout abort
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Execute query with timeout settings
    const result = await client.query<T>(query, {
      timeout: timeoutMs,
      clickhouse_settings: {
        max_execution_time: effectiveTimeout,
      },
    });
    return result;
  } catch (error) {
    // Check if this is a timeout error
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("abort"))
    ) {
      throw new QueryTimeoutError(effectiveTimeout, query);
    }

    // Check for ClickHouse timeout error code
    if (error instanceof Error) {
      const errorCodeMatch = error.message.match(/Code:\s*(\d+)/i);
      if (errorCodeMatch && errorCodeMatch[1] === "159") {
        throw new QueryTimeoutError(effectiveTimeout, query);
      }
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create timeout configuration for ClickHouse client
 *
 * @param timeoutSeconds - Requested timeout in seconds
 * @returns ClickHouse settings object with timeout configured
 */
export function createTimeoutSettings(
  timeoutSeconds: number,
): {
  timeout: number;
  clickhouse_settings: {
    max_execution_time: number;
  };
} {
  const effectiveTimeout = clampTimeout(timeoutSeconds);
  return {
    timeout: effectiveTimeout * 1000,
    clickhouse_settings: {
      max_execution_time: effectiveTimeout,
    },
  };
}

/**
 * Get timeout as human-readable string
 *
 * @param seconds - Timeout in seconds
 * @returns Formatted string (e.g., "5 minutes", "30 seconds")
 */
export function formatTimeoutDisplay(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return minutes === 1 ? "1 minute" : `${minutes} minutes`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}
