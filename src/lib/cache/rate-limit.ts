/**
 * Hybrid Rate Limiter
 *
 * Provides rate limiting with dual backend:
 * - Redis as primary (for horizontal scaling)
 * - In-memory as fallback (when Redis unavailable)
 *
 * Uses sliding window algorithm for accurate rate limiting.
 */

import { getRedisClient, isRedisAvailable } from "./redis-client";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60000,
  keyPrefix: "ratelimit",
};

const inMemoryStore = new Map<string, RateLimitEntry>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (now > entry.resetTime) {
        inMemoryStore.delete(key);
      }
    }
  }, 60000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
  backend: "redis" | "memory";
}

async function checkRedisRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const key = `${config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / config.windowMs)}`;

    const count = await redis.incr(windowKey);
    
    if (count === 1) {
      await redis.pExpire(windowKey, config.windowMs);
    }

    const ttl = await redis.pTTL(windowKey);

    if (count > config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetIn: ttl > 0 ? ttl : config.windowMs,
        backend: "redis",
      };
    }

    return {
      success: true,
      remaining: config.maxRequests - count,
      resetIn: ttl > 0 ? ttl : config.windowMs,
      backend: "redis",
    };
  } catch {
    return null;
  }
}

function checkMemoryRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  startCleanup();

  const now = Date.now();
  const entry = inMemoryStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowMs;
    inMemoryStore.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
      backend: "memory",
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
      backend: "memory",
    };
  }

  entry.count++;
  inMemoryStore.set(identifier, entry);

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
    backend: "memory",
  };
}

export async function checkRateLimit(
  identifier: string,
  options?: Partial<RateLimitConfig>,
): Promise<RateLimitResult> {
  const config = { ...DEFAULT_CONFIG, ...options };

  const redisResult = await checkRedisRateLimit(identifier, config);
  if (redisResult) {
    return redisResult;
  }

  return checkMemoryRateLimit(identifier, config);
}

export function resetRateLimit(identifier: string): void {
  inMemoryStore.delete(identifier);
}

export function clearAllRateLimits(): void {
  inMemoryStore.clear();
}

export function getRateLimitStoreSize(): number {
  return inMemoryStore.size;
}
