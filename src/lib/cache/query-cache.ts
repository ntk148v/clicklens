/**
 * Query Result Cache
 *
 * Caches expensive query results using Redis with graceful degradation.
 */

import { getRedisClient, isRedisAvailable } from "./redis-client";

export class QueryCache {
  private defaultTTL: number;

  constructor(defaultTTL: number = 60) {
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!isRedisAvailable()) {
        return null;
      }

      const redis = await getRedisClient();
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      console.error("Failed to get from cache:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (!isRedisAvailable()) {
        return;
      }

      const redis = await getRedisClient();
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      await redis.setEx(key, expiry, serialized);
    } catch (error) {
      console.error("Failed to set cache:", error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      if (!isRedisAvailable()) {
        return;
      }

      const redis = await getRedisClient();
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error("Failed to invalidate cache:", error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (!isRedisAvailable()) {
        return;
      }

      const redis = await getRedisClient();
      await redis.flushDb();
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }
  }
}