/**
 * Hybrid Authorization Cache
 *
 * Caches permission check results with dual backend:
 * - Redis as primary (for horizontal scaling)
 * - In-memory LRU as fallback (when Redis unavailable)
 *
 * Caches are scoped by session to ensure security.
 */

import { getRedisClient, isRedisAvailable } from "./redis-client";
import { getSession } from "@/lib/auth";

interface CachedPermissions {
  permissions: Set<string>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const inMemoryCache = new Map<string, CachedPermissions>();
const inMemoryCacheOrder: string[] = [];
const MAX_IN_MEMORY_ENTRIES = 1000;

function getCacheKey(username: string): string {
  return `auth:perms:${username}`;
}

function setInMemoryCache(key: string, value: CachedPermissions): void {
  if (inMemoryCache.size >= MAX_IN_MEMORY_ENTRIES) {
    const oldestKey = inMemoryCacheOrder.shift();
    if (oldestKey) {
      inMemoryCache.delete(oldestKey);
    }
  }
  inMemoryCache.set(key, value);
  inMemoryCacheOrder.push(key);
}

function getInMemoryCache(key: string): CachedPermissions | null {
  const entry = inMemoryCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    inMemoryCache.delete(key);
    const idx = inMemoryCacheOrder.indexOf(key);
    if (idx !== -1) inMemoryCacheOrder.splice(idx, 1);
    return null;
  }

  return entry;
}

async function getRedisPermissions(
  username: string,
): Promise<CachedPermissions | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = await getRedisClient();
    const key = getCacheKey(username);
    const cached = await redis.get(key);

    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedPermissions;

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      await redis.del(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function setRedisPermissions(
  username: string,
  permissions: Set<string>,
): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = await getRedisClient();
    const key = getCacheKey(username);
    const value = JSON.stringify({
      permissions: Array.from(permissions),
      timestamp: Date.now(),
    });

    await redis.setEx(key, Math.floor(CACHE_TTL_MS / 1000), value);
  } catch {
    // Silently fail - cache is best effort
  }
}

export interface PermissionSet {
  permissions: Set<string>;
  backend: "redis" | "memory" | "fresh";
}

export async function getCachedPermissions(): Promise<PermissionSet> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return { permissions: new Set(), backend: "fresh" };
  }

  const username = session.user.username;
  if (!username) {
    return { permissions: new Set(), backend: "fresh" };
  }

  const cacheKey = getCacheKey(username);

  const redisCached = await getRedisPermissions(username);
  if (redisCached) {
    return { permissions: redisCached.permissions, backend: "redis" };
  }

  const memoryCached = getInMemoryCache(cacheKey);
  if (memoryCached) {
    setRedisPermissions(username, memoryCached.permissions).catch(() => {});
    return { permissions: memoryCached.permissions, backend: "memory" };
  }

  return { permissions: new Set(), backend: "fresh" };
}

export async function setCachedPermissions(
  permissions: Set<string>,
): Promise<void> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return;
  }

  const username = session.user.username;
  if (!username) {
    return;
  }

  const cacheKey = getCacheKey(username);

  setInMemoryCache(cacheKey, {
    permissions,
    timestamp: Date.now(),
  });

  await setRedisPermissions(username, permissions);
}

export function invalidatePermissionCache(): void {
  inMemoryCache.clear();
  inMemoryCacheOrder.length = 0;
}

export async function invalidateUserPermissions(
  username: string,
): Promise<void> {
  const cacheKey = getCacheKey(username);
  inMemoryCache.delete(cacheKey);
  const idx = inMemoryCacheOrder.indexOf(cacheKey);
  if (idx !== -1) inMemoryCacheOrder.splice(idx, 1);

  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      redis.del(cacheKey).catch(() => {});
    } catch {
      // Silently fail
    }
  }
}
