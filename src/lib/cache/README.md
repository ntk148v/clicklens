# Cache Layer Documentation

This directory contains the caching infrastructure for ClickLens. We maintain **two distinct cache implementations** that serve different purposes.

## Overview

| Cache | Purpose | Storage | Interface | TTL |
|-------|---------|---------|-----------|-----|
| **HybridCache** | Metadata, monitoring, tables | Redis + In-memory LRU | Async | Longer (30s - 10min) |
| **QueryCache** | Query results | In-memory LRU + Redis fallback | Sync | Shorter (5min default) |

## When to Use Each Cache

### Use HybridCache when:

- Caching **metadata** (databases, tables, columns, schema info)
- Caching **monitoring data** (metrics, dashboards, cluster status)
- Caching **table explorer data** (parts, mutations, merges)
- You need **async operations** with Redis as primary storage
- Data should be **shared across server instances**
- You need **longer TTL** (30 seconds to 10 minutes)

**Example:**
```typescript
import { metadataCache, getOrSet } from "@/lib/cache";

// Cache database list
const databases = await getOrSet(
  metadataCache,
  "databases",
  async () => fetchDatabasesFromClickHouse()
);
```

### Use QueryCache when:

- Caching **query results** from Discover or SQL Console
- You need **synchronous operations** for performance
- You need **automatic key generation** for complex query parameters
- You need **cache metadata** (hit/miss tracking, TTL info)
- Data is **request-specific** and short-lived

**Example:**
```typescript
import { getQueryCache, executeWithCache } from "@/lib/cache/query-cache";

const queryCache = getQueryCache();

// Generate cache key for discover query
const cacheKey = queryCache.generateDiscoverKey({
  database: "mydb",
  table: "mytable",
  filter: "status = 'active'",
  timeRange: { minTime: "2024-01-01", maxTime: "2024-01-31" },
});

// Execute with caching
const result = await executeWithCache(
  queryCache,
  cacheKey,
  async () => executeClickHouseQuery(sql)
);
```

## Pre-configured Cache Instances

### HybridCache Instances (from `index.ts`)

```typescript
import { metadataCache, monitoringCache, tablesCache } from "@/lib/cache";

// metadataCache: 500 entries, 30s memory / 60s Redis TTL
// monitoringCache: 100 entries, 10s memory / 30s Redis TTL
// tablesCache: 200 entries, 5min memory / 10min Redis TTL
```

### QueryCache Instance

```typescript
import { getQueryCache, createQueryCache } from "@/lib/cache/query-cache";

// Default singleton instance: 500 entries, 5min TTL
const defaultCache = getQueryCache();

// Custom instance with Redis fallback
const customCache = createQueryCache({
  maxEntries: 1000,
  ttl: 600_000, // 10 minutes
  enableRedisFallback: true,
});
```

## Key Differences

| Aspect | HybridCache | QueryCache |
|--------|-------------|------------|
| **Primary Use** | Server-side metadata | Client query results |
| **Interface** | Async (`async get/set`) | Sync (`get/set`) |
| **Storage Priority** | Redis primary, memory fallback | Memory primary, Redis optional |
| **Key Generation** | Manual | Automatic (built-in generators) |
| **TTL Strategy** | Separate memory/Redis TTL | Single TTL |
| **Thundering Herd** | Built-in deduplication | Via `executeWithCache` helper |
| **Cache Metadata** | Basic (size, keys) | Rich (hit/miss, age, remaining TTL) |

## Cache Invalidation

### HybridCache
```typescript
import { invalidateCache, clearCache } from "@/lib/cache";

// Invalidate specific key
await invalidateCache(metadataCache, "databases");

// Clear entire cache
await clearCache(metadataCache);
```

### QueryCache
```typescript
import { getQueryCache } from "@/lib/cache/query-cache";

const cache = getQueryCache();

// Invalidate specific query
cache.invalidateQuery(cacheKey);

// Pattern-based invalidation (supports * and ? wildcards)
await cache.invalidate("discover:*");

// Clear all
cache.clear();
```

## Best Practices

1. **Choose the right cache** for your use case based on the guidelines above
2. **Use pre-configured instances** when possible (metadataCache, monitoringCache, tablesCache)
3. **Always handle cache misses gracefully** - the cache is an optimization, not a guarantee
4. **Set appropriate TTLs** - too short wastes resources, too long serves stale data
5. **Use `getOrSet` for HybridCache** to avoid thundering herd problems
6. **Use `executeWithCache` for QueryCache** for consistent caching patterns

## File Structure

```
src/lib/cache/
├── index.ts              # HybridCache exports and pre-configured instances
├── hybrid-cache.ts       # HybridCache implementation
├── query-cache.ts        # QueryCache implementation
├── lru-cache.ts          # LRU cache implementation
├── redis-client.ts       # Redis client management
├── redis-fallback.ts     # Redis fallback with circuit breaker
├── key-generator.ts      # Cache key generation utilities
└── README.md             # This file
```

## Migration Notes

If you're considering consolidating these caches:

**DO NOT consolidate** - They serve fundamentally different purposes:
- HybridCache is optimized for **shared, long-lived metadata** with Redis as primary
- QueryCache is optimized for **fast, request-specific results** with memory as primary

Consolidating would require compromising on either:
- Performance (making QueryCache async)
- Sharing (removing Redis from HybridCache)
- TTL flexibility (unifying TTL strategies)

The current separation is intentional and well-justified.
