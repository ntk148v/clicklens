/**
 * Cache Type Definitions
 *
 * Types for LRU cache, query cache, and hybrid cache implementations.
 */

export interface LRUCacheOptions {
  max?: number;
  ttl?: number;
  name?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

type CacheValue = Record<string, unknown>;

/**
 * Cache key structure
 */
export interface CacheKey {
  /** Full cache key string */
  key: string;
  /** Key components for debugging */
  components: string[];
  /** Hash of the key for comparison */
  hash: string;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntryWithMeta<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  size: number;
  hitCount: number;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  averageGetTime: number;
  averageSetTime: number;
}

/**
 * Cache configuration
 */
export interface CacheConfiguration {
  maxEntries: number;
  maxSizeBytes?: number;
  ttl: number;
  enableStats: boolean;
  enableCompression: boolean;
}

/**
 * Cache eviction policy
 */
export type EvictionPolicy = "lru" | "lfu" | "fifo" | "ttl";

/**
 * Cache backend type
 */
export type CacheBackend = "memory" | "redis" | "hybrid";

/**
 * Hybrid cache options
 */
export interface HybridCacheOptions {
  /** Local memory cache size */
  localMax: number;
  /** Local cache TTL in ms */
  localTTL: number;
  /** Redis cache TTL in seconds */
  redisTTL: number;
  /** Enable Redis fallback */
  enableRedis: boolean;
  /** Cache name for logging */
  name?: string;
}

/**
 * Cache invalidation options
 */
export interface CacheInvalidationOptions {
  /** Pattern for wildcard invalidation */
  pattern?: string;
  /** Specific keys to invalidate */
  keys?: string[];
  /** Invalidate all cache entries */
  invalidateAll?: boolean;
}

/**
 * Cache result
 */
export interface CacheResult<T> {
  value: T | null;
  hit: boolean;
  source: CacheBackend;
  latency: number;
}

/**
 * Query cache entry
 */
export interface QueryCacheEntry {
  query: string;
  database: string;
  result: unknown;
  timestamp: number;
  expiresAt: number;
  rowCount: number;
  sizeBytes: number;
}

/**
 * Query cache key generator options
 */
export interface CacheKeyOptions {
  query: string;
  database: string;
  parameters?: Record<string, unknown>;
  timeRange?: {
    start: number;
    end: number;
  };
  userId?: string;
}

/**
 * Cache warming strategy
 */
export interface CacheWarmingStrategy {
  enabled: boolean;
  queries: string[];
  intervalMs: number;
  priority: "high" | "normal" | "low";
}

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageLatency: number;
  evictionCount: number;
  memoryUsage: number;
  redisUsage?: number;
}

/**
 * Cache event types
 */
export type CacheEventType = "hit" | "miss" | "set" | "evict" | "clear" | "error";

/**
 * Cache event
 */
export interface CacheEvent<T = unknown> {
  type: CacheEventType;
  key: string;
  timestamp: number;
  value?: T;
  error?: Error;
}

/**
 * Cache event listener
 */
export type CacheEventListener<T = unknown> = (event: CacheEvent<T>) => void;

/**
 * Cache plugin for extensibility
 */
export interface CachePlugin<T = unknown> {
  name: string;
  onGet?: (key: string, result: CacheResult<T>) => void;
  onSet?: (key: string, value: T) => void;
  onEvict?: (key: string) => void;
  onError?: (error: Error) => void;
}
