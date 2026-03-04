/**
 * ClickHouse Client Factory
 * Creates or retrieves a cached ClickHouse client using @clickhouse/client (HTTP interface).
 * Clients are cached by (host, port, username, database) to enable HTTP keep-alive reuse.
 */

import { type ClickHouseConfig, getLensConfig } from "./config";
import { type ClickHouseClient } from "./clients/types";
import { ClickHouseClientImpl } from "./clients/client";

// Re-export types
export * from "./clients/types";
export { ClickHouseClientImpl } from "./clients/client";

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_CLIENTS = 100;

interface CachedEntry {
  client: ClickHouseClient;
  lastUsed: number;
}

const clientCache = new Map<string, CachedEntry>();

function buildCacheKey(config: ClickHouseConfig): string {
  const settingsKey = config.settings
    ? JSON.stringify(config.settings)
    : "";
  return `${config.host}:${config.port}:${config.username}:${config.database || "default"}:${settingsKey}`;
}

function evictStaleClients(): void {
  const now = Date.now();
  for (const [key, entry] of clientCache) {
    if (now - entry.lastUsed > CLIENT_CACHE_TTL_MS) {
      clientCache.delete(key);
    }
  }
  if (clientCache.size > MAX_CACHED_CLIENTS) {
    const oldest = [...clientCache.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    );
    for (let i = 0; i < oldest.length - MAX_CACHED_CLIENTS; i++) {
      clientCache.delete(oldest[i][0]);
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

  evictStaleClients();

  const client = new ClickHouseClientImpl(resolvedConfig);
  clientCache.set(key, { client, lastUsed: Date.now() });
  return client;
}

/** Clear all cached clients (useful for testing). */
export function clearClientCache(): void {
  clientCache.clear();
}
