/**
 * Exact Count Query Utility
 *
 * Provides exact count() functionality with caching support.
 * Use exact count when:
 * - User explicitly requests exact count via query parameter
 * - Accuracy is required over performance
 * - Table size is manageable (< 1M rows)
 *
 * For approximate count (default), the streaming implementation uses
 * count() without caching - which is faster but may be slow on very large tables.
 */

import type { ClickHouseClient } from "./client";
import { LRUCacheImpl, createLRUCache, type LRUCacheOptions } from "../cache/lru-cache";
import { quoteIdentifier, escapeSqlString } from "./utils";

export interface ExactCountOptions {
  /** Database name */
  database: string;
  /** Table name */
  table: string;
  /** Optional WHERE conditions */
  whereConditions?: string[];
  /** Use clustered table source (for distributed tables) */
  clusterName?: string | null;
  /** Whether table is distributed (use clusterAllReplicas) */
  isDistributed?: boolean;
}

export interface CountResult {
  /** The exact count value */
  count: number;
  /** Whether this is an exact or approximate count */
  isExact: boolean;
  /** Cache hit indicator */
  cached?: boolean;
  /** Query execution time in ms */
  executionTime?: number;
}

/**
 * Cache for exact counts with configurable TTL
 * Default: 5 minutes TTL, max 500 entries
 */
let exactCountCache: LRUCacheImpl | null = null;

/**
 * Initialize or get the exact count cache
 */
function getExactCountCache(): LRUCacheImpl {
  if (!exactCountCache) {
    exactCountCache = createLRUCache({
      max: 500,
      ttl: 300_000, // 5 minutes
      name: "exact-count",
    });
  }
  return exactCountCache;
}

/**
 * Configure exact count cache with custom options
 */
export function configureExactCountCache(options: LRUCacheOptions): void {
  exactCountCache = createLRUCache({
    ...options,
    name: "exact-count",
  });
}

/**
 * Generate cache key for count query
 */
export function generateCacheKey(options: ExactCountOptions): string {
  const { database, table, whereConditions = [], clusterName, isDistributed } = options;
  const parts = [
    database,
    table,
    isDistributed ? "distributed" : "local",
    clusterName || "none",
    whereConditions.sort().join("|"),
  ];
  return parts.join(":");
}

/**
 * Build the table source reference
 * Handles both regular and distributed tables
 */
export function buildTableSource(options: ExactCountOptions): string {
  const { database, table, clusterName, isDistributed } = options;
  const quotedDb = quoteIdentifier(database);
  const quotedTable = quoteIdentifier(table);

  if (clusterName && !isDistributed) {
    return `clusterAllReplicas('${escapeSqlString(clusterName)}', ${quotedDb}.${quotedTable})`;
  }
  return `${quotedDb}.${quotedTable}`;
}

/**
 * Execute exact count query with optional caching
 *
 * Uses ClickHouse's count() function for exact counting.
 * Results are cached using LRU cache for performance.
 *
 * @param client - ClickHouse client instance
 * @param options - Count query options
 * @param useCache - Whether to use caching (default: true for exact counts)
 * @returns Promise resolving to CountResult
 *
 * @example
 * // Basic usage
 * const result = await executeExactCount(client, { database: 'mydb', table: 'logs' });
 *
 * // With WHERE conditions
 * const result = await executeExactCount(client, {
 *   database: 'mydb',
 *   table: 'logs',
 *   whereConditions: ['level = "error"'],
 *   clusterName: 'my-cluster',
 *   isDistributed: true
 * });
 *
 * // Bypass cache when needed
 * const result = await executeExactCount(client, options, false);
 */
export async function executeExactCount(
  client: ClickHouseClient,
  options: ExactCountOptions,
  useCache: boolean = true
): Promise<CountResult> {
  const startTime = Date.now();
  const { database, table, whereConditions = [] } = options;

  // Check cache first
  if (useCache) {
    const cache = getExactCountCache();
    const cacheKey = generateCacheKey(options);
    const cached = cache.get<{ count: number; timestamp: number }>(cacheKey);

    if (cached) {
      return {
        count: cached.count,
        isExact: true,
        cached: true,
        executionTime: Date.now() - startTime,
      };
    }
  }

  // Build table source
  const tableSource = buildTableSource(options);

  // Build WHERE clause
  const whereClause =
    whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

  // Execute exact count query
  const query = `SELECT count() as cnt FROM ${tableSource} ${whereClause}`;

  try {
    const result = await client.query(query);
    const count = Number(result.data[0]?.cnt) || 0;
    const executionTime = Date.now() - startTime;

    // Cache the result
    if (useCache) {
      const cache = getExactCountCache();
      const cacheKey = generateCacheKey(options);
      cache.set(cacheKey, { count, timestamp: Date.now() });
    }

    return {
      count,
      isExact: true,
      cached: false,
      executionTime,
    };
  } catch (error) {
    console.error("Exact count query failed:", error);
    throw error;
  }
}

/**
 * Clear exact count cache
 * Useful for testing or when data has changed significantly
 */
export function clearExactCountCache(): void {
  if (exactCountCache) {
    exactCountCache.clear();
  }
}

/**
 * Get cache statistics for exact counts
 */
export function getExactCountCacheStats() {
  const cache = getExactCountCache();
  return cache.getStats();
}

/**
 * Get current cache size
 */
export function getExactCountCacheSize(): number {
  const cache = getExactCountCache();
  return cache.size;
}

/**
 * Pre-warm cache with common queries
 * Useful for known heavy tables
 */
export async function preWarmExactCountCache(
  client: ClickHouseClient,
  queries: ExactCountOptions[]
): Promise<void> {
  await Promise.all(
    queries.map((options) => executeExactCount(client, options, true))
  );
}

/**
 * Approximate count using system.parts
 *
 * This provides a faster approximate count by summing rows from table parts.
 * Useful for very large tables where exact count is too slow.
 *
 * NOTE: This is less accurate than count() but much faster for large tables.
 * The count may be slightly off due to:
 * - Merge pending parts not yet counted
 * - Parts being deleted/m Arked for deletion
 *
 * @param client - ClickHouse client instance
 * @param options - Count query options
 * @returns Promise resolving to approximate CountResult
 */
export async function executeApproximateCount(
  client: ClickHouseClient,
  options: ExactCountOptions
): Promise<CountResult> {
  const startTime = Date.now();
  const { database, table, whereConditions = [] } = options;
  const safeDbStr = escapeSqlString(database);
  const safeTableStr = escapeSqlString(table);

  // Use system.parts for approximate count
  // Only count active (not deleted) parts
  const query = `
    SELECT sum(rows) as cnt
    FROM system.parts
    WHERE database = '${safeDbStr}'
      AND table = '${safeTableStr}'
      AND active = 1
  `;

  // Add WHERE conditions if specified
  // This is a simplified approach - for complex filters, exact count is better
  if (whereConditions.length > 0) {
    // For approximate, we can't easily apply custom WHERE conditions
    // Fall back to table-level approximation
    console.warn(
      "Approximate count does not support WHERE conditions precisely, using table-level count"
    );
  }

  try {
    const result = await client.query(query);
    const count = Number(result.data[0]?.cnt) || 0;
    const executionTime = Date.now() - startTime;

    return {
      count,
      isExact: false,
      cached: false,
      executionTime,
    };
  } catch (error) {
    console.error("Approximate count query failed:", error);
    throw error;
  }
}

/**
 * Decide whether to use exact or approximate count
 *
 * Guidelines:
 * - Small tables (< 100K rows): Use exact count (fast enough)
 * - Medium tables (100K - 10M rows): Exact count with caching
 * - Large tables (> 10M rows): Approximate count (faster but less accurate)
 *
 * @param estimatedRows - Optional row estimate
 * @param userRequestedExact - Whether user explicitly requested exact
 * @returns Whether to use exact count
 */
export function shouldUseExactCount(
  estimatedRows?: number,
  userRequestedExact?: boolean
): boolean {
  // User explicitly requested exact count
  if (userRequestedExact) {
    return true;
  }

  // No estimate available, default to exact (safer)
  if (estimatedRows === undefined) {
    return true;
  }

  // Small tables - exact count is fast enough
  if (estimatedRows < 100_000) {
    return true;
  }

  // Large tables - use approximate for performance
  return false;
}

/**
 * Document when to use exact vs approximate count
 */
export const COUNT_USAGE_GUIDE = {
  exact: {
    useWhen: [
      "User explicitly requests exact count via exact=true query param",
      "Table has < 100K rows (fast enough even without caching)",
      "Accuracy is critical (e.g., billing, reporting)",
      "Small to medium tables with caching enabled",
    ],
    advantages: ["100% accurate", "Works with WHERE conditions"],
    disadvantages: ["Slow on very large tables (> 10M rows)"],
  },
  approximate: {
    useWhen: [
      "Very large tables (> 10M rows) where exact count times out",
      "Quick estimate acceptable (e.g., dashboard quick view)",
      "Real-time UI doesn't need precise numbers",
    ],
    advantages: ["Very fast regardless of table size", "No blocking"],
    disadvantages: [
      "May be slightly inaccurate",
      "Doesn't support complex WHERE conditions precisely",
    ],
  },
} as const;
