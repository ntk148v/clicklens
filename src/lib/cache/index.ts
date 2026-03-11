/**
 * Server-side in-memory cache using lru-cache
 *
 * Provides two pre-configured caches:
 * - metadataCache: for databases, tables, columns (30s TTL)
 * - monitoringCache: for monitoring dashboard data (10s TTL, 30s SWR)
 *
 * The `getOrSet` helper implements the cache-aside pattern with
 * in-flight request deduplication to avoid thundering herd.
 */

import { LRUCache } from "lru-cache";

// ---------------------------------------------------------------------------
// Type alias for our cache instances
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheValue = Record<string, any>;
type AppCache = LRUCache<string, CacheValue>;

// ---------------------------------------------------------------------------
// Pre-configured caches
// ---------------------------------------------------------------------------

/** Cache for metadata routes (databases, tables, columns) */
export const metadataCache: AppCache = new LRUCache<string, CacheValue>({
  max: 500,
  ttl: 30_000, // 30 seconds
});

/** Cache for monitoring/dashboard data */
export const monitoringCache: AppCache = new LRUCache<string, CacheValue>({
  max: 100,
  ttl: 10_000, // 10 seconds
  allowStale: true, // serve stale while revalidating
});

/** Cache for tables explorer data (parts, mutations, merges, etc.) */
export const tablesCache: AppCache = new LRUCache<string, CacheValue>({
  max: 200,
  ttl: 300_000, // 5 minutes
  allowStale: true, // serve stale while revalidating
});

// ---------------------------------------------------------------------------
// getOrSet helper
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
  cache: AppCache,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> => {
  // 1. Check cache
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached as T;
  }

  // 2. Check in-flight requests (dedup)
  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  // 3. Fetch, cache, cleanup
  const promise = fetcher()
    .then((result) => {
      cache.set(key, result);
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
export const invalidateCache = (cache: AppCache, key: string): void => {
  cache.delete(key);
};

/**
 * Clear all entries in a cache.
 */
export const clearCache = (cache: AppCache): void => {
  cache.clear();
};
