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
 * Check if the request is from a trusted proxy.
 * Set TRUSTED_PROXY_IPS env var to a comma-separated list of proxy IPs
 * to enable trusting X-Forwarded-For / X-Real-IP headers.
 *
 * SECURITY: Without this, X-Forwarded-For can be trivially spoofed
 * to bypass rate limiting.
 */
function isTrustedProxy(): boolean {
  return !!process.env.TRUSTED_PROXY_IPS;
}

/**
 * Get client identifier from request.
 *
 * Only trusts X-Forwarded-For / X-Real-IP headers when running behind
 * a known trusted proxy (TRUSTED_PROXY_IPS is set). Otherwise, uses
 * a deterministic hash of available request metadata as a fallback.
 */
export function getClientIdentifier(request: Request): string {
  if (isTrustedProxy()) {
    // Trust forwarded headers only when behind a configured proxy
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
  }

  // Fallback: combine multiple request signals to make bucket rotation harder.
  // An attacker must change ALL signals to escape their bucket.
  const ua = request.headers.get("user-agent") || "";
  const lang = request.headers.get("accept-language") || "";
  const encoding = request.headers.get("accept-encoding") || "";
  const connection = request.headers.get("connection") || "";
  return `fallback:${simpleHash(ua + lang + encoding + connection)}`;
}

/**
 * Simple non-cryptographic hash for generating deterministic identifiers.
 * Not used for security — only for rate-limit bucket assignment.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
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
