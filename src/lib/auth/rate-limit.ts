/**
 * Simple in-memory rate limiter using sliding window algorithm
 *
 * Used to protect login endpoint from brute-force attacks.
 * Note: In production with multiple instances, consider using Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 requests per window
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute

// Periodic cleanup of expired entries
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number; // milliseconds until reset
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier for the client (e.g., IP address)
 * @param maxRequests - Maximum requests allowed in window (default: 5)
 * @param windowMs - Time window in milliseconds (default: 60000)
 * @returns RateLimitResult with success status and remaining attempts
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): RateLimitResult {
  // Start cleanup on first use
  startCleanup();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No existing entry or window expired
  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetIn: windowMs,
    };
  }

  // Within window, check count
  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header if behind proxy, otherwise falls back to IP
 */
export function getClientIdentifier(request: Request): string {
  // Check for forwarded IP (when behind proxy/load balancer)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  // Check for real IP header (nginx)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a default identifier
  // In serverless environments, we might not have direct access to IP
  return "unknown";
}

/**
 * Reset rate limit for an identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current store size (useful for monitoring)
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}
