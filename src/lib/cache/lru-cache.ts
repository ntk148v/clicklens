/**
 * In-Memory LRU Cache Implementation
 *
 * Standalone in-memory LRU cache with TTL support and hit/miss tracking.
 * This is a pure in-memory implementation without Redis integration.
 * (Redis integration is handled by HybridCache)
 */

import { LRUCache } from "lru-cache";

export interface LRUCacheOptions {
  /** Maximum number of entries (default: 500) */
  max?: number;
  /** TTL in milliseconds (default: 5 minutes = 300000ms) */
  ttl?: number;
  /** Cache name for logging */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheValue = Record<string, any>;

/**
 * In-memory LRU Cache with TTL and hit/miss tracking
 */
export class LRUCacheImpl {
  private cache: LRUCache<string, CacheValue>;
  private options: Required<LRUCacheOptions>;
  private name: string;
  private stats: {
    hits: number;
    misses: number;
  };

  constructor(options: LRUCacheOptions = {}) {
    this.options = {
      max: options.max ?? 500,
      ttl: options.ttl ?? 300_000, // 5 minutes default
      name: options.name ?? "lru-cache",
    };
    this.name = this.options.name;

    this.stats = {
      hits: 0,
      misses: 0,
    };

    this.cache = new LRUCache<string, CacheValue>({
      max: this.options.max,
      ttl: this.options.ttl,
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  /**
   * Get a value from cache
   * Returns undefined if key not found or expired
   */
  get<T extends CacheValue>(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value as T;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * Set a value in cache
   */
  set<T extends CacheValue>(key: string, value: T): void {
    this.cache.set(key, value as CacheValue);
  }

  /**
   * Check if a key exists in cache (without updating stats)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Peek at a value without updating recency
   */
  peek<T>(key: string): T | undefined {
    return this.cache.peek(key) as T | undefined;
  }
}

// Default cache instance with standard configuration
export const defaultLRUCache = new LRUCacheImpl({
  max: 500,
  ttl: 300_000, // 5 minutes
  name: "default",
});

/**
 * Create a new LRU cache instance with custom options
 */
export function createLRUCache(options: LRUCacheOptions): LRUCacheImpl {
  return new LRUCacheImpl(options);
}
