import { LRUCache } from 'lru-cache';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export class RateLimiter {
  private cache: LRUCache<string, number[]>;
  private windowMs: number;
  private maxRequests: number;

  constructor(options: {
    maxRequests?: number;
    windowMs?: number;
    maxCacheSize?: number;
  } = {}) {
    this.maxRequests = options.maxRequests ?? 10;
    this.windowMs = options.windowMs ?? 60 * 1000; // 1 minute default
    this.cache = new LRUCache({
      max: options.maxCacheSize ?? 1000,
      ttl: this.windowMs,
    });
  }

  /**
   * Check if a request is allowed for the given identifier.
   *
   * @param identifier - Unique identifier for the user/IP (e.g., user ID, IP address)
   * @param customLimit - Optional custom limit for this specific request
   * @returns Rate limit result with allowed status and metadata
   */
  check(identifier: string, customLimit?: number): RateLimitResult {
    const now = Date.now();
    const timestamps = this.cache.get(identifier) || [];
    const limit = customLimit ?? this.maxRequests;

    // Filter out timestamps older than the time window
    const recentTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    // Calculate remaining requests
    const remaining = Math.max(0, limit - recentTimestamps.length);

    // Check if rate limit is exceeded
    if (recentTimestamps.length >= limit) {
      // Find the oldest timestamp to calculate reset time
      const oldestTimestamp = recentTimestamps[0];
      const resetTime = oldestTimestamp + this.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.cache.set(identifier, recentTimestamps);

    // Calculate reset time (when the oldest request will expire)
    const resetTime =
      recentTimestamps.length > 0
        ? recentTimestamps[0] + this.windowMs
        : now + this.windowMs;

    return {
      allowed: true,
      remaining: remaining - 1,
      resetTime,
    };
  }

  /**
   * Reset the rate limit for a specific identifier.
   *
   * @param identifier - Unique identifier to reset
   */
  reset(identifier: string): void {
    this.cache.delete(identifier);
  }

  /**
   * Get current usage statistics for an identifier.
   *
   * @param identifier - Unique identifier to check
   * @returns Current usage count
   */
  getUsage(identifier: string): number {
    const now = Date.now();
    const timestamps = this.cache.get(identifier) || [];

    // Filter out timestamps older than the time window
    const recentTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    return recentTimestamps.length;
  }

  /**
   * Clear all rate limit data.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): {
    size: number;
    maxSize: number;
    calculatedSize: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      calculatedSize: this.cache.calculatedSize,
    };
  }
}

// Singleton instance for global rate limiting
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global rate limiter instance.
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter (useful for testing).
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter = null;
}