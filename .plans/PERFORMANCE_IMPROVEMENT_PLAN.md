# Performance Improvement Plan - ClickLens

**Author:** Code Review
**Date:** 2026-03-04
**Status:** In Progress

---

## Executive Summary

This plan addresses performance issues in ClickLens, a Next.js-based ClickHouse GUI. Based on peer review, some original claims were inaccurate and have been corrected. The primary focus remains implementing caching for metadata routes.

---

## Issues by Priority (Corrected)

### Confirmed Issues

| #   | Issue                               | Location                             | Impact                                    | Status  |
| --- | ----------------------------------- | ------------------------------------ | ----------------------------------------- | ------- |
| C1  | No caching anywhere                 | All API routes                       | Every request hits ClickHouse directly    | ✅ Done |
| H1  | 18 parallel monitoring queries      | `src/services/monitoring.ts:347-400` | Every dashboard refresh fires 18+ queries | ✅ Done |
| H2  | OFFSET pagination for arbitrary SQL | `/api/clickhouse/query/route.ts`     | Slow for large offsets                    | ❌ Skip |
| M1  | No HTTP cache headers               | All routes                           | Missing `stale-while-revalidate`          | ✅ Done |
| L2  | Inefficient array merging           | `monitoring.ts:188-206`              | Creates new Map per merge                 | ✅ Done |

### Incorrect/Overstated Issues (Removed)

| #   | Original Claim                      | Correction                                                   |
| --- | ----------------------------------- | ------------------------------------------------------------ |
| C2  | No connection pooling               | `@clickhouse/client` already uses HTTP keep-alive internally |
| C3  | 4-5 sequential permission queries   | Actually 2-3; worst-case 4 (fallback paths)                  |
| M2  | Duplicate cluster detection         | Already cached via `cachedClusterName` in `cluster.ts`       |
| H3  | Sequential chunks performance issue | By design - streaming with backpressure                      |

---

## Implementation Plan (Revised)

### Phase 1: Caching Infrastructure ✅ DO THIS

**Goal:** Implement caching using `lru-cache` library

#### 1.1 Install lru-cache

```bash
bun add lru-cache
```

#### 1.2 Create Cache Module

**File:** `src/lib/cache/index.ts`

```typescript
import { LRUCache } from "lru-cache";

interface CacheOptions {
  ttl: number; // Time-to-live in seconds
  staleWhileRevalidate?: number; // SWR window
}

type CacheKey = string;

const createCache = <T>(options: CacheOptions) => {
  return new LRUCache<CacheKey, T>({
    ttl: options.ttl * 1000,
    allowStale: !!options.staleWhileRevalidate,
    staleTime: (options.staleWhileRevalidate || 0) * 1000,
    max: 500, // Limit entries to prevent memory leaks
  });
};

export const metadataCache = createCache<unknown>({ ttl: 30 });
export const monitoringCache = createCache<unknown>({
  ttl: 10,
  staleWhileRevalidate: 30,
});
```

#### 1.3 Add Caching to Metadata Routes

**Files:**

- `src/app/api/clickhouse/databases/route.ts`
- `src/app/api/clickhouse/tables/route.ts`
- `src/app/api/clickhouse/tables/explorer/columns/route.ts`

**Important: Cache key must include user context**

```typescript
// Cache key MUST include user roles/permissions for RBAC
const cacheKey = `databases:${userId}:${rolesHash}`;
const cached = metadataCache.get(cacheKey);
if (cached) return cached;

const result = await client.query(...);
metadataCache.set(cacheKey, result);
```

#### 1.4 Add Caching to Monitoring Routes

**File:** `src/app/api/clickhouse/monitoring/overview/route.ts`

**Warning:** Monitor incremental update mechanism - caching may conflict with `minTime` parameter.

```typescript
// Cache only works for non-incremental requests
if (!options.minTime) {
  const cacheKey = `monitoring:${hash(options)}`;
  const cached = monitoringCache.get(cacheKey);
  if (cached) return cached;
}

const result = await monitoringService.getDashboardData(options);
if (!options.minTime) {
  monitoringCache.set(cacheKey, result);
}
```

#### 1.5 Add HTTP Cache Headers

```typescript
// Add to metadata API responses
response.headers.set(
  "Cache-Control",
  "public, s-maxage=30, stale-while-revalidate=60",
);
```

---

### Phase 2: Client Singleton ❌ SKIP

**Reason:** `@clickhouse/client` already handles HTTP keep-alive pooling internally. The "new client per request" concern was overstated - it's just a JS wrapper object, not a new TCP connection.

**Optional (if needed):** Simple singleton map to avoid recreating wrapper:

```typescript
// Only if profiling shows it's needed
const clientMap = new Map<string, ClickHouseClient>();
export function getClient(config: ClickHouseConfig) {
  const key = `${config.host}:${config.port}:${config.username}`;
  if (!clientMap.has(key)) {
    clientMap.set(key, createClient(config));
  }
  return clientMap.get(key)!;
}
```

---

### Phase 3: Query Optimization

#### 3.1 Combine Permission Queries ✅ DO THIS

**File:** `src/lib/clickhouse/grants.ts` or route files

**Current:** 2-3 sequential queries (roles → check → list)

**Improved:** Merge into single query with CTE

```typescript
const combinedQuery = `
  WITH roles AS (
    SELECT granted_role_name FROM system.grants WHERE user_name = {user:String}
  )
  SELECT name, 1 as access_level
  FROM system.databases
  WHERE 'default' IN (SELECT granted_role_name FROM roles)
     OR exists(SELECT 1 FROM system.grants WHERE user_name = {user:String} AND granted_role_name = 'default')
  ORDER BY name
`;
```

#### 3.2 Cursor Pagination ❌ SKIP

**Reason:** The query route executes **arbitrary user SQL**. Cursor-based pagination requires knowing sort columns at query time, which is impossible for arbitrary queries.

**Note:** OFFSET pagination is the correct approach for SQL editor. For Discover page, time-based chunking already works effectively.

#### 3.3 Parallel Chunk Fetching ❌ SKIP

**Reason:** `stream.ts` uses async generator for streaming with backpressure. Parallelizing would break streaming and cause memory spikes.

---

### Phase 4: Monitoring Optimizations ✅ PARTIAL

#### 4.1 Batch Monitoring Queries

**Opportunity:** Some of the 18 queries read from the same system table (`system.asynchronous_metric_log`). Consider combining queries that fetch from the same table.

**File:** `src/lib/clickhouse/monitoring/queries.ts`

```typescript
// Before: separate queries
const memoryQuery = `SELECT ... from system.metric_log WHERE metric = 'Memory'`;
const cpuQuery = `SELECT ... from system.metric_log WHERE metric = 'CPU'`;

// After: single query
const combinedQuery = `
  SELECT
    metric,
    toStartOfInterval(event_time, INTERVAL {rounding:UInt32} SECOND) as t,
    any(value) as value
  FROM system.metric_log
  WHERE metric IN ('Memory', 'CPU', ...)
  GROUP BY metric, t
`;
```

#### 4.2 Cluster Deduplication ❌ SKIP

**Reason:** Already implemented in `src/lib/clickhouse/cluster.ts` via `cachedClusterName`.

---

## Testing Plan

### Unit Tests

- Cache hit/miss behavior with lru-cache
- Cache key uniqueness for different users
- Monitoring cache vs incremental updates

### Integration Tests

- API response times with/without cache
- RBAC: user with different roles gets different cached data

---

## Success Metrics

| Metric                | Current       | Target           |
| --------------------- | ------------- | ---------------- |
| Metadata API response | ~200-500ms    | <50ms (cached)   |
| Dashboard refresh     | ~2-5s         | <1s (cached)     |
| ClickHouse queries    | 1 per request | 60-80% reduction |

---

## Dependencies

- `bun add lru-cache`

---

## Summary

| Phase                        | Status     | Action                                                |
| ---------------------------- | ---------- | ----------------------------------------------------- |
| Phase 1: Caching             | ✅ Done    | LRU caching with per-user keys, Cache-Control headers |
| Phase 2: Client Pool         | ❌ Skip    | Already handled by `@clickhouse/client`               |
| Phase 3.1: Combine grants    | ✅ Proceed | Merge into single CTE query                           |
| Phase 3.2: Cursor pagination | ❌ Skip    | Not viable for arbitrary SQL                          |
| Phase 3.3: Parallel chunks   | ❌ Skip    | Breaks streaming                                      |
| Phase 4.1: Batch monitoring  | ✅ Proceed | Combine queries from same table                       |
| Phase 4.2: Cluster dedup     | ❌ Skip    | Already done                                          |
