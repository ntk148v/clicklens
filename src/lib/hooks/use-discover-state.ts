"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { parseNDJSONStream } from "@/lib/streams/ndjson-parser";
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

// Valid relative time range values for URL param validation
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
    // localStorage may be full or unavailable
  }
}

export interface DiscoverState {
  // Source
  databases: string[];
  tables: { name: string; engine: string }[];
  selectedDatabase: string;
  selectedTable: string;

  // Schema
  schema: TableSchema | null;
  schemaLoading: boolean;

  // Query
  selectedColumns: string[];
  selectedTimeColumn: string;
  customFilter: string;
  appliedFilter: string;
  isQueryDirty: boolean;

  // Time range
  flexibleRange: FlexibleTimeRange;

  // Refresh
  refreshInterval: number;

  // Results
  rows: DiscoverRow[];
  totalHits: number;
  histogramData: { time: string; count: number }[];
  isLoading: boolean;
  histLoading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
}

export interface DiscoverActions {
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
}

export function useDiscoverState(): DiscoverState & DiscoverActions {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Track whether initial URL hydration has completed to avoid overwriting URL on mount
  const hydratedRef = useRef(false);

  // Source selection
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<{ name: string; engine: string }[]>([]);
  const [selectedDatabase, setSelectedDatabaseRaw] = useState("");
  const [selectedTable, setSelectedTable] = useState("");

  // Schema
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Schema cache: avoids re-fetching when switching back to a table
  const schemaCacheRef = useRef<Map<string, TableSchema>>(new Map());

  // Query
  const [selectedColumns, setSelectedColumnsRaw] = useState<string[]>([]);
  const [selectedTimeColumn, setSelectedTimeColumnRaw] = useState("");
  const [customFilter, setCustomFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");

  // Time range
  const [flexibleRange, setFlexibleRange] = useState<FlexibleTimeRange>(
    getFlexibleRangeFromEnum("1h"),
  );

  // Refresh
  const [refreshInterval, setRefreshInterval] = useState(0);

  // Results
  const [rows, setRows] = useState<DiscoverRow[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [histogramData, setHistogramData] = useState<
    { time: string; count: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Abort controllers for cancellation (P3)
  const dataAbortRef = useRef<AbortController | null>(null);
  const histAbortRef = useRef<AbortController | null>(null);

  // Track last-executed params for dirty detection (P4)
  const lastExecutedRef = useRef<{
    filter: string;
    flexibleRange: FlexibleTimeRange;
    columns: string[];
    timeColumn: string;
  } | null>(null);

  // Dirty state: true when user changed query params but hasn't re-executed (P4)
  const isQueryDirty = useMemo(() => {
    if (!lastExecutedRef.current || !schema) return false;
    const last = lastExecutedRef.current;
    return (
      last.filter !== customFilter ||
      JSON.stringify(last.flexibleRange) !== JSON.stringify(flexibleRange) ||
      JSON.stringify(last.columns) !== JSON.stringify(selectedColumns) ||
      last.timeColumn !== selectedTimeColumn
    );
  }, [customFilter, flexibleRange, selectedColumns, selectedTimeColumn, schema]);

  // Derived min/max times
  const { activeMinTime, activeMaxTime } = useMemo(() => {
    if (flexibleRange.type === "absolute") {
      return {
        activeMinTime: flexibleRange.from,
        activeMaxTime:
          flexibleRange.to === "now" ? undefined : flexibleRange.to,
      };
    }
    const rangeKey = flexibleRange.from.replace("now-", "") as TimeRange;
    const minDate = getMinTimeFromRange(rangeKey);
    return {
      activeMinTime: minDate ? minDate.toISOString() : undefined,
      activeMaxTime: undefined,
    };
  }, [flexibleRange]);

  // Persist column preferences when they change (P9)
  const setSelectedColumns = useCallback(
    (cols: string[]) => {
      setSelectedColumnsRaw(cols);
      if (selectedDatabase && selectedTable) {
        saveColumnPrefs(selectedDatabase, selectedTable, cols, selectedTimeColumn);
      }
    },
    [selectedDatabase, selectedTable, selectedTimeColumn],
  );

  const setSelectedTimeColumn = useCallback(
    (col: string) => {
      setSelectedTimeColumnRaw(col);
      if (selectedDatabase && selectedTable) {
        saveColumnPrefs(selectedDatabase, selectedTable, selectedColumns, col);
      }
    },
    [selectedDatabase, selectedTable, selectedColumns],
  );

  // Cancel any in-flight queries (P3)
  const cancelQuery = useCallback(() => {
    dataAbortRef.current?.abort();
    dataAbortRef.current = null;
    histAbortRef.current?.abort();
    histAbortRef.current = null;
    setIsLoading(false);
    setHistLoading(false);
  }, []);

  // -- Data fetching (with streaming + abort) --

  const fetchData = useCallback(async () => {
    if (!selectedDatabase || !selectedTable) return;

    // Abort previous in-flight request
    dataAbortRef.current?.abort();
    const controller = new AbortController();
    dataAbortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setRows([]);

    try {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "data",
        limit: String(pageSize),
        offset: String(offset),
      });

      if (selectedColumns.length > 0) {
        params.set("columns", selectedColumns.join(","));
      }
      if (selectedTimeColumn) {
        params.set("timeColumn", selectedTimeColumn);
      }
      if (activeMinTime) {
        params.set("minTime", activeMinTime);
      }
      if (activeMaxTime) {
        params.set("maxTime", activeMaxTime);
      }
      if (appliedFilter.trim()) {
        params.set("filter", appliedFilter.trim());
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
          // use statusText
        }
        throw new Error(msg);
      }

      if (!res.body) throw new Error("No response body");

      await parseNDJSONStream<DiscoverRow>(
        res.body,
        {
          onMeta: (meta) => {
            if (typeof meta.totalHits === "number") {
              setTotalHits(meta.totalHits);
            }
          },
          onBatch: (batch) => {
            setRows((prev) => [...prev, ...batch]);
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
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Query Error",
        description: errorMessage,
      });
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    selectedDatabase,
    selectedTable,
    selectedColumns,
    selectedTimeColumn,
    activeMinTime,
    activeMaxTime,
    appliedFilter,
    page,
    pageSize,
  ]);

  const fetchHistogram = useCallback(async () => {
    if (!selectedDatabase || !selectedTable || !selectedTimeColumn) {
      setHistogramData([]);
      return;
    }

    histAbortRef.current?.abort();
    const controller = new AbortController();
    histAbortRef.current = controller;

    setHistLoading(true);

    try {
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "histogram",
        timeColumn: selectedTimeColumn,
      });

      if (activeMinTime) params.set("minTime", activeMinTime);
      if (activeMaxTime) params.set("maxTime", activeMaxTime);
      if (appliedFilter.trim()) params.set("filter", appliedFilter.trim());

      const res = await fetch(`/api/clickhouse/discover?${params}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (data.success && data.histogram) {
        setHistogramData(data.histogram);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to fetch histogram:", err);
    } finally {
      if (!controller.signal.aborted) {
        setHistLoading(false);
      }
    }
  }, [
    selectedDatabase,
    selectedTable,
    selectedTimeColumn,
    activeMinTime,
    activeMaxTime,
    appliedFilter,
  ]);

  // -- Search execution --

  const handleSearch = useCallback(
    (filterOverride?: string | unknown) => {
      const filterToApply =
        typeof filterOverride === "string" ? filterOverride : customFilter;

      if (
        typeof filterOverride === "string" &&
        filterOverride !== customFilter
      ) {
        setCustomFilter(filterOverride);
      }

      // Snapshot executed state for dirty tracking
      lastExecutedRef.current = {
        filter: filterToApply,
        flexibleRange,
        columns: [...selectedColumns],
        timeColumn: selectedTimeColumn,
      };

      setAppliedFilter(filterToApply);
      if (page !== 1) {
        setPage(1);
      } else if (filterToApply === appliedFilter) {
        fetchData();
        fetchHistogram();
      }
    },
    [
      page,
      customFilter,
      appliedFilter,
      fetchData,
      fetchHistogram,
      flexibleRange,
      selectedColumns,
      selectedTimeColumn,
    ],
  );

  // -- Histogram bar click (zoom) --

  const handleHistogramBarClick = useCallback(
    (startTime: string, endTime?: string) => {
      if (!endTime) return;
      const fromDate = new Date(startTime);
      const toDate = new Date(endTime);

      setFlexibleRange({
        type: "absolute",
        from: startTime,
        to: endTime,
        label: `${format(fromDate, "MMM d, HH:mm")} to ${format(toDate, "MMM d, HH:mm")}`,
      });
    },
    [],
  );

  // -- Database change handler --

  const setSelectedDatabase = useCallback((db: string) => {
    setSelectedDatabaseRaw(db);
    setSelectedTable("");
    setSchema(null);
    setRows([]);
    setHistogramData([]);
    setTables([]);
  }, []);

  // -- Table change handler --

  const handleTableChange = useCallback((table: string) => {
    setSelectedTable(table);
    setSchema(null);
    setSelectedColumnsRaw([]);
    setRows([]);
    setHistogramData([]);
    setCustomFilter("");
    setAppliedFilter("");
  }, []);

  // -- Click-to-filter helpers (P2a) --

  const buildFilterClause = useCallback(
    (column: string, value: unknown, operator: "=" | "!="): string => {
      if (value === null || value === undefined) {
        return operator === "="
          ? `${column} IS NULL`
          : `${column} IS NOT NULL`;
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
      const newFilter = customFilter.trim()
        ? `${customFilter.trim()} AND ${clause}`
        : clause;
      setCustomFilter(newFilter);
      handleSearch(newFilter);
    },
    [customFilter, buildFilterClause, handleSearch],
  );

  const filterOutValue = useCallback(
    (column: string, value: unknown) => {
      const clause = buildFilterClause(column, value, "!=");
      const newFilter = customFilter.trim()
        ? `${customFilter.trim()} AND ${clause}`
        : clause;
      setCustomFilter(newFilter);
      handleSearch(newFilter);
    },
    [customFilter, buildFilterClause, handleSearch],
  );

  // -- Reset columns to schema defaults --

  const resetColumns = useCallback(() => {
    if (!schema) return;
    const defaultCols = schema.columns
      .slice(0, DEFAULT_COLUMN_COUNT)
      .map((c: ColumnMetadata) => c.name);
    setSelectedColumnsRaw(defaultCols);

    if (selectedDatabase && selectedTable) {
      try {
        localStorage.removeItem(
          `${COLUMN_PREFS_PREFIX}${selectedDatabase}.${selectedTable}`,
        );
      } catch {
        // ignore
      }
    }
  }, [schema, selectedDatabase, selectedTable]);

  // -- Side effects --

  // Load databases on mount + hydrate from URL (P1)
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

          // Hydrate database from URL, or fall back to "default"
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

    // Hydrate non-database URL state
    if (urlTable) setSelectedTable(urlTable);
    if (urlFilter) {
      setCustomFilter(urlFilter);
      setAppliedFilter(urlFilter);
    }
    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p > 0) setPage(p);
    }
    if (urlTimeRange) setFlexibleRange(urlTimeRange);

    loadDatabases().then(() => {
      hydratedRef.current = true;
    });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tables when database changes
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
    setRows([]);
    setHistogramData([]);
  }, [selectedDatabase]);

  // Load schema when table changes (with cache — P10)
  useEffect(() => {
    if (!selectedDatabase || !selectedTable) {
      setSchema(null);
      return;
    }

    const cacheKey = `${selectedDatabase}.${selectedTable}`;

    // Check cache first
    const cached = schemaCacheRef.current.get(cacheKey);
    if (cached) {
      applySchema(cached);
      return;
    }

    const loadSchema = async () => {
      setSchemaLoading(true);
      try {
        const res = await fetch(
          `/api/clickhouse/schema/table-columns?database=${encodeURIComponent(selectedDatabase)}&table=${encodeURIComponent(selectedTable)}`,
        );
        const data = await res.json();
        if (data.success && data.data) {
          schemaCacheRef.current.set(cacheKey, data.data);
          applySchema(data.data);
        } else if (data.error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: data.error.userMessage || data.error,
          });
          setSchema(null);
        }
      } catch (err) {
        console.error("Failed to load schema:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load table schema",
        });
      } finally {
        setSchemaLoading(false);
      }
    };
    loadSchema();

    function applySchema(tableSchema: TableSchema) {
      setSchema(tableSchema);

      // Restore from localStorage (P9) or fall back to defaults
      const prefs = loadColumnPrefs(selectedDatabase, selectedTable);
      if (prefs) {
        // Validate saved columns still exist in the schema
        const validCols = prefs.columns.filter((c: string) =>
          tableSchema.columns.some((sc: ColumnMetadata) => sc.name === c),
        );
        setSelectedColumnsRaw(
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
          setSelectedTimeColumnRaw(prefs.timeColumn);
        } else {
          setDefaultTimeColumn(tableSchema);
        }
      } else {
        setSelectedColumnsRaw(
          tableSchema.columns
            .slice(0, DEFAULT_COLUMN_COUNT)
            .map((c: ColumnMetadata) => c.name),
        );
        setDefaultTimeColumn(tableSchema);
      }

      setSchemaLoading(false);
    }

    function setDefaultTimeColumn(tableSchema: TableSchema) {
      const primary = tableSchema.timeColumns.find(
        (tc: TimeColumnCandidate) => tc.isPrimary,
      );
      if (primary) {
        setSelectedTimeColumnRaw(primary.name);
      } else if (tableSchema.timeColumns.length > 0) {
        setSelectedTimeColumnRaw(tableSchema.timeColumns[0].name);
      } else {
        setSelectedTimeColumnRaw("");
      }
    }
     
  }, [selectedDatabase, selectedTable]);

  // Fetch data when deps change
  useEffect(() => {
    if (schema) fetchData();
  }, [schema, fetchData]);

  // Fetch histogram when deps change (excluding pagination)
  useEffect(() => {
    if (schema) fetchHistogram();
  }, [schema, fetchHistogram]);

  // Abort on unmount
  useEffect(() => {
    return () => {
      dataAbortRef.current?.abort();
      histAbortRef.current?.abort();
    };
  }, []);

  // Sync state → URL (P1): update URL when key state changes
  useEffect(() => {
    if (!hydratedRef.current) return;

    const params = new URLSearchParams();
    if (selectedDatabase) params.set("db", selectedDatabase);
    if (selectedTable) params.set("table", selectedTable);
    if (appliedFilter) params.set("filter", appliedFilter);

    if (flexibleRange.type === "relative") {
      const rangeKey = flexibleRange.from.replace("now-", "");
      params.set("t", rangeKey);
    } else {
      params.set("start", flexibleRange.from);
      if (flexibleRange.to !== "now") {
        params.set("end", flexibleRange.to);
      }
    }

    if (page > 1) params.set("page", String(page));

    const newSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (newSearch !== currentSearch) {
      router.replace(`${pathname}?${newSearch}`, { scroll: false });
    }
  }, [
    selectedDatabase,
    selectedTable,
    appliedFilter,
    flexibleRange,
    page,
    pathname,
    router,
    searchParams,
  ]);

  return {
    // State
    databases,
    tables,
    selectedDatabase,
    selectedTable,
    schema,
    schemaLoading,
    selectedColumns,
    selectedTimeColumn,
    customFilter,
    appliedFilter,
    isQueryDirty,
    flexibleRange,
    refreshInterval,
    rows,
    totalHits,
    histogramData,
    isLoading,
    histLoading,
    error,
    page,
    pageSize,

    // Actions
    setSelectedDatabase,
    handleTableChange,
    setSelectedColumns,
    setSelectedTimeColumn,
    setCustomFilter,
    setFlexibleRange,
    setRefreshInterval,
    setPage,
    setPageSize,
    handleSearch,
    handleHistogramBarClick,
    cancelQuery,
    resetColumns,
    filterForValue,
    filterOutValue,
  };
}
