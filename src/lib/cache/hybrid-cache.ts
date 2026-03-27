/**
 * Hybrid Cache Implementation
 *
 * Provides Redis-backed caching with in-memory LRU fallback.
 * - Redis: Primary cache, shared across server instances
 * - In-memory LRU: Local fallback when Redis unavailable
 *
 * All operations are async for consistency.
 *
 * ## When to use HybridCache:
 *
 * Use HybridCache for **server-side metadata caching** where data should be:
 * - Shared across multiple server instances (via Redis)
 * - Long-lived (TTL: 30 seconds to 10 minutes)
 * - Accessible via async interface
 *
 * ## Typical use cases:
 * - Database/table/column metadata
 * - Monitoring and dashboard data
 * - Table explorer data (parts, mutations, merges)
 *
 * ## Pre-configured instances:
 * - `metadataCache` - For databases, tables, columns (500 entries, 30s/60s TTL)
 * - `monitoringCache` - For metrics and dashboards (100 entries, 10s/30s TTL)
 * - `tablesCache` - For table parts and mutations (200 entries, 5min/10min TTL)
 *
 * ## Example usage:
 * ```typescript
 * import { metadataCache, getOrSet } from "@/lib/cache";
 *
 * const databases = await getOrSet(
 *   metadataCache,
 *   "databases",
 *   async () => fetchDatabasesFromClickHouse()
 * );
 * ```
 *
 * @see {@link ./README.md} for detailed usage guidelines
 */

import { LRUCache } from "lru-cache";
import { getRedisClient, isRedisAvailable } from "./redis-client";

export interface HybridCacheOptions {
  max?: number; // Max in-memory entries
  ttl?: number; // In-memory TTL (ms)
  redisTTL?: number; // Redis TTL (seconds)
  name?: string; // Cache name for logging and key prefixing
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheValue = Record<string, any>;

/**
 * HybridCache provides Redis-backed caching with in-memory LRU fallback.
 *
 * **Architecture:**
 * - Redis is the primary cache (shared across server instances)
 * - In-memory LRU is the local fallback (when Redis is unavailable)
 *
 * **Key characteristics:**
 * - All operations are async
 * - Writes go to both memory and Redis
 * - Reads check memory first, then Redis
 * - Automatic fallback to memory if Redis fails
 *
 * @example
 * ```typescript
 * const cache = new HybridCache({
 *   name: "my-cache",
 *   max: 500,
 *   ttl: 30000,      // 30 seconds in memory
 *   redisTTL: 60     // 60 seconds in Redis
 * });
 *
 * await cache.set("key", { data: "value" });
 * const value = await cache.get("key");
 * ```
 */
export class HybridCache {
  private memoryCache: LRUCache<string, CacheValue>;
  private options: Required<HybridCacheOptions>;
  private name: string;

  constructor(options: HybridCacheOptions = {}) {
    this.options = {
      max: options.max ?? 500,
      ttl: options.ttl ?? 30000,
      redisTTL: options.redisTTL ?? 60,
      name: options.name ?? "hybrid-cache",
    };
    this.name = this.options.name;

    this.memoryCache = new LRUCache<string, CacheValue>({
      max: this.options.max,
      ttl: this.options.ttl,
      allowStale: true,
    });
  }

  /**
   * Get a value from cache.
   * Checks memory first, then Redis if available.
   */
  async get<T extends CacheValue>(key: string): Promise<T | undefined> {
    // 1. Check memory first (fastest)
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      return memoryValue as T;
    }

    // 2. Try Redis if available
    if (isRedisAvailable()) {
      try {
        const redis = await getRedisClient();
        const data = await redis.get(this.prefixedKey(key));

        if (data) {
          const parsed = JSON.parse(data) as T;
          // Populate memory cache for next time
          this.memoryCache.set(key, parsed as CacheValue);
          return parsed;
        }
      } catch (error) {
        console.warn(
          `[${this.name}] Redis get failed, using memory fallback:`,
          error,
        );
      }
    }

    return undefined;
  }

  /**
   * Set a value in cache.
   * Writes to both memory and Redis (if available).
   */
  async set<T extends CacheValue>(key: string, value: T, ttl?: number): Promise<void> {
    // Always set in memory
    this.memoryCache.set(key, value as CacheValue);

    // Try Redis if available
    if (isRedisAvailable()) {
      try {
        const redis = await getRedisClient();
        const serialized = JSON.stringify(value);
        const expiry = ttl ?? this.options.redisTTL;
        await redis.setEx(this.prefixedKey(key), expiry, serialized);
      } catch (error) {
        console.warn(
          `[${this.name}] Redis set failed, memory cache only:`,
          error,
        );
      }
    }
  }

  /**
   * Delete a value from cache.
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (isRedisAvailable()) {
      try {
        const redis = await getRedisClient();
        await redis.del(this.prefixedKey(key));
      } catch (error) {
        console.warn(`[${this.name}] Redis delete failed:`, error);
      }
    }
  }

  /**
   * Clear all values from cache.
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (isRedisAvailable()) {
      try {
        const redis = await getRedisClient();
        // Only clear keys with our prefix
        const keys = await redis.keys(`${this.name}:*`);
        if (keys.length > 0) {
          await redis.del(keys);
        }
      } catch (error) {
        console.warn(`[${this.name}] Redis clear failed:`, error);
      }
    }
  }

  /**
   * Get all keys from memory cache.
   * Note: Returns only memory keys for this instance.
   */
  keys(): string[] {
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Get the number of entries in memory cache.
   */
  get size(): number {
    return this.memoryCache.size;
  }

  /**
   * Check if a key exists in memory cache.
   */
  has(key: string): boolean {
    return this.memoryCache.has(key);
  }

  /**
   * Peek at a value without updating recency.
   */
  peek<T>(key: string): T | undefined {
    return this.memoryCache.peek(key) as T | undefined;
  }

  private prefixedKey(key: string): string {
    return `${this.name}:${key}`;
  }
}
