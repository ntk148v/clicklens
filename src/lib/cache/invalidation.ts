/**
 * Cache Invalidation Strategies
 *
 * Provides comprehensive cache invalidation capabilities:
 * - TTL-based: Automatic expiration based on time-to-live
 * - Manual: Explicit deletion of specific keys
 * - Event-based: Triggered by system events (data changes, schema updates)
 * - Partial: Invalidation of cache subsets by pattern/prefix
 *
 * Integrates with LRU cache, Redis cache, and Hybrid cache layers.
 */

import { LRUCacheImpl } from "./lru-cache";
import { RedisCache } from "./redis-cache";
import { HybridCache } from "./hybrid-cache";
import { matchesPattern, generateDatabasePrefix, generateTablePrefix } from "./key-generator";

// ============================================================================
// Types and Interfaces
// ============================================================================

export type CacheType = "lru" | "redis" | "hybrid";

export interface InvalidationOptions {
  /** Cache type for type-specific operations */
  cacheType?: CacheType;
  /** Enable logging of invalidation events */
  enableLogging?: boolean;
  /** Callback when invalidation occurs */
  onInvalidate?: (key: string, reason: InvalidationReason) => void;
}

export interface TTLInvalidationOptions extends InvalidationOptions {
  /** Default TTL in milliseconds for LRU, seconds for Redis */
  defaultTTL?: number;
  /** Extend TTL on access (sliding expiration) */
  slidingExpiration?: boolean;
}

export interface EventInvalidationOptions extends InvalidationOptions {
  /** Event types to listen for */
  eventTypes?: EventType[];
  /** Debounce time for batching events (ms) */
  debounceMs?: number;
}

export interface PartialInvalidationOptions extends InvalidationOptions {
  /** Match mode for pattern matching */
  matchMode?: "exact" | "prefix" | "pattern";
}

export type InvalidationReason =
  | "ttl-expired"
  | "manual"
  | "event-triggered"
  | "pattern-match"
  | "database-change"
  | "table-change"
  | "schema-update"
  | "bulk-clear";

export type EventType =
  | "database-created"
  | "database-dropped"
  | "table-created"
  | "table-dropped"
  | "table-altered"
  | "data-inserted"
  | "data-updated"
  | "data-deleted"
  | "schema-changed"
  | "cache-cleared";

export interface InvalidationEvent {
  type: EventType;
  database?: string;
  table?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface InvalidationResult {
  success: boolean;
  keysInvalidated: string[];
  keysNotFound: string[];
  errors: Array<{ key: string; error: Error }>;
}

export interface TTLStatus {
  key: string;
  expiresAt: number;
  remainingMs: number;
  isExpired: boolean;
}

// ============================================================================
// Cache Invalidator Class
// ============================================================================

export class CacheInvalidator {
  private cache: LRUCacheImpl | RedisCache | HybridCache;
  private options: Required<InvalidationOptions>;
  private eventListeners: Map<EventType, Set<(event: InvalidationEvent) => void>>;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  private pendingEvents: InvalidationEvent[];

  constructor(
    cache: LRUCacheImpl | RedisCache | HybridCache,
    options: InvalidationOptions = {}
  ) {
    this.cache = cache;
    this.options = {
      cacheType: options.cacheType ?? this.detectCacheType(cache),
      enableLogging: options.enableLogging ?? true,
      onInvalidate: options.onInvalidate ?? (() => {}),
    };
    this.eventListeners = new Map();
    this.debounceTimers = new Map();
    this.pendingEvents = [];
  }

  // --------------------------------------------------------------------------
  // TTL-Based Invalidation
  // --------------------------------------------------------------------------

  /**
   * Set a key with TTL (Time-To-Live).
   * Automatically expires after the specified time.
   */
  async setWithTTL<T>(
    key: string,
    value: T,
    ttlMs: number
  ): Promise<boolean> {
    try {
      if (this.isHybridCache(this.cache)) {
        // HybridCache expects TTL in seconds for Redis
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        await this.cache.set(key, value as Record<string, unknown>, ttlSeconds);
      } else if (this.isRedisCache(this.cache)) {
        // RedisCache expects TTL in seconds
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        await this.cache.set(key, value, ttlSeconds);
      } else {
        // LRUCache uses TTL from constructor, we can't set per-key TTL
        // Store TTL metadata alongside value
        const entry = {
          value,
          expiresAt: Date.now() + ttlMs,
        };
        this.cache.set(key, entry as Record<string, unknown>);
      }

      this.log("debug", `Set key "${key}" with TTL ${ttlMs}ms`);
      return true;
    } catch (error) {
      this.log("error", `Failed to set key "${key}" with TTL:`, error);
      return false;
    }
  }

  /**
   * Get a value with TTL check.
   * Returns undefined if the key has expired.
   */
  async getWithTTL<T>(key: string): Promise<T | undefined> {
    try {
      if (this.isHybridCache(this.cache) || this.isRedisCache(this.cache)) {
        return await this.getFromCache<T>(key);
      } else {
        const entry = this.cache.get<{
          value: T;
          expiresAt: number;
        }>(key);

        if (!entry) {
          return undefined;
        }

        // Check if expired (manual TTL check for LRU)
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          this.cache.delete(key);
          this.options.onInvalidate(key, "ttl-expired");
          this.log("debug", `Key "${key}" expired (TTL)`);
          return undefined;
        }

        return entry.value;
      }
    } catch (error) {
      this.log("error", `Failed to get key "${key}":`, error);
      return undefined;
    }
  }

  /**
   * Get TTL status for a key.
   * Returns remaining time and expiration status.
   */
  async getTTLStatus(key: string): Promise<TTLStatus | undefined> {
    try {
      if (this.isRedisCache(this.cache)) {
        const ttlSeconds = await this.cache.getTTL(key);
        if (ttlSeconds < 0) {
          return undefined;
        }
        const remainingMs = ttlSeconds * 1000;
        return {
          key,
          expiresAt: Date.now() + remainingMs,
          remainingMs,
          isExpired: false,
        };
      } else if (this.isHybridCache(this.cache)) {
        // HybridCache doesn't expose TTL directly, check if key exists
        const exists = this.cache.has(key);
        if (!exists) {
          return undefined;
        }
        // Return unknown TTL for hybrid cache
        return {
          key,
          expiresAt: -1,
          remainingMs: -1,
          isExpired: false,
        };
      } else {
        // LRUCache with manual TTL
        const entry = this.cache.peek<{ expiresAt: number }>(key);
        if (!entry || !entry.expiresAt) {
          return undefined;
        }
        const remainingMs = entry.expiresAt - Date.now();
        return {
          key,
          expiresAt: entry.expiresAt,
          remainingMs: Math.max(0, remainingMs),
          isExpired: remainingMs <= 0,
        };
      }
    } catch (error) {
      this.log("error", `Failed to get TTL for key "${key}":`, error);
      return undefined;
    }
  }

  /**
   * Extend TTL for an existing key (sliding expiration).
   */
  async extendTTL(key: string, additionalMs: number): Promise<boolean> {
    try {
      if (this.isRedisCache(this.cache)) {
        const additionalSeconds = Math.ceil(additionalMs / 1000);
        return await this.cache.expire(key, additionalSeconds);
      } else if (this.isHybridCache(this.cache)) {
        // HybridCache doesn't support TTL extension directly
        // Get value and re-set with new TTL
        const value = await this.cache.get(key);
        if (value === undefined) {
          return false;
        }
        const ttlSeconds = Math.ceil(additionalMs / 1000);
        await this.cache.set(key, value, ttlSeconds);
        return true;
      } else {
        // LRUCache - update expiresAt
        const entry = this.cache.get<{ value: unknown; expiresAt: number }>(key);
        if (!entry) {
          return false;
        }
        entry.expiresAt = Date.now() + additionalMs;
        this.cache.set(key, entry as Record<string, unknown>);
        return true;
      }
    } catch (error) {
      this.log("error", `Failed to extend TTL for key "${key}":`, error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Manual Invalidation
  // --------------------------------------------------------------------------

  /**
   * Manually invalidate a specific key.
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      let deleted = false;

      if (this.isHybridCache(this.cache) || this.isRedisCache(this.cache)) {
        await this.cache.delete(key);
        deleted = true;
      } else {
        deleted = this.cache.delete(key);
      }

      if (deleted) {
        this.options.onInvalidate(key, "manual");
        this.log("debug", `Manually invalidated key "${key}"`);
      }

      return deleted;
    } catch (error) {
      this.log("error", `Failed to invalidate key "${key}":`, error);
      return false;
    }
  }

  /**
   * Manually invalidate multiple keys.
   */
  async invalidateMany(keys: string[]): Promise<InvalidationResult> {
    const result: InvalidationResult = {
      success: true,
      keysInvalidated: [],
      keysNotFound: [],
      errors: [],
    };

    for (const key of keys) {
      try {
        let deleted = false;

        if (this.isHybridCache(this.cache) || this.isRedisCache(this.cache)) {
          await this.cache.delete(key);
          deleted = true;
        } else {
          deleted = this.cache.delete(key);
        }

        if (deleted) {
          result.keysInvalidated.push(key);
          this.options.onInvalidate(key, "manual");
        } else {
          result.keysNotFound.push(key);
        }
      } catch (error) {
        result.errors.push({
          key,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    result.success = result.errors.length === 0;

    this.log(
      "debug",
      `Invalidated ${result.keysInvalidated.length} keys, ${result.keysNotFound.length} not found, ${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Clear all entries from cache.
   */
  async clearAll(): Promise<boolean> {
    try {
      if (this.isHybridCache(this.cache) || this.isRedisCache(this.cache)) {
        await this.cache.clear();
      } else {
        this.cache.clear();
      }

      this.options.onInvalidate("*", "bulk-clear");
      this.log("info", "Cleared all cache entries");
      return true;
    } catch (error) {
      this.log("error", "Failed to clear cache:", error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Event-Based Invalidation
  // --------------------------------------------------------------------------

  /**
   * Register an event listener for cache invalidation events.
   */
  onEvent(
    eventType: EventType,
    handler: (event: InvalidationEvent) => void
  ): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    const listeners = this.eventListeners.get(eventType)!;
    listeners.add(handler);

    // Return unsubscribe function
    return () => {
      listeners.delete(handler);
    };
  }

  /**
   * Emit an invalidation event.
   * Triggers registered handlers and performs automatic invalidation.
   */
  async emitEvent(event: InvalidationEvent): Promise<void> {
    this.log("debug", `Emitting event: ${event.type}`, event);

    // Add to pending events for debouncing
    this.pendingEvents.push(event);

    // Notify listeners
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.log("error", `Event handler error for ${event.type}:`, error);
        }
      });
    }

    // Perform automatic invalidation based on event type
    await this.handleAutomaticInvalidation(event);
  }

  /**
   * Emit an event with debouncing.
   * Batches multiple events of the same type within the debounce window.
   */
  emitEventDebounced(
    event: InvalidationEvent,
    debounceMs: number = 100
  ): void {
    const key = `${event.type}:${event.database || "*"}:${event.table || "*"}`;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Add to pending events
    this.pendingEvents.push(event);

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);

      // Process all pending events of this type
      const eventsToProcess = this.pendingEvents.filter(
        (e) =>
          e.type === event.type &&
          e.database === event.database &&
          e.table === event.table
      );

      // Remove processed events
      this.pendingEvents = this.pendingEvents.filter(
        (e) => !eventsToProcess.includes(e)
      );

      // Emit consolidated event
      if (eventsToProcess.length > 0) {
        const consolidatedEvent: InvalidationEvent = {
          ...eventsToProcess[eventsToProcess.length - 1],
          metadata: {
            batchSize: eventsToProcess.length,
            firstTimestamp: eventsToProcess[0].timestamp,
          },
        };
        await this.emitEvent(consolidatedEvent);
      }
    }, debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Handle automatic invalidation based on event type.
   */
  private async handleAutomaticInvalidation(
    event: InvalidationEvent
  ): Promise<void> {
    switch (event.type) {
      case "database-dropped":
        if (event.database) {
          await this.invalidateByDatabase(event.database);
        }
        break;

      case "table-dropped":
      case "table-altered":
        if (event.database && event.table) {
          await this.invalidateByTable(event.database, event.table);
        }
        break;

      case "data-inserted":
      case "data-updated":
      case "data-deleted":
        if (event.database && event.table) {
          // Invalidate table-specific cache entries on data changes
          await this.invalidateByTable(event.database, event.table);
        }
        break;

      case "schema-changed":
        // Clear all schema-related cache
        await this.invalidateByPattern("*schema*");
        break;

      case "cache-cleared":
        await this.clearAll();
        break;

      default:
        // No automatic invalidation for other event types
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Partial Invalidation
  // --------------------------------------------------------------------------

  /**
   * Invalidate cache entries by pattern.
   * Supports wildcards: * matches any sequence, ? matches single character.
   */
  async invalidateByPattern(pattern: string): Promise<InvalidationResult> {
    const result: InvalidationResult = {
      success: true,
      keysInvalidated: [],
      keysNotFound: [],
      errors: [],
    };

    try {
      // Get all keys from cache
      let keys: string[] = [];

      if (this.isHybridCache(this.cache)) {
        keys = this.cache.keys();
      } else if (this.isRedisCache(this.cache)) {
        keys = await this.cache.keys();
      } else {
        keys = this.cache.keys();
      }

      // Find matching keys
      const matchingKeys = keys.filter((key) => matchesPattern(key, pattern));

      // Invalidate matching keys
      for (const key of matchingKeys) {
        try {
          let deleted = false;

          if (this.isHybridCache(this.cache) || this.isRedisCache(this.cache)) {
            await this.cache.delete(key);
            deleted = true;
          } else {
            deleted = this.cache.delete(key);
          }

          if (deleted) {
            result.keysInvalidated.push(key);
            this.options.onInvalidate(key, "pattern-match");
          }
        } catch (error) {
          result.errors.push({
            key,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      result.success = result.errors.length === 0;

      this.log(
        "info",
        `Invalidated ${result.keysInvalidated.length} keys matching pattern "${pattern}"`
      );
    } catch (error) {
      result.success = false;
      this.log("error", `Failed to invalidate by pattern "${pattern}":`, error);
    }

    return result;
  }

  /**
   * Invalidate all cache entries for a specific database.
   */
  async invalidateByDatabase(database: string): Promise<InvalidationResult> {
    const prefix = generateDatabasePrefix(database);
    const result = await this.invalidateByPatternWithReason(prefix, "database-change");

    this.log("info", `Invalidated cache for database "${database}"`);
    return result;
  }

  /**
   * Invalidate all cache entries for a specific table.
   */
  async invalidateByTable(
    database: string,
    table: string
  ): Promise<InvalidationResult> {
    const prefix = generateTablePrefix(database, table);
    const result = await this.invalidateByPatternWithReason(prefix, "table-change");

    this.log("info", `Invalidated cache for table "${database}.${table}"`);
    return result;
  }

  /**
   * Invalidate cache entries by pattern with specific reason.
   */
  private async invalidateByPatternWithReason(
    pattern: string,
    reason: InvalidationReason
  ): Promise<InvalidationResult> {
    const result: InvalidationResult = {
      success: true,
      keysInvalidated: [],
      keysNotFound: [],
      errors: [],
    };

    try {
      // Get all keys from cache
      let keys: string[] = [];

      if (this.isHybridCache(this.cache)) {
        keys = this.cache.keys();
      } else if (this.isRedisCache(this.cache)) {
        keys = await this.cache.keys();
      } else {
        keys = this.cache.keys();
      }

      // Find matching keys
      const matchingKeys = keys.filter((key) => matchesPattern(key, pattern));

      // Invalidate matching keys
      for (const key of matchingKeys) {
        try {
          let deleted = false;

          if (this.isHybridCache(this.cache) || this.isRedisCache(this.cache)) {
            await this.cache.delete(key);
            deleted = true;
          } else {
            deleted = this.cache.delete(key);
          }

          if (deleted) {
            result.keysInvalidated.push(key);
            this.options.onInvalidate(key, reason);
          }
        } catch (error) {
          result.errors.push({
            key,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      this.log("error", `Failed to invalidate by pattern "${pattern}":`, error);
    }

    return result;
  }

  /**
   * Invalidate cache entries by prefix.
   */
  async invalidateByPrefix(prefix: string): Promise<InvalidationResult> {
    const pattern = `${prefix}*`;
    return this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate cache entries by tags.
   * Tags are stored in cache entry metadata.
   */
  async invalidateByTags(tags: string[]): Promise<InvalidationResult> {
    // This would require storing tags with cache entries
    // For now, log that this feature needs cache metadata support
    this.log(
      "warn",
      "invalidateByTags requires cache metadata support - not implemented"
    );

    return {
      success: false,
      keysInvalidated: [],
      keysNotFound: [],
      errors: [
        {
          key: "*",
          error: new Error("Tag-based invalidation requires metadata support"),
        },
      ],
    };
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Get all cache keys.
   */
  async getAllKeys(): Promise<string[]> {
    if (this.isHybridCache(this.cache)) {
      return this.cache.keys();
    } else if (this.isRedisCache(this.cache)) {
      return await this.cache.keys();
    } else {
      return this.cache.keys();
    }
  }

  /**
   * Check if a key exists in cache.
   */
  async has(key: string): Promise<boolean> {
    if (this.isHybridCache(this.cache)) {
      return this.cache.has(key);
    } else if (this.isRedisCache(this.cache)) {
      return await this.cache.has(key);
    } else {
      return this.cache.has(key);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.eventListeners.clear();
    this.pendingEvents = [];
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private detectCacheType(
    cache: LRUCacheImpl | RedisCache | HybridCache
  ): CacheType {
    if (this.isHybridCache(cache)) return "hybrid";
    if (this.isRedisCache(cache)) return "redis";
    return "lru";
  }

  private isHybridCache(
    cache: LRUCacheImpl | RedisCache | HybridCache
  ): cache is HybridCache {
    return "memoryCache" in cache;
  }

  private isRedisCache(
    cache: LRUCacheImpl | RedisCache | HybridCache
  ): cache is RedisCache {
    return "prefix" in cache && "defaultTTL" in cache;
  }

  private async getFromCache<T>(key: string): Promise<T | undefined> {
    const cache = this.cache;
    if (this.isHybridCache(cache)) {
      return await cache.get(key) as T | undefined;
    } else if (this.isRedisCache(cache)) {
      return await cache.get(key) as T | undefined;
    } else {
      return cache.get(key) as T | undefined;
    }
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    ...args: unknown[]
  ): void {
    if (!this.options.enableLogging && level === "debug") {
      return;
    }

    const prefix = "[CacheInvalidator]";
    switch (level) {
      case "debug":
        console.debug(prefix, message, ...args);
        break;
      case "info":
        console.info(prefix, message, ...args);
        break;
      case "warn":
        console.warn(prefix, message, ...args);
        break;
      case "error":
        console.error(prefix, message, ...args);
        break;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a cache invalidator for an LRU cache.
 */
export function createLRUInvalidator(
  cache: LRUCacheImpl,
  options?: InvalidationOptions
): CacheInvalidator {
  return new CacheInvalidator(cache, { cacheType: "lru", ...options });
}

/**
 * Create a cache invalidator for a Redis cache.
 */
export function createRedisInvalidator(
  cache: RedisCache,
  options?: InvalidationOptions
): CacheInvalidator {
  return new CacheInvalidator(cache, { cacheType: "redis", ...options });
}

/**
 * Create a cache invalidator for a hybrid cache.
 */
export function createHybridInvalidator(
  cache: HybridCache,
  options?: InvalidationOptions
): CacheInvalidator {
  return new CacheInvalidator(cache, { cacheType: "hybrid", ...options });
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Create a database dropped event.
 */
export function createDatabaseDroppedEvent(
  database: string,
  metadata?: Record<string, unknown>
): InvalidationEvent {
  return {
    type: "database-dropped",
    database,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Create a table dropped event.
 */
export function createTableDroppedEvent(
  database: string,
  table: string,
  metadata?: Record<string, unknown>
): InvalidationEvent {
  return {
    type: "table-dropped",
    database,
    table,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Create a table altered event.
 */
export function createTableAlteredEvent(
  database: string,
  table: string,
  metadata?: Record<string, unknown>
): InvalidationEvent {
  return {
    type: "table-altered",
    database,
    table,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Create a data changed event (insert/update/delete).
 */
export function createDataChangedEvent(
  type: "data-inserted" | "data-updated" | "data-deleted",
  database: string,
  table: string,
  metadata?: Record<string, unknown>
): InvalidationEvent {
  return {
    type,
    database,
    table,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Create a schema changed event.
 */
export function createSchemaChangedEvent(
  metadata?: Record<string, unknown>
): InvalidationEvent {
  return {
    type: "schema-changed",
    timestamp: Date.now(),
    metadata,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default CacheInvalidator;
