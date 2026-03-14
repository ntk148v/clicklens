/**
 * Hybrid Cache Layer
 *
 * Provides Redis-backed caching with in-memory LRU fallback.
 * - Redis: Primary cache, shared across server instances
 * - In-memory: Local fallback when Redis unavailable
 *
 * All caches use async interface for consistency.
 */

import { HybridCache } from "./hybrid-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheValue = Record<string, any>;

// ---------------------------------------------------------------------------
// Pre-configured hybrid caches
// ---------------------------------------------------------------------------

/** Cache for metadata routes (databases, tables, columns) */
export const metadataCache = new HybridCache({
  name: "metadata",
  max: 500,
  ttl: 30_000, // 30 seconds in-memory
  redisTTL: 60, // 60 seconds in Redis
});

/** Cache for monitoring/dashboard data */
export const monitoringCache = new HybridCache({
  name: "monitoring",
  max: 100,
  ttl: 10_000, // 10 seconds in-memory
  redisTTL: 30, // 30 seconds in Redis
});

/** Cache for tables explorer data (parts, mutations, merges, etc.) */
export const tablesCache = new HybridCache({
  name: "tables",
  max: 200,
  ttl: 300_000, // 5 minutes in-memory
  redisTTL: 600, // 10 minutes in Redis
});

// Type alias for backward compatibility
export type AppCache = HybridCache;

// ---------------------------------------------------------------------------
// getOrSet helper (updated for async)
// ---------------------------------------------------------------------------

/**
 * In-flight request map for deduplication.
 * Prevents multiple concurrent requests for the same cache key
 * from all hitting ClickHouse simultaneously (thundering herd protection).
 */
const inflightRequests = new Map<string, Promise<CacheValue>>();

/**
 * Cache-aside helper: return cached value if present, otherwise
 * invoke `fetcher`, store the result, and return it.
 *
 * Concurrent calls with the same key will share a single in-flight
 * request instead of duplicating work.
 */
export const getOrSet = async <T extends CacheValue>(
  cache: HybridCache,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> => {
  // 1. Check cache
  const cached = await cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  // 2. Check in-flight requests (dedup)
  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  // 3. Fetch, cache, cleanup
  const promise = fetcher()
    .then(async (result) => {
      await cache.set(key, result);
      return result;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, promise);
  return promise;
};

/**
 * Invalidate a specific cache key.
 */
export const invalidateCache = async (
  cache: HybridCache,
  key: string,
): Promise<void> => {
  await cache.delete(key);
};

/**
 * Clear all entries in a cache.
 */
export const clearCache = async (cache: HybridCache): Promise<void> => {
  await cache.clear();
};
