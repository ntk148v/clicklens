/**
 * Query Cache Middleware
 *
 * Provides caching for ClickHouse query results with LRU backend.
 * Integrates with Discover API and SQL Console query routes.
 */

import { LRUCacheImpl, CacheStats } from "./lru-cache";
import { generateCacheKey, QueryParams } from "./key-generator";
import {
  RedisFallbackManager,
  getFallbackManager,
  createFallbackManager,
  CircuitBreakerState,
  type FallbackOptions,
  type FallbackStatus,
} from "./redis-fallback";

export interface QueryCacheOptions {
  /** Maximum number of cache entries (default: 500) */
  maxEntries?: number;
  /** TTL in milliseconds (default: 5 minutes = 300000ms) */
  ttl?: number;
  /** Cache name for logging */
  name?: string;
  /** Enable Redis fallback mechanism (default: true) */
  enableRedisFallback?: boolean;
  /** Redis fallback options */
  fallbackOptions?: FallbackOptions;
}

export interface CachedQueryResult<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, unknown>;
}

export interface CacheMetadata {
  cacheHit: boolean;
  cacheAge?: number;
  remainingTtl?: number;
}

/**
 * Query Cache class for managing query result caching
 */
export class QueryCache {
  private cache: LRUCacheImpl;
  private name: string;
  private fallbackManager: RedisFallbackManager | null = null;
  private enableRedisFallback: boolean;

  constructor(
    cache: LRUCacheImpl,
    name: string = "query-cache",
    enableRedisFallback: boolean = false
  ) {
    this.cache = cache;
    this.name = name;
    this.enableRedisFallback = enableRedisFallback;
  }

  /**
   * Initialize Redis fallback manager
   */
  initFallback(options: FallbackOptions = {}): void {
    if (this.enableRedisFallback && !this.fallbackManager) {
      this.fallbackManager = createFallbackManager(options);
    }
  }

  /**
   * Get fallback status
   */
  getFallbackStatus(): FallbackStatus | null {
    return this.fallbackManager?.getStatus() ?? null;
  }

  /**
   * Check if using fallback mode
   */
  isUsingFallback(): boolean {
    return this.fallbackManager?.getStatus()?.isUsingFallback ?? false;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState | null {
    const status = this.getFallbackStatus();
    return status?.circuitBreakerState ?? null;
  }

  /**
   * Get a cached query result
   */
  getCachedQuery<T>(key: string): CachedQueryResult<T> | undefined {
    try {
      const result = this.cache.get<CachedQueryResult<T>>(key);
      if (result) {
        return result;
      }
      return undefined;
    } catch (error) {
      console.error(`[${this.name}] Cache get error:`, error);
      return undefined;
    }
  }

  /**
   * Set a query result in cache
   */
  setCachedQuery<T>(
    key: string,
    data: T,
    metadata?: Record<string, unknown>
  ): void {
    try {
      const ttl = (this.cache as unknown as { options: { ttl: number } }).options.ttl;
      const cachedResult: CachedQueryResult<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        metadata,
      };
      this.cache.set(key, cachedResult);
    } catch (error) {
      console.error(`[${this.name}] Cache set error:`, error);
    }
  }

  /**
   * Invalidate a specific query from cache
   */
  invalidateQuery(key: string): boolean {
    try {
      return this.cache.delete(key);
    } catch (error) {
      console.error(`[${this.name}] Cache invalidation error:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  hasQuery(key: string): boolean {
    try {
      return this.cache.has(key);
    } catch (error) {
      console.error(`[${this.name}] Cache has error:`, error);
      return false;
    }
  }

  /**
   * Clear all cached queries
   */
  clear(): void {
    try {
      this.cache.clear();
    } catch (error) {
      console.error(`[${this.name}] Cache clear error:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { size: number } {
    return {
      ...this.cache.getStats(),
      size: this.cache.size,
    };
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get remaining TTL for a key
   */
  getRemainingTtl(key: string): number {
    try {
      const entry = this.cache.peek<CachedQueryResult>(key);
      if (!entry) return 0;
      const age = Date.now() - entry.timestamp;
      return Math.max(0, entry.ttl - age);
    } catch (error) {
      console.error(`[${this.name}] Get remaining TTL error:`, error);
      return 0;
    }
  }

  /**
   * Generate cache key for discover query
   */
  generateDiscoverKey(params: {
    database: string;
    table: string;
    filter?: string;
    timeRange?: { minTime?: string; maxTime?: string };
    columns?: string[];
    groupBy?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
    cursor?: string;
  }): string {
    const queryParams: QueryParams = {
      database: params.database,
      table: params.table,
      filter: params.filter,
      columns: params.columns,
      groupBy: params.groupBy,
      orderBy: params.orderBy,
      limit: params.limit,
      offset: params.offset,
      cursor: params.cursor,
    };

    // Add time range as object (will be hashed by key-generator)
    if (params.timeRange) {
      queryParams.minTime = params.timeRange.minTime;
      queryParams.maxTime = params.timeRange.maxTime;
    }

    return generateCacheKey("discover", queryParams);
  }

  /**
   * Generate cache key for SQL query
   */
  generateSqlKey(sql: string, database?: string): string {
    const queryParams: QueryParams = {
      database,
    };

    return generateCacheKey(`sql:${sql}`, queryParams);
  }
}

// Default cache instance
let defaultQueryCache: QueryCache | null = null;

/**
 * Create a new query cache instance
 */
export function createQueryCache(options: QueryCacheOptions = {}): QueryCache {
  const lruCache = new LRUCacheImpl({
    max: options.maxEntries ?? 500,
    ttl: options.ttl ?? 300_000,
    name: options.name ?? "query-cache",
  });

  const enableRedisFallback = options.enableRedisFallback ?? false;
  const cache = new QueryCache(lruCache, options.name ?? "query-cache", enableRedisFallback);

  if (enableRedisFallback && options.fallbackOptions) {
    cache.initFallback(options.fallbackOptions);
  }

  return cache;
}

/**
 * Get the default query cache instance (singleton)
 */
export function getQueryCache(): QueryCache {
  if (!defaultQueryCache) {
    defaultQueryCache = createQueryCache({
      maxEntries: 500,
      ttl: 300_000,
      name: "default-query-cache",
    });
  }
  return defaultQueryCache;
}

/**
 * Reset the default query cache (useful for testing)
 */
export function resetQueryCache(): void {
  if (defaultQueryCache) {
    defaultQueryCache.clear();
  }
  defaultQueryCache = null;
}

/**
 * Create a query cache with Redis fallback enabled
 */
export function createQueryCacheWithFallback(
  options: QueryCacheOptions = {}
): QueryCache {
  return createQueryCache({
    ...options,
    enableRedisFallback: true,
  });
}

/**
 * Helper function to wrap a query execution with caching
 *
 * @param cache - QueryCache instance
 * @param key - Cache key
 * @param queryFn - Function to execute query if cache miss
 * @param options - Additional options
 * @returns Promise<{ data: T; metadata: CacheMetadata }>
 */
export async function executeWithCache<T>(
  cache: QueryCache,
  key: string,
  queryFn: () => Promise<T>,
  options: {
    /** Whether to skip cache and always execute */
    bypassCache?: boolean;
    /** Custom metadata to store with cache entry */
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ data: T; metadata: CacheMetadata }> {
  // Check cache first (unless bypassed)
  if (!options.bypassCache) {
    const cached = cache.getCachedQuery<T>(key);
    if (cached) {
      const remainingTtl = cache.getRemainingTtl(key);
      return {
        data: cached.data,
        metadata: {
          cacheHit: true,
          cacheAge: Date.now() - cached.timestamp,
          remainingTtl,
        },
      };
    }
  }

  // Execute query
  const data = await queryFn();

  // Store in cache
  cache.setCachedQuery(key, data, options.metadata);

  return {
    data,
    metadata: {
      cacheHit: false,
      cacheAge: 0,
      remainingTtl: cache.getRemainingTtl(key),
    },
  };
}