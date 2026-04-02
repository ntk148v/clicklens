/**
 * Rate Limiter - Re-exports from hybrid implementation
 *
 * @deprecated Use @/lib/cache/rate-limit directly for new code
 */

export {
  checkRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitStoreSize,
  type RateLimitResult,
} from "@/lib/cache/rate-limit";

/**
 * Get list of trusted proxy IPs from environment.
 * Set TRUSTED_PROXY_IPS env var to a comma-separated list of proxy IPs.
 */
export function getTrustedProxies(): string[] {
  const ips = process.env.TRUSTED_PROXY_IPS;
  return ips ? ips.split(",").map((ip) => ip.trim()) : [];
}

/**
 * Check if an IP is in the trusted proxy list.
 */
export function isTrustedProxy(ip: string): boolean {
  const trustedProxies = getTrustedProxies();
  return trustedProxies.includes(ip);
}

/**
 * Get client identifier from request.
 *
 * SECURITY FIX: Only trusts X-Forwarded-For / X-Real-IP headers when the
 * immediate connection IP is in the trusted proxy list. This prevents
 * IP spoofing attacks where clients set these headers directly.
 *
 * @param request - The incoming request
 * @param connectionIp - The actual connection IP (from NextRequest.ip or similar)
 */
export function getClientIdentifier(
  request: Request,
  connectionIp?: string,
): string {
  // Get the immediate connection IP
  const clientIp = connectionIp || "unknown";

  // Only trust forwarded headers if the connection came from a trusted proxy
  if (isTrustedProxy(clientIp)) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      // Take the first IP in the chain (closest to the client)
      return forwardedFor.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
  }

  // If we have a real connection IP, use it
  if (clientIp !== "unknown") {
    return clientIp;
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
