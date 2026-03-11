/**
 * Metadata Cache with LRU Eviction
 *
 * Caches table schema information to avoid repeated introspection queries.
 */

import { LRUCache } from "lru-cache";
import type { TableSchema } from "@/lib/types/discover";

export interface MetadataCacheOptions {
  max?: number;
  ttl?: number;
}

export class MetadataCache {
  private cache: LRUCache<string, TableSchema>;
  private pendingFetches: Map<string, Promise<TableSchema>>;

  constructor(options: MetadataCacheOptions = {}) {
    this.cache = new LRUCache<string, TableSchema>({
      max: options.max || 100,
      ttl: options.ttl || 1000 * 60 * 5,
    });
    this.pendingFetches = new Map();
  }

  async getOrFetch(
    key: string,
    fetchFn: () => Promise<TableSchema>,
  ): Promise<TableSchema> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const existingPromise = this.pendingFetches.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = fetchFn()
      .then((schema) => {
        this.cache.set(key, schema);
        this.pendingFetches.delete(key);
        return schema;
      })
      .catch((error) => {
        this.pendingFetches.delete(key);
        throw error;
      });

    this.pendingFetches.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}