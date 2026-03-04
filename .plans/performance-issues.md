# Performance Issues — ClickLens Audit ✅ DONE

> **Date:** 2026-03-04
> **Scope:** Full source review of ClickHouse client, React hooks, Zustand stores, grid components, streaming, and bundle composition.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 7     |
| Medium   | 9     |
| Low      | 6     |
| **Total** | **25** |

---

## Critical

### PERF-01: New ClickHouse Client Created Per Request — No Connection Pooling ✅ DONE

- **File:** `src/lib/clickhouse/grants.ts` (lines 25–26, 61–62, 89)
- **Description:** `createClient()` instantiates a new `ClickHouseClientImpl` (and a new `@clickhouse/client` instance) on every invocation, discarding all HTTP keep-alive connection reuse.
- **Remediation:** Create a client registry/cache keyed by `(host, port, username)`. Use a module-level singleton for the lens client.
- **Status:** Fixed in commit 503a882. Added TTL-based client cache with LRU eviction in `client.ts`.

```typescript
const clientCache = new Map<string, ClickHouseClient>();
function getOrCreateClient(config: ClickHouseConfig): ClickHouseClient {
  const key = `${config.host}:${config.port}:${config.username}`;
  if (!clientCache.has(key)) {
    clientCache.set(key, new ClickHouseClientImpl(config));
  }
  return clientCache.get(key)!;
}
```

### PERF-02: `useIncrementalData` — Stale Closure Over Unstable `params` Object ✅ DONE

- **File:** `src/lib/hooks/use-incremental-data.ts` (lines 90–109, 114–148)
- **Description:** `params` is an object in the dependency array of `reload`/`fetchNew` callbacks. New reference every render causes recreations, breaking memoization and risking infinite re-fetch loops in `useEffect`.
- **Remediation:** Serialize `params` to a stable key (`JSON.stringify`) and use a ref for the actual object:
- **Status:** Fixed in commit 503a882. Using `paramsKey` + `paramsRef` pattern.

```typescript
const paramsRef = useRef(params);
paramsRef.current = params;
const paramsKey = JSON.stringify(params);

const reload = useCallback(async () => {
  const items = await fetchFn(paramsRef.current);
}, [fetchFn, paramsKey, getTimestamp]);
```

### PERF-03: `useSettings` — No Debounce on Search, API Request Per Keystroke ✅ DONE

- **File:** `src/lib/hooks/use-settings.ts` (lines 34–59)
- **Description:** `fetchData` depends on `search` and is called via `useEffect` on every change. Each keystroke fires a ClickHouse settings query that may scan large system tables.
- **Remediation:** Add 300–500ms debounce on the `search` parameter.
- **Status:** Fixed in commit 503a882. Added 350ms debounce.

---

## High

### PERF-04: `useDiscoverState` — Monolithic State Hook Causes Excessive Re-renders ⏳ DEFERRED

- **File:** `src/lib/hooks/use-discover-state.ts` (lines 153–895)
- **Description:** Single hook manages ~20 independent `useState` variables, returning 30+ values as a flat object. Any state change (e.g., `page`) re-renders everything including histogram, column selector, etc.
- **Remediation:** Split into focused hooks (`useDiscoverSource`, `useDiscoverQuery`, `useDiscoverResults`, `useDiscoverTimeRange`) or migrate to Zustand with fine-grained selectors.
- **Status:** Deferred — large refactor, needs dedicated sprint.

### PERF-05: `useDiscoverState` — `isQueryDirty` Uses JSON.stringify Per Render ⏳ DEFERRED

- **File:** `src/lib/hooks/use-discover-state.ts` (lines 213–228)
- **Description:** `JSON.stringify` on `flexibleRange` and `selectedColumns` runs in `useMemo` on every render. Expensive for large column arrays.
- **Remediation:** Store serialized strings in `lastExecutedRef` and compare primitives instead.
- **Status:** Deferred — depends on PERF-04 refactor.

### PERF-06: No Row Virtualization in DiscoverGrid and ResultGrid ⏳ DEFERRED

- **Files:** `src/components/discover/DiscoverGrid.tsx`, `src/components/sql/ResultGrid.tsx`
- **Description:** Both grids render ALL rows in the DOM at once. 100+ rows with 10+ columns means thousands of DOM nodes. `@tanstack/react-virtual` is already a dependency but unused.
- **Remediation:** Implement virtual scrolling:

```typescript
const rowVirtualizer = useVirtualizer({
  count: table.getRowModel().rows.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 35,
  overscan: 10,
});
```

- **Status:** Deferred — needs visual regression testing.

### PERF-07: No Code Splitting for Heavy Libraries ⏳ DEFERRED

- **Files:** `package.json`, various component imports
- **Description:** Only `SqlEditor` uses `next/dynamic`. Heavy libraries loaded eagerly: `recharts` (~200KB gzipped), `@xyflow/react` + `dagre`, `react-day-picker`, and 6 `@codemirror/*` packages.
- **Remediation:** Use `next/dynamic({ ssr: false })` for:
  - Recharts chart components
  - `@xyflow/react` dependency graph
  - `react-day-picker` date picker
  - All client-only heavy components
- **Status:** Deferred — needs build verification with next/dynamic.

### PERF-08: `useLogStream` — AbortController Not Cleaned on Unmount (Memory Leak) ✅ DONE

- **File:** `src/lib/hooks/use-log-stream.ts` (lines 39–50)
- **Description:** `abortControllerRef` only cancels previous requests when new ones start, not on unmount. Streams continue in background after component unmounts.
- **Remediation:**

```typescript
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

- **Status:** Fixed in commit 42ce836.

### PERF-09: `useQueryData` — Missing AbortController and Visibility Handling ✅ DONE

- **File:** `src/lib/hooks/use-query-analytics.ts` (lines 27–77)
- **Description:** No `AbortController` for cancellation and no `document.hidden` check for auto-refresh. Stale fetches race, and background tabs poll needlessly.
- **Remediation:** Add `AbortController` pattern and `document.hidden` check like `useMonitoringData` already does.
- **Status:** Fixed in commit 42ce836.

### PERF-10: Sequential Count + Data Queries in Streaming (Waterfall) ✅ DONE

- **File:** `src/lib/clickhouse/stream.ts` (lines 95–107)
- **Description:** Count query executes sequentially BEFORE data chunk fetching. Users wait for `SELECT count(*)` to complete before seeing any data. Expensive for large tables.
- **Remediation:** Run count and first data chunk in parallel with `Promise.all`, or yield data immediately and emit count as trailing metadata.
- **Status:** Fixed in commit 42ce836.

---

## Medium

### PERF-11: Global Cluster Cache with No TTL Invalidation ✅ DONE

- **File:** `src/lib/clickhouse/cluster.ts` (line 9)
- **Description:** `cachedClusterName` persists indefinitely until explicit reset. Cluster topology changes are never reflected.
- **Remediation:** Add TTL (5 minutes) or use the `lru-cache` package already in dependencies.
- **Status:** Fixed in commit 733ca31. Added 5-minute TTL.

### PERF-12: `MetricsGrid` — Chart Data Transforms Not Memoized ⏳ DEFERRED

- **File:** `src/components/monitoring/dashboard/MetricsGrid.tsx` (lines 26–40, 51–85)
- **Description:** `transformToChartData()` and `transformToSingleSeries()` create new arrays every render, forcing Recharts full re-renders.
- **Remediation:** Memoize transformations with `useMemo` or move into parent with stable references.
- **Status:** Deferred — needs visual regression testing.

### PERF-13: `OverviewTab` — Chart Config Arrays Recreated Every Render ⏳ DEFERRED

- **File:** `src/components/monitoring/overview-tab.tsx` (lines 135–160)
- **Description:** Three large chart configuration arrays created as inline variables (not memoized). New references force `MetricsGrid` re-renders even when data is unchanged.
- **Remediation:** Wrap with `useMemo(() => ..., [data])`.
- **Status:** Deferred — needs visual regression testing.

### PERF-14: `DiscoverGrid` — `rows` in `useMemo` Dependencies Unnecessarily ⏳ DEFERRED

- **File:** `src/components/discover/DiscoverGrid.tsx` (line 233)
- **Description:** `tableColumns` `useMemo` includes `rows` as dependency (only used as fallback for column names). Since `rows` changes every fetch, all column definitions recreate, resetting TanStack Table internal state.
- **Remediation:** Remove `rows` from deps. Use schema metadata for fallback column names.
- **Status:** Deferred — needs visual regression testing.

### PERF-15: `MetricChart` — `formatValue` Not Memoized ✅ DONE

- **File:** `src/components/monitoring/metric-chart.tsx` (lines 136–153)
- **Description:** `formatValue` defined as plain function inside component, creating new reference per render. Passed to Recharts `Tooltip` and `YAxis`, causing sub-component re-renders.
- **Remediation:** Wrap with `useCallback` or define outside component (only depends on `isBytes` prop).
- **Status:** Fixed in commit 733ca31. Memoized with useCallback.

### PERF-16: `useSystemLogs` — Missing AbortController ✅ DONE

- **File:** `src/lib/hooks/use-logs.ts` (lines 58–96)
- **Description:** No `AbortController` means rapid filter changes cause racing requests. Last-to-resolve wins, which may not be last-submitted.
- **Remediation:** Add `AbortController` pattern.
- **Status:** Fixed in commit 42ce836.

### PERF-17: Recharts Loaded Eagerly — No Lazy Loading ⏳ DEFERRED

- **File:** `src/components/monitoring/metric-chart.tsx` (lines 3–9)
- **Description:** Recharts (~200KB) loaded on every monitoring page without lazy loading.
- **Remediation:** Use `next/dynamic` to lazy-load chart components. Consider lighter alternatives like `uPlot` for time-series data.
- **Status:** Deferred — needs build verification.

### PERF-18: `useDiscoverState` — URL Sync Not Debounced ✅ DONE

- **File:** `src/lib/hooks/use-discover-state.ts` (lines 816–850)
- **Description:** Every state change immediately triggers `router.replace()`, causing URL history pollution and unnecessary Next.js re-renders during rapid interactions.
- **Remediation:** Debounce URL update by 300ms with `setTimeout` + cleanup.
- **Status:** Fixed in commit 733ca31. Debounced by 300ms.

### PERF-19: `SqlEditor` — `getFunctionCompletions()` Called Per Keystroke ⏳ DEFERRED

- **File:** `src/components/sql/SqlEditor.tsx` (lines 527, 733)
- **Description:** `getFunctionCompletions()` called on every completion trigger, potentially building a new array each time.
- **Remediation:** Cache result at module level — it's static data, compute once.
- **Status:** Deferred — needs editor testing.

---

## Low

### PERF-20: `tabs.ts` Store — Persist Serializes All Tabs on Every Update ⏳ DEFERRED

- **File:** `src/lib/store/tabs.ts` (lines 105–251)
- **Description:** Every tab update (including `isRunning` toggle) triggers `persist` middleware to serialize and write to `localStorage`.
- **Remediation:** Debounce persistence or use `skipHydration` + manual persistence on specific actions.
- **Status:** Deferred — low priority.

### PERF-21: `access.ts` Store — `Promise.all` Loses Partial Results on Error ✅ DONE

- **File:** `src/lib/store/access.ts` (lines 48–53)
- **Description:** If any of 4 parallel fetches fail, all data is lost.
- **Remediation:** Use `Promise.allSettled` to preserve partial results.
- **Status:** Fixed in commit 733ca31. Uses Promise.allSettled.

### PERF-22: `sql-browser.ts` — Column Cache Object Spread Growing ⏳ DEFERRED

- **File:** `src/lib/store/sql-browser.ts` (lines 282–287)
- **Description:** `columnsCache` uses object spread on every column fetch, shallow-copying an increasingly large object.
- **Remediation:** Use `immer` middleware or a `Map`.
- **Status:** Deferred — low priority.

### PERF-23: `MultiSeriesChart` — Memoization Ineffective Due to Parent ⏳ DEFERRED

- **File:** `src/components/monitoring/metric-chart.tsx` (lines 339–352)
- **Description:** `pivotedData` useMemo is correct but ineffective because the `data` prop from `MetricsGrid` is always a fresh array (see PERF-12).
- **Remediation:** Fix PERF-12 first to make this memoization effective.
- **Status:** Deferred — depends on PERF-12.

### PERF-24: `ResultGrid` — Synchronous Formatting of All Data on Copy/Download ⏳ DEFERRED

- **File:** `src/components/sql/ResultGrid.tsx` (lines 181–208)
- **Description:** For 10K+ rows, copy/download formats every cell synchronously on main thread, freezing UI.
- **Remediation:** Use Web Worker for large datasets or generate CSV in chunks via `requestIdleCallback`.
- **Status:** Deferred — low priority.

### PERF-25: `useDiscoverState` — Potential Double Fetch on Initial Load ⏳ DEFERRED

- **File:** `src/lib/hooks/use-discover-state.ts` (lines 798–805)
- **Description:** Schema load + URL hydration can trigger `fetchData` and `fetchHistogram` twice.
- **Remediation:** Use a single coordinating `useEffect` gated by a `hasInitialized` ref.
- **Status:** Deferred — low priority.

---

## Recommended Implementation Priority

### Phase 1 — High-Impact Server-Side (1–2 days)
1. **PERF-01** — Client connection pooling (biggest server-side win)
2. **PERF-10** — Parallel count + data streaming
3. **PERF-03** — Debounce settings search

### Phase 2 — Memory Leaks and Stability (1 day)
4. **PERF-08** — Fix log stream AbortController cleanup
5. **PERF-09** — Fix query analytics AbortController + visibility
6. **PERF-16** — Fix system logs AbortController

### Phase 3 — Client Rendering Performance (2–3 days)
7. **PERF-06** — Add virtual scrolling (already have dependency)
8. **PERF-04** — Split monolithic discover state hook
9. **PERF-02** — Fix useIncrementalData params stability
10. **PERF-12, PERF-13, PERF-14, PERF-15** — Memoization fixes

### Phase 4 — Bundle Size Optimization (1 day)
11. **PERF-07** — Code split heavy libraries
12. **PERF-17** — Lazy load Recharts

### Phase 5 — Polish (1 day)
13. **PERF-05, PERF-18, PERF-19** — Debounce and caching
14. **PERF-20 through PERF-25** — Low-priority fixes
