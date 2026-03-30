/**
 * Cache Key Generator
 *
 * Generates consistent cache keys from query parameters.
 * Enhanced with versioning, memoization, collision detection, and partial invalidation.
 */

import { createHash } from "crypto";

export interface QueryParams {
  database?: string;
  table?: string;
  filter?: string;
  columns?: string[];
  orderBy?: string;
  groupBy?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

/**
 * Cache key version for schema changes
 */
export const CACHE_KEY_VERSION = 1;

/**
 * Cache key configuration options
 */
export interface CacheKeyOptions {
  /** Version number for cache key schema */
  version?: number;
  /** Use SHA-256 instead of MD5 (more secure, slightly slower) */
  useSha256?: boolean;
  /** Enable hash memoization for repeated keys */
  memoize?: boolean;
  /** Enable collision detection and logging */
  detectCollisions?: boolean;
}

/**
 * Internal state for enhanced features
 */
const state = {
  hashCache: new Map<string, string>(),
  collisionCount: 0,
  keyCount: 0,
  lastCollisionWarning: 0,
  maxCacheSize: 10000,
};

/**
 * Clear internal caches (useful for testing)
 */
export function clearKeyGeneratorCache(): void {
  state.hashCache.clear();
  state.collisionCount = 0;
  state.keyCount = 0;
  state.lastCollisionWarning = 0;
}

/**
 * Get collision statistics
 */
export function getCollisionStats(): { totalKeys: number; collisions: number; cacheSize: number } {
  return {
    totalKeys: state.keyCount,
    collisions: state.collisionCount,
    cacheSize: state.hashCache.size,
  };
}

/**
 * Hash value using MD5 or SHA-256
 */
function hashValue(value: string, useSha256: boolean = false): string {
  const hash = createHash(useSha256 ? "sha256" : "md5");
  return hash.update(value).digest("hex");
}

/**
 * Memoized hash function with optional caching
 */
function memoizedHash(value: string, key: string, options: CacheKeyOptions): string {
  state.keyCount++;

  if (options.memoize && state.hashCache.has(key)) {
    return state.hashCache.get(key)!;
  }

  const hash = hashValue(value, options.useSha256 ?? false);

  // Collision detection
  if (options.detectCollisions) {
    for (const [, existingHash] of state.hashCache) {
      if (existingHash === hash) {
        state.collisionCount++;
        const now = Date.now();
        // Log collision warning at most once per minute
        if (now - state.lastCollisionWarning > 60000) {
          console.warn(
            `[CacheKeyGenerator] Potential collision detected: ${state.collisionCount} collisions so far`
          );
          state.lastCollisionWarning = now;
        }
        break;
      }
    }
  }

  // Cache the hash if memoization is enabled
  if (options.memoize && state.hashCache.size < state.maxCacheSize) {
    state.hashCache.set(key, hash);
  }

  return hash;
}

function normalizeParam(value: unknown): string {
  if (value === undefined || value === null) {
    return "none";
  }
  if (Array.isArray(value)) {
    return value.sort().join(",");
  }
  if (typeof value === "object") {
    return hashValue(JSON.stringify(value));
  }
  return String(value);
}

/**
 * Generate an enhanced cache key with versioning and options
 */
export function generateCacheKey(
  prefix: string,
  params: QueryParams = {},
  options: CacheKeyOptions = {}
): string {
  const version = options.version ?? CACHE_KEY_VERSION;
  const parts: string[] = [`v${version}`, prefix];

  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null) {
      parts.push(`${key}:${normalizeParam(value)}`);
    }
  }

  const rawKey = parts.join(":");

  // Apply optimizations
  if (options.memoize || options.detectCollisions) {
    const hash = memoizedHash(rawKey, rawKey, options);
    return options.detectCollisions ? `${rawKey}:hash:${hash}` : hash;
  }

  return rawKey;
}

/**
 * Generate cache key with explicit version parameter
 */
export function generateCacheKeyWithVersion(
  prefix: string,
  params: QueryParams,
  version: number = CACHE_KEY_VERSION
): string {
  return generateCacheKey(prefix, params, { version, memoize: true });
}

/**
 * Generate query cache key with options
 */
export function generateQueryCacheKey(
  query: string,
  params: QueryParams = {},
  options: CacheKeyOptions = {}
): string {
  const queryHash = hashValue(query, options.useSha256 ?? false);
  return generateCacheKey(`query:${queryHash}`, params, options);
}

/**
 * Generate schema cache key
 */
export function generateSchemaCacheKey(database: string, table?: string, version?: number): string {
  const versionPart = version ?? CACHE_KEY_VERSION;
  if (table) {
    return `v${versionPart}:schema:${database}:${table}`;
  }
  return `v${versionPart}:schema:${database}`;
}

/**
 * Generate table cache key
 */
export function generateTableCacheKey(
  database: string,
  table: string,
  viewType?: string,
  version?: number
): string {
  const versionPart = version ?? CACHE_KEY_VERSION;
  if (viewType) {
    return `v${versionPart}:table:${database}:${table}:${viewType}`;
  }
  return `v${versionPart}:table:${database}:${table}`;
}

/**
 * Generate pattern for cache invalidation
 */
export function generatePattern(prefix: string, database: string, table?: string): string {
  if (table) {
    return `${prefix}:${database}:${table}:*`;
  }
  return `${prefix}:${database}:*`;
}

/**
 * Generate prefix for partial cache invalidation by database
 */
export function generateDatabasePrefix(database: string, prefix: string = "query"): string {
  return `${prefix}:${database}:*`;
}

/**
 * Generate prefix for partial cache invalidation by table
 */
export function generateTablePrefix(database: string, table: string, prefix: string = "query"): string {
  return `${prefix}:${database}:${table}:*`;
}

/**
 * Check if a cache key matches a prefix pattern for invalidation
 */
export function matchesPattern(key: string, pattern: string): boolean {
  // Convert pattern to regex: * becomes .*, : stays as :
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars except *
    .replace(/\*/g, ".*"); // Convert * to .*
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(key);
}

/**
 * Generate versioned prefix for cache key
 */
export function getVersionedPrefix(prefix: string, version: number = CACHE_KEY_VERSION): string {
  return `v${version}:${prefix}`;
}

/**
 * Extract version from cache key
 */
export function extractVersion(key: string): number | null {
  const match = key.match(/^v(\d+):/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Validate cache key version compatibility
 */
export function isVersionCompatible(
  keyVersion: number,
  currentVersion: number = CACHE_KEY_VERSION
): boolean {
  if (keyVersion === currentVersion) return true;
  if (keyVersion < currentVersion) {
    console.warn(
      `[CacheKeyGenerator] Cache key version ${keyVersion} is older than current ${currentVersion}. Consider cache invalidation.`
    );
    return false;
  }
  console.warn(
    `[CacheKeyGenerator] Cache key version ${keyVersion} is newer than current ${currentVersion}.`
  );
  return false;
}

/**
 * Generate a compressed cache key for very long keys
 * Uses base64 encoding of truncated hash
 */
export function generateCompressedKey(
  prefix: string,
  params: QueryParams,
  options: CacheKeyOptions = {}
): string {
  const fullKey = generateCacheKey(prefix, params, options);

  // If key is short enough, return as is
  if (fullKey.length <= 200) {
    return fullKey;
  }

  // Compress long keys by hashing the full key
  const hash = hashValue(fullKey, options.useSha256 ?? false);
  const prefixPart = fullKey.split(":").slice(0, 3).join(":"); // Keep version, prefix, first param
  return `${prefixPart}:compressed:${hash}`;
}
