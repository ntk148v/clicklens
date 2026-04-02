/**
 * ClickHouse Client Factory
 * Creates or retrieves a cached ClickHouse client using @clickhouse/client (HTTP interface).
 * Clients are cached by (host, port, username, database) to enable HTTP keep-alive reuse.
 */

import { type ClickHouseConfig, getLensConfig } from "./config";
import {
  type ClickHouseClient,
  type ClickHouseQueryResult,
} from "./clients/types";
import { ClickHouseClientImpl } from "./clients/client";

// Re-export types
export * from "./clients/types";
export { ClickHouseClientImpl } from "./clients/client";

const CLIENT_CACHE_TTL_MS = parseInt(process.env.CLIENT_CACHE_TTL_MS || "300000", 10); // 5 minutes default
const MAX_CACHED_CLIENTS = parseInt(process.env.MAX_CACHED_CLIENTS || "50", 10);
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute

interface CachedEntry {
  client: ClickHouseClient;
  lastUsed: number;
  createdAt: number;
}

const clientCache = new Map<string, CachedEntry>();

// Periodic cleanup interval
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    evictStaleClients();
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

function buildCacheKey(config: ClickHouseConfig): string {
  const settingsKey = config.settings
    ? JSON.stringify(config.settings)
    : "";
  return `${config.host}:${config.port}:${config.username}:${config.database || "default"}:${settingsKey}`;
}

function evictStaleClients(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of clientCache) {
    // Evict if stale or if entry is too old (even if recently used)
    if (
      now - entry.lastUsed > CLIENT_CACHE_TTL_MS ||
      now - entry.createdAt > CLIENT_CACHE_TTL_MS * 2
    ) {
      keysToDelete.push(key);
    }
  }

  // Delete stale entries
  for (const key of keysToDelete) {
    const entry = clientCache.get(key);
    if (entry) {
      // Close underlying connection if possible
      (
        entry.client as ClickHouseClientImpl & { close?: () => void }
      )?.close?.();
      clientCache.delete(key);
    }
  }

  // If still over limit, evict oldest by lastUsed
  if (clientCache.size > MAX_CACHED_CLIENTS) {
    const sorted = [...clientCache.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    );
    const toEvict = sorted.slice(0, sorted.length - MAX_CACHED_CLIENTS);

    for (const [key, entry] of toEvict) {
      (
        entry.client as ClickHouseClientImpl & { close?: () => void }
      )?.close?.();
      clientCache.delete(key);
    }
  }
}

/**
 * Create or retrieve a cached ClickHouse client.
 * Clients with the same (host, port, username, database, settings) reuse HTTP connections.
 */
export function createClient(config?: ClickHouseConfig): ClickHouseClient {
  const resolvedConfig = config ?? getLensConfig();

  if (!resolvedConfig) {
    throw new Error(
      "ClickHouse configuration not provided and CLICKHOUSE_HOST/LENS_USER environment variables are not set"
    );
  }

  const key = buildCacheKey(resolvedConfig);
  const cached = clientCache.get(key);

  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  // Start periodic cleanup
  startCleanupInterval();

  // Evict before adding new client
  evictStaleClients();

  const client = new ClickHouseClientImpl(resolvedConfig);
  clientCache.set(key, {
    client,
    lastUsed: Date.now(),
    createdAt: Date.now(),
  });
  return client;
}

/** Clear all cached clients (useful for testing). */
export function clearClientCache(): void {
  // Close all connections before clearing
  for (const [, entry] of clientCache) {
    (
      entry.client as ClickHouseClientImpl & { close?: () => void }
    )?.close?.();
  }
  clientCache.clear();

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getClientCacheStats(): {
  size: number;
  maxSize: number;
  oldestEntryAge: number;
} {
  const now = Date.now();
  let oldestAge = 0;

  for (const entry of clientCache.values()) {
    const age = now - entry.lastUsed;
    if (age > oldestAge) oldestAge = age;
  }

  return {
    size: clientCache.size,
    maxSize: MAX_CACHED_CLIENTS,
    oldestEntryAge: oldestAge,
  };
}

/**
 * Execute a query with timeout enforcement.
 * Uses AbortController to cancel the query if it exceeds the timeout.
 *
 * @param client - ClickHouse client instance
 * @param query - SQL query to execute
 * @param timeoutSeconds - Timeout in seconds (default: 60, max: 300)
 * @returns Query result
 * @throws Error if timeout is exceeded or query fails
 */
export async function queryWithTimeout<T = Record<string, unknown>>(
  client: ClickHouseClient,
  query: string,
  timeoutSeconds: number = 60,
): Promise<ClickHouseQueryResult<T>> {
  const maxTimeout = 300; // 5 minutes
  const effectiveTimeout = Math.min(timeoutSeconds, maxTimeout);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout * 1000);

  try {
    const result = await client.query<T>(query, {
      timeout: effectiveTimeout * 1000,
      clickhouse_settings: {
        max_execution_time: effectiveTimeout,
      },
    });
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Query timeout after ${effectiveTimeout} seconds. Consider optimizing your query or increasing the timeout.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
