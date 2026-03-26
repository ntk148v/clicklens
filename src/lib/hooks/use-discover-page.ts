"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { parseNDJSONStream } from "@/lib/streams/ndjson-parser";
import { MetadataCache } from "@/lib/clickhouse/metadata-cache";
import { useQueryStore } from "@/stores/discover/query-store";
import { createDiscoverDataStore } from "@/stores/discover/data-store";
import type {
  TableSchema,
  DiscoverRow,
  TimeRange,
  ColumnMetadata,
  TimeColumnCandidate,
  FlexibleTimeRange,
} from "@/lib/types/discover";
import {
  getFlexibleRangeFromEnum,
  getMinTimeFromRange,
} from "@/lib/types/discover";

const COLUMN_PREFS_PREFIX = "clicklens_discover_columns_";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_COLUMN_COUNT = 10;

interface CacheMetadata {
  isCached: boolean;
  cacheAge: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}

interface CacheTrackingState {
  totalHits: number;
  totalMisses: number;
  lastQueryKey: string | null;
  lastCacheTimestamp: number | null;
}

const VALID_RELATIVE_RANGES = new Set([
  "5m",
  "15m",
  "30m",
  "1h",
  "3h",
  "6h",
  "12h",
  "24h",
  "3d",
  "7d",
]);

function parseTimeRangeFromURL(
  params: URLSearchParams,
): FlexibleTimeRange | null {
  const t = params.get("t");
  if (t && VALID_RELATIVE_RANGES.has(t)) {
    return getFlexibleRangeFromEnum(t as TimeRange);
  }

  const start = params.get("start");
  const end = params.get("end");
  if (start) {
    const from = start;
    const to = end || "now";
    try {
      const fromDate = new Date(from);
      const toDate = to === "now" ? new Date() : new Date(to);
      if (isNaN(fromDate.getTime())) return null;
      return {
        type: "absolute",
        from,
        to,
        label: `${format(fromDate, "MMM d, HH:mm")} to ${format(toDate, "MMM d, HH:mm")}`,
      };
    } catch {
      return null;
    }
  }

  return null;
}

function loadColumnPrefs(
  db: string,
  table: string,
): { columns: string[]; timeColumn: string } | null {
  try {
    const raw = localStorage.getItem(`${COLUMN_PREFS_PREFIX}${db}.${table}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveColumnPrefs(
  db: string,
  table: string,
  columns: string[],
  timeColumn: string,
): void {
  try {
    localStorage.setItem(
      `${COLUMN_PREFS_PREFIX}${db}.${table}`,
      JSON.stringify({ columns, timeColumn }),
    );
  } catch {
  }
}

export interface DiscoverPageState {
  databases: string[];
  tables: { name: string; engine: string }[];
  selectedDatabase: string;
  selectedTable: string;
  schema: TableSchema | null;
  schemaLoading: boolean;
  selectedColumns: string[];
  selectedTimeColumn: string;
  customFilter: string;
  appliedFilter: string;
  isQueryDirty: boolean;
  flexibleRange: FlexibleTimeRange;
  activeMinTime: string | undefined;
  activeMaxTime: string | undefined;
  refreshInterval: number;
  rows: DiscoverRow[];
  totalHits: number;
  histogramData: { time: string; count: number }[];
  isLoading: boolean;
  histLoading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  sorting: import("@tanstack/react-table").SortingState;
  groupBy: string[];
  cacheMetadata?: CacheMetadata;
}

export interface DiscoverPageActions {
  setSelectedDatabase: (db: string) => void;
  handleTableChange: (table: string) => void;
  setSelectedColumns: (cols: string[]) => void;
  setSelectedTimeColumn: (col: string) => void;
  setCustomFilter: (filter: string) => void;
  setFlexibleRange: (range: FlexibleTimeRange) => void;
  setRefreshInterval: (interval: number) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  handleSearch: (filterOverride?: string | unknown) => void;
  handleHistogramBarClick: (startTime: string, endTime?: string) => void;
  cancelQuery: () => void;
  resetColumns: () => void;
  filterForValue: (column: string, value: unknown) => void;
  filterOutValue: (column: string, value: unknown) => void;
  setSorting: import("@tanstack/react-table").OnChangeFn<import("@tanstack/react-table").SortingState>;
  setGroupBy: (groupBy: string[]) => void;
}

const dataStore = createDiscoverDataStore();

export function useDiscoverPage(): DiscoverPageState & DiscoverPageActions {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hydratedRef = useRef(false);

  const queryStore = useQueryStore();
  const dataState = dataStore();

  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<{ name: string; engine: string }[]>([]);
  const [selectedDatabase, setSelectedDatabaseRaw] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const schemaCache = useMemo(() => new MetadataCache(), []);

  const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | undefined>();
  const cacheTrackingRef = useRef<CacheTrackingState>({
    totalHits: 0,
    totalMisses: 0,
    lastQueryKey: null,
    lastCacheTimestamp: null,
  });

  const dataAbortRef = useRef<AbortController | null>(null);
  const histAbortRef = useRef<AbortController | null>(null);

  const { activeMinTime, activeMaxTime } = useMemo(() => {
    if (queryStore.flexibleRange.type === "absolute") {
      return {
        activeMinTime: queryStore.flexibleRange.from,
        activeMaxTime:
          queryStore.flexibleRange.to === "now" ? undefined : queryStore.flexibleRange.to,
      };
    }
    const rangeKey = queryStore.flexibleRange.from.replace("now-", "") as TimeRange;
    const minDate = getMinTimeFromRange(rangeKey);
    return {
      activeMinTime: minDate ? minDate.toISOString() : undefined,
      activeMaxTime: undefined,
    };
  }, [queryStore.flexibleRange]);

  const setSelectedColumns = useCallback(
    (cols: string[]) => {
      queryStore.setSelectedColumns(cols);
      if (selectedDatabase && selectedTable) {
        saveColumnPrefs(
          selectedDatabase,
          selectedTable,
          cols,
          queryStore.selectedTimeColumn,
        );
      }
    },
    [selectedDatabase, selectedTable, queryStore],
  );

  const setSelectedTimeColumn = useCallback(
    (col: string) => {
      queryStore.setSelectedTimeColumn(col);
      if (selectedDatabase && selectedTable) {
        saveColumnPrefs(selectedDatabase, selectedTable, queryStore.selectedColumns, col);
      }
    },
    [selectedDatabase, selectedTable, queryStore],
  );

  const setGroupBy = useCallback((newGroupBy: string[]) => {
    queryStore.setGroupBy(newGroupBy);

    const hasCount = queryStore.selectedColumns.includes("count");
    const hasGrouping = newGroupBy.length > 0;

    if (hasGrouping && !hasCount) {
      queryStore.setSelectedColumns([...queryStore.selectedColumns, "count"]);
    } else if (!hasGrouping && hasCount) {
      queryStore.setSelectedColumns(queryStore.selectedColumns.filter((c) => c !== "count"));
    }
  }, [queryStore]);

  const cancelQuery = useCallback(() => {
    dataAbortRef.current?.abort();
    dataAbortRef.current = null;
    histAbortRef.current?.abort();
    histAbortRef.current = null;
    dataStore.getState().setDataLoading(false);
    dataStore.getState().setHistogramLoading(false);
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedDatabase || !selectedTable) return;

    dataAbortRef.current?.abort();
    const controller = new AbortController();
    dataAbortRef.current = controller;

    dataStore.getState().setDataLoading(true);
    dataStore.getState().setError(null);
    dataStore.getState().setRows([]);

    try {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "data",
        limit: String(pageSize),
        offset: String(offset),
      });

      if (queryStore.selectedColumns.length > 0) {
        params.set("columns", queryStore.selectedColumns.join(","));
      }
      if (queryStore.selectedTimeColumn) {
        params.set("timeColumn", queryStore.selectedTimeColumn);
      }
      if (activeMinTime) {
        params.set("minTime", activeMinTime);
      }
      if (activeMaxTime) {
        params.set("maxTime", activeMaxTime);
      }
      if (queryStore.appliedFilter.trim()) {
        params.set("filter", queryStore.appliedFilter.trim());
      }
      if (queryStore.sorting.length > 0) {
        const sortStr = queryStore.sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
        params.set("orderBy", sortStr);
      }
      if (queryStore.groupBy.length > 0) {
        params.set("groupBy", queryStore.groupBy.join(","));
      }

      const res = await fetch(`/api/clickhouse/discover?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = res.statusText;
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch {
        }
        throw new Error(msg);
      }

      if (!res.body) throw new Error("No response body");

      await parseNDJSONStream<DiscoverRow>(
        res.body,
        {
          onMeta: (meta) => {
            if (typeof meta.totalHits === "number") {
              dataStore.getState().setTotalCount(meta.totalHits);
            }
          },
          onBatch: (batch) => {
            dataStore.getState().appendRows(batch);
          },
          onError: (errMsg) => {
            toast({
              variant: "destructive",
              title: "Stream Error",
              description: errMsg,
            });
          },
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch data";
      dataStore.getState().setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Query Error",
        description: errorMessage,
      });
    } finally {
      if (!controller.signal.aborted) {
        dataStore.getState().setDataLoading(false);
      }
    }
  }, [
    selectedDatabase,
    selectedTable,
    queryStore.selectedColumns,
    queryStore.selectedTimeColumn,
    activeMinTime,
    activeMaxTime,
    queryStore.appliedFilter,
    page,
    pageSize,
    queryStore.sorting,
    queryStore.groupBy,
  ]);

  const fetchHistogram = useCallback(async () => {
    if (!selectedDatabase || !selectedTable || !queryStore.selectedTimeColumn) {
      dataStore.getState().setHistogramData([]);
      return;
    }

    histAbortRef.current?.abort();
    const controller = new AbortController();
    histAbortRef.current = controller;

    dataStore.getState().setHistogramLoading(true);

    try {
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "histogram",
        timeColumn: queryStore.selectedTimeColumn,
      });

      if (activeMinTime) params.set("minTime", activeMinTime);
      if (activeMaxTime) params.set("maxTime", activeMaxTime);
      if (queryStore.appliedFilter.trim()) params.set("filter", queryStore.appliedFilter.trim());

      const res = await fetch(`/api/clickhouse/discover?${params}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (data.success && data.histogram) {
        dataStore.getState().setHistogramData(data.histogram);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to fetch histogram:", err);
    } finally {
      if (!controller.signal.aborted) {
        dataStore.getState().setHistogramLoading(false);
      }
    }
  }, [
    selectedDatabase,
    selectedTable,
    queryStore.selectedTimeColumn,
    activeMinTime,
    activeMaxTime,
    queryStore.appliedFilter,
  ]);

  const handleSearch = useCallback(
    (filterOverride?: string | unknown) => {
      const filterToApply =
        typeof filterOverride === "string" ? filterOverride : queryStore.customFilter;

      if (
        typeof filterOverride === "string" &&
        filterOverride !== queryStore.customFilter
      ) {
        queryStore.setQuery(filterOverride);
      }

      const queryKey = JSON.stringify({
        filter: filterToApply,
        flexibleRange: queryStore.flexibleRange,
        columns: queryStore.selectedColumns,
        timeColumn: queryStore.selectedTimeColumn,
        sorting: queryStore.sorting,
        groupBy: queryStore.groupBy,
      });

      const isFromCache =
        queryStore.lastExecutedParams !== null &&
        JSON.stringify(queryStore.lastExecutedParams) === queryKey;

      const now = Date.now();
      if (cacheTrackingRef.current.lastQueryKey !== queryKey) {
        cacheTrackingRef.current.lastQueryKey = queryKey;
        cacheTrackingRef.current.totalHits = 0;
        cacheTrackingRef.current.totalMisses = 0;
        cacheTrackingRef.current.lastCacheTimestamp = null;
      }

      if (isFromCache) {
        cacheTrackingRef.current.totalHits++;
      } else {
        cacheTrackingRef.current.totalMisses++;
        cacheTrackingRef.current.lastCacheTimestamp = now;
      }

      const cacheAge = cacheTrackingRef.current.lastCacheTimestamp
        ? now - cacheTrackingRef.current.lastCacheTimestamp
        : 0;

      const total = cacheTrackingRef.current.totalHits + cacheTrackingRef.current.totalMisses;
      const hitRate = total === 0 ? 0 : Math.round((cacheTrackingRef.current.totalHits / total) * 100);

      setCacheMetadata({
        isCached: isFromCache,
        cacheAge,
        hitRate,
        totalHits: cacheTrackingRef.current.totalHits,
        totalMisses: cacheTrackingRef.current.totalMisses,
      });

      queryStore.markClean();

      queryStore.setAppliedFilter(filterToApply);
      if (page !== 1) {
        setPage(1);
      } else if (filterToApply === queryStore.appliedFilter) {
        fetchData();
        fetchHistogram();
      }
    },
    [
      page,
      fetchData,
      fetchHistogram,
      queryStore,
    ],
  );

  const handleHistogramBarClick = useCallback(
    (startTime: string, endTime?: string) => {
      if (!endTime) return;
      const fromDate = new Date(startTime);
      const toDate = new Date(endTime);

      queryStore.setTimeRange({
        type: "absolute",
        from: startTime,
        to: endTime,
        label: `${format(fromDate, "MMM d, HH:mm")} to ${format(toDate, "MMM d, HH:mm")}`,
      });
    },
    [queryStore],
  );

  const setSelectedDatabase = useCallback((db: string) => {
    setSelectedDatabaseRaw(db);
    setSelectedTable("");
    setSchema(null);
    dataStore.getState().setRows([]);
    dataStore.getState().setHistogramData([]);
    setTables([]);
  }, []);

  const handleTableChange = useCallback((table: string) => {
    setSelectedTable(table);
    setSchema(null);
    queryStore.setSelectedColumns([]);
    dataStore.getState().setRows([]);
    dataStore.getState().setHistogramData([]);
    queryStore.setQuery("");
    queryStore.setAppliedFilter("");
    queryStore.setSort([]);
    queryStore.setGroupBy([]);
  }, [queryStore]);

  const buildFilterClause = useCallback(
    (column: string, value: unknown, operator: "=" | "!="): string => {
      if (value === null || value === undefined) {
        return operator === "=" ? `${column} IS NULL` : `${column} IS NOT NULL`;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return `${column} ${operator} ${value}`;
      }
      const escaped = String(value).replace(/'/g, "\\'");
      return `${column} ${operator} '${escaped}'`;
    },
    [],
  );

  const filterForValue = useCallback(
    (column: string, value: unknown) => {
      const clause = buildFilterClause(column, value, "=");
      const newFilter = queryStore.customFilter.trim()
        ? `${queryStore.customFilter.trim()} AND ${clause}`
        : clause;
      queryStore.setQuery(newFilter);
      handleSearch(newFilter);
    },
    [buildFilterClause, handleSearch, queryStore],
  );

  const filterOutValue = useCallback(
    (column: string, value: unknown) => {
      const clause = buildFilterClause(column, value, "!=");
      const newFilter = queryStore.customFilter.trim()
        ? `${queryStore.customFilter.trim()} AND ${clause}`
        : clause;
      queryStore.setQuery(newFilter);
      handleSearch(newFilter);
    },
    [buildFilterClause, handleSearch, queryStore],
  );

  const resetColumns = useCallback(() => {
    if (!schema) return;
    const defaultCols = schema.columns
      .slice(0, DEFAULT_COLUMN_COUNT)
      .map((c: ColumnMetadata) => c.name);
    queryStore.setSelectedColumns(defaultCols);

    if (selectedDatabase && selectedTable) {
      try {
        localStorage.removeItem(
          `${COLUMN_PREFS_PREFIX}${selectedDatabase}.${selectedTable}`,
        );
      } catch {
      }
    }
  }, [schema, selectedDatabase, selectedTable, queryStore]);

  useEffect(() => {
    if (selectedDatabase && selectedTable) {
      const cacheKey = `${selectedDatabase}.${selectedTable}`;
      schemaCache.invalidate(cacheKey);
    }
  }, [selectedDatabase, selectedTable, schemaCache]);

  useEffect(() => {
    const urlDb = searchParams.get("db");
    const urlTable = searchParams.get("table");
    const urlFilter = searchParams.get("filter");
    const urlPage = searchParams.get("page");
    const urlTimeRange = parseTimeRangeFromURL(searchParams);

    const loadDatabases = async () => {
      try {
        const res = await fetch("/api/clickhouse/databases");
        const data = await res.json();
        if (data.success && data.data) {
          const dbNames = data.data.map((d: { name: string }) => d.name);
          setDatabases(dbNames);

          if (urlDb && dbNames.includes(urlDb)) {
            setSelectedDatabaseRaw(urlDb);
          } else if (dbNames.includes("default")) {
            setSelectedDatabaseRaw("default");
          } else if (dbNames.length > 0) {
            setSelectedDatabaseRaw(dbNames[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load databases:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load databases",
        });
      }
    };

    if (urlTable) setSelectedTable(urlTable);
    if (urlFilter) {
      queryStore.setQuery(urlFilter);
      queryStore.setAppliedFilter(urlFilter);
    }
    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p > 0) setPage(p);
    }
    if (urlTimeRange) queryStore.setTimeRange(urlTimeRange);

    loadDatabases().then(() => {
      hydratedRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDatabase) {
      setTables([]);
      return;
    }

    const loadTables = async () => {
      try {
        const res = await fetch(
          `/api/clickhouse/tables?database=${encodeURIComponent(selectedDatabase)}`,
        );
        const data = await res.json();
        if (data.success && data.data) {
          setTables(
            data.data.map((t: { name: string; engine: string }) => ({
              name: t.name,
              engine: t.engine,
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load tables:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load tables",
        });
      }
    };
    loadTables();

    setSelectedTable("");
    setSchema(null);
    dataStore.getState().setRows([]);
    dataStore.getState().setHistogramData([]);
  }, [selectedDatabase]);

  useEffect(() => {
    if (!selectedDatabase || !selectedTable) {
      setSchema(null);
      return;
    }

    const cacheKey = `${selectedDatabase}.${selectedTable}`;

    const loadSchema = async () => {
      setSchemaLoading(true);
      try {
        const fetchSchema = async () => {
          const res = await fetch(
            `/api/clickhouse/schema/table-columns?database=${encodeURIComponent(selectedDatabase)}&table=${encodeURIComponent(selectedTable)}`,
          );
          const data = await res.json();
          if (data.success && data.data) {
            return data.data;
          } else if (data.error) {
            throw new Error(data.error.userMessage || data.error);
          }
          throw new Error("Failed to load schema");
        };

        const tableSchema = await schemaCache.getOrFetch(cacheKey, fetchSchema);
        applySchema(tableSchema);
      } catch (err) {
        console.error("Failed to load schema:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to load table schema",
        });
        setSchema(null);
      } finally {
        setSchemaLoading(false);
      }
    };
    loadSchema();

    function applySchema(tableSchema: TableSchema) {
      setSchema(tableSchema);

      const prefs = loadColumnPrefs(selectedDatabase, selectedTable);
      if (prefs) {
        const validCols = prefs.columns.filter((c: string) =>
          tableSchema.columns.some((sc: ColumnMetadata) => sc.name === c),
        );
        queryStore.setSelectedColumns(
          validCols.length > 0
            ? validCols
            : tableSchema.columns
                .slice(0, DEFAULT_COLUMN_COUNT)
                .map((c: ColumnMetadata) => c.name),
        );

        const timeValid = tableSchema.timeColumns.some(
          (tc: TimeColumnCandidate) => tc.name === prefs.timeColumn,
        );
        if (timeValid) {
          queryStore.setSelectedTimeColumn(prefs.timeColumn);
        } else {
          setDefaultTimeColumn(tableSchema);
        }
      } else {
        queryStore.setSelectedColumns(
          tableSchema.columns
            .slice(0, DEFAULT_COLUMN_COUNT)
            .map((c: ColumnMetadata) => c.name),
        );
        setDefaultTimeColumn(tableSchema);
      }

      setSchemaLoading(false);
    }

    function setDefaultTimeColumn(tableSchema: TableSchema) {
      const primaryDateTime = tableSchema.timeColumns.find(
        (tc: TimeColumnCandidate) =>
          tc.isPrimary &&
          (tc.type.startsWith("DateTime") || tc.type.startsWith("DateTime64")),
      );
      if (primaryDateTime) {
        queryStore.setSelectedTimeColumn(primaryDateTime.name);
        return;
      }

      const primary = tableSchema.timeColumns.find(
        (tc: TimeColumnCandidate) => tc.isPrimary,
      );
      if (primary) {
        queryStore.setSelectedTimeColumn(primary.name);
        return;
      }

      const anyDateTime = tableSchema.timeColumns.find(
        (tc: TimeColumnCandidate) =>
          tc.type.startsWith("DateTime") || tc.type.startsWith("DateTime64"),
      );
      if (anyDateTime) {
        queryStore.setSelectedTimeColumn(anyDateTime.name);
        return;
      }

      if (tableSchema.timeColumns.length > 0) {
        queryStore.setSelectedTimeColumn(tableSchema.timeColumns[0].name);
      } else {
        queryStore.setSelectedTimeColumn("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase, selectedTable]);

  useEffect(() => {
    if (schema) fetchData();
  }, [schema, fetchData]);

  useEffect(() => {
    if (schema) fetchHistogram();
  }, [schema, fetchHistogram]);

  useEffect(() => {
    return () => {
      dataAbortRef.current?.abort();
      histAbortRef.current?.abort();
    };
  }, []);

  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (selectedDatabase) params.set("db", selectedDatabase);
      if (selectedTable) params.set("table", selectedTable);
      if (queryStore.appliedFilter) params.set("filter", queryStore.appliedFilter);

      if (queryStore.flexibleRange.type === "relative") {
        const rangeKey = queryStore.flexibleRange.from.replace("now-", "");
        params.set("t", rangeKey);
      } else {
        params.set("start", queryStore.flexibleRange.from);
        if (queryStore.flexibleRange.to !== "now") {
          params.set("end", queryStore.flexibleRange.to);
        }
      }

      if (page > 1) params.set("page", String(page));

      const newSearch = params.toString();
      const currentSearch = searchParams.toString();
      if (newSearch !== currentSearch) {
        router.replace(`${pathname}?${newSearch}`, { scroll: false });
      }
    }, 300);

    return () => {
      if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
    };
  }, [
    selectedDatabase,
    selectedTable,
    queryStore.appliedFilter,
    queryStore.flexibleRange,
    page,
    pathname,
    router,
    searchParams,
  ]);

  const setSorting = useCallback(
    (updaterOrValue: import("@tanstack/react-table").Updater<import("@tanstack/react-table").SortingState>) => {
      if (typeof updaterOrValue === "function") {
        queryStore.setSort(updaterOrValue(queryStore.sorting));
      } else {
        queryStore.setSort(updaterOrValue);
      }
    },
    [queryStore],
  );

  return {
    databases,
    tables,
    selectedDatabase,
    selectedTable,
    schema,
    schemaLoading,
    selectedColumns: queryStore.selectedColumns,
    selectedTimeColumn: queryStore.selectedTimeColumn,
    customFilter: queryStore.customFilter,
    appliedFilter: queryStore.appliedFilter,
    isQueryDirty: queryStore.isQueryDirty,
    flexibleRange: queryStore.flexibleRange,
    activeMinTime,
    activeMaxTime,
    refreshInterval,
    rows: dataState.rows,
    totalHits: dataState.totalCount,
    histogramData: dataState.histogramData,
    isLoading: dataState.loading.data,
    histLoading: dataState.loading.histogram,
    error: dataState.error,
    page,
    pageSize,
    sorting: queryStore.sorting,
    groupBy: queryStore.groupBy,
    cacheMetadata,

    setSelectedDatabase,
    handleTableChange,
    setSelectedColumns,
    setSelectedTimeColumn,
    setCustomFilter: queryStore.setQuery,
    setFlexibleRange: queryStore.setTimeRange,
    setRefreshInterval,
    setPage,
    setPageSize,
    handleSearch,
    handleHistogramBarClick,
    cancelQuery,
    resetColumns,
    filterForValue,
    filterOutValue,
    setSorting,
    setGroupBy,
  };
}
