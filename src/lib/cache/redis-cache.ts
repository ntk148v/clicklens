/**
 * Redis Cache Implementation
 *
 * Pure Redis cache layer with get/set/delete operations, TTL support, and error handling.
 * Designed to work with the existing redis-client singleton or can be used standalone.
 */

import { getRedisClient, isRedisAvailable, closeRedisClient } from "./redis-client";

export interface RedisCacheOptions {
  prefix?: string; // Key prefix for namespacing
  defaultTTL?: number; // Default TTL in seconds
  enableFallback?: boolean; // Enable graceful error handling
}

interface CacheData<T> {
  value: T;
  timestamp: number;
}

/**
 * Redis Cache class providing async cache operations with TTL support.
 */
export class RedisCache {
  private prefix: string;
  private defaultTTL: number;
  private enableFallback: boolean;
  private fallback: Map<string, CacheData<unknown>>;

  constructor(options: RedisCacheOptions = {}) {
    this.prefix = options.prefix ?? "redis-cache";
    this.defaultTTL = options.defaultTTL ?? 60; // 60 seconds default
    this.enableFallback = options.enableFallback ?? true;
    this.fallback = new Map();
  }

  /**
   * Get a value from Redis cache.
   * Returns undefined if not found or on error (with fallback enabled).
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (!isRedisAvailable()) {
      if (this.enableFallback) {
        return this.getFromFallback<T>(key);
      }
      console.warn(`[${this.prefix}] Redis unavailable, returning undefined`);
      return undefined;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this.getFullKey(key);
      const data = await redis.get(fullKey);

      if (!data) {
        return undefined;
      }

      const parsed = JSON.parse(data) as CacheData<T>;
      return parsed.value;
    } catch (error) {
      console.error(`[${this.prefix}] Redis get failed for key "${key}":`, error);
      if (this.enableFallback) {
        return this.getFromFallback<T>(key);
      }
      return undefined;
    }
  }

  /**
   * Set a value in Redis cache with optional TTL.
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    // Always update fallback
    this.setFallback(key, value);

    if (!isRedisAvailable()) {
      console.warn(`[${this.prefix}] Redis unavailable, using fallback only`);
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this.getFullKey(key);
      const expiry = ttl ?? this.defaultTTL;

      const cacheData: CacheData<T> = {
        value,
        timestamp: Date.now(),
      };

      await redis.setEx(fullKey, expiry, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.error(`[${this.prefix}] Redis set failed for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Delete a value from Redis cache.
   */
  async delete(key: string): Promise<boolean> {
    // Always delete from fallback
    this.deleteFallback(key);

    if (!isRedisAvailable()) {
      console.warn(`[${this.prefix}] Redis unavailable, fallback deleted only`);
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this.getFullKey(key);
      const result = await redis.del(fullKey);
      return result > 0;
    } catch (error) {
      console.error(`[${this.prefix}] Redis delete failed for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in cache.
   */
  async has(key: string): Promise<boolean> {
    if (this.hasFallback(key)) {
      return true;
    }

    if (!isRedisAvailable()) {
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this.getFullKey(key);
      const result = await redis.exists(fullKey);
      return result > 0;
    } catch (error) {
      console.error(`[${this.prefix}] Redis exists check failed for key "${key}":`, error);
      return this.hasFallback(key);
    }
  }

  /**
   * Get TTL for a key (in seconds).
   * Returns -1 if no TTL, -2 if key doesn't exist.
   */
  async getTTL(key: string): Promise<number> {
    if (!isRedisAvailable()) {
      return -2;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this.getFullKey(key);
      return await redis.ttl(fullKey);
    } catch (error) {
      console.error(`[${this.prefix}] Redis TTL check failed for key "${key}":`, error);
      return -2;
    }
  }

  /**
   * Set TTL for an existing key.
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!isRedisAvailable()) {
      return false;
    }

    try {
      const redis = await getRedisClient();
      const fullKey = this.getFullKey(key);
      const result = await redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error(`[${this.prefix}] Redis expire failed for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Clear all keys with the cache prefix.
   */
  async clear(): Promise<boolean> {
    // Clear fallback
    this.fallback.clear();

    if (!isRedisAvailable()) {
      console.warn(`[${this.prefix}] Redis unavailable, fallback cleared only`);
      return false;
    }

    try {
      const redis = await getRedisClient();
      const pattern = `${this.prefix}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(keys as unknown as string);
      }

      return true;
    } catch (error) {
      console.error(`[${this.prefix}] Redis clear failed:`, error);
      return false;
    }
  }

  /**
   * Get all keys with the cache prefix.
   */
  async keys(): Promise<string[]> {
    if (!isRedisAvailable()) {
      return Array.from(this.fallback.keys());
    }

    try {
      const redis = await getRedisClient();
      const pattern = `${this.prefix}:*`;
      const fullKeys = await redis.keys(pattern);
      return fullKeys.map((k) => k.replace(`${this.prefix}:`, ""));
    } catch (error) {
      console.error(`[${this.prefix}] Redis keys failed:`, error);
      return Array.from(this.fallback.keys());
    }
  }

  /**
   * Get cache size (approximate, only counts Redis keys).
   */
  async size(): Promise<number> {
    if (!isRedisAvailable()) {
      return this.fallback.size;
    }

    try {
      const redis = await getRedisClient();
      const pattern = `${this.prefix}:*`;
      const keys = await redis.keys(pattern);
      return keys.length;
    } catch (error) {
      console.error(`[${this.prefix}] Redis size check failed:`, error);
      return this.fallback.size;
    }
  }

  // --- Fallback methods ---

  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private getFromFallback<T>(key: string): T | undefined {
    const data = this.fallback.get(key) as CacheData<T> | undefined;
    if (!data) {
      return undefined;
    }
    return data.value;
  }

  private setFallback<T>(key: string, value: T): void {
    this.fallback.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  private deleteFallback(key: string): boolean {
    return this.fallback.delete(key);
  }

  private hasFallback(key: string): boolean {
    return this.fallback.has(key);
  }
}