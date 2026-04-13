"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import { useQueryStore } from "@/stores/discover/query-store";
import { createDiscoverDataStore } from "@/stores/discover/data-store";
import { useDiscoverURL, parseTimeRangeFromURL } from "./use-discover-url";
import { useDiscoverSchema, loadColumnPrefs, saveColumnPrefs, removeColumnPrefs } from "./use-discover-schema";
import { useDiscoverFetch } from "./use-discover-fetch";
import { useDiscoverHistogram } from "./use-discover-histogram";
import { useDiscoverCacheTracking } from "./use-discover-cache-tracking";
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

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_COLUMN_COUNT = 10;

export interface CacheMetadata {
  isCached: boolean;
  cacheAge: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
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
  isApproximate: boolean;
  accuracy?: number;
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

  const hydratedRef = useRef(false);

  const queryStore = useQueryStore();
  const dataState = dataStore();

  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<{ name: string; engine: string }[]>([]);
  const [selectedDatabase, setSelectedDatabaseRaw] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const cancellationManager = useMemo(() => new QueryCancellationManager(), []);

  // Calculate active time bounds from flexible range
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

  // URL management hook
  const { urlParams, syncToURL } = useDiscoverURL({
    selectedDatabase,
    selectedTable,
    appliedFilter: queryStore.appliedFilter,
    flexibleRange: queryStore.flexibleRange,
    page,
  });

  // Schema management hook
  const {
    schema,
    schemaLoading,
    loadColumnPreferences,
    applyDefaultColumns,
    selectDefaultTimeColumn,
  } = useDiscoverSchema({
    selectedDatabase,
    selectedTable,
  });

  // Cache tracking hook
  const { cacheMetadata, trackQuery } = useDiscoverCacheTracking({
    lastExecutedParams: queryStore.lastExecutedParams,
  });

  // Data fetching hook
  const { fetchData, cancelQuery: cancelDataQuery } = useDiscoverFetch({
    cancellationManager,
    onRowsReceived: useCallback((rows: DiscoverRow[]) => {
      dataStore.getState().appendRows(rows);
    }, []),
    onClearRows: useCallback(() => {
      dataStore.getState().setRows([]);
    }, []),
    onMetaReceived: useCallback((meta) => {
      if (typeof meta.totalHits === "number") {
        dataStore.getState().setTotalCount(meta.totalHits);
      }
      if (typeof meta.isApproximate === "boolean") {
        dataStore.getState().setIsApproximate(meta.isApproximate);
      }
      if (typeof meta.accuracy === "number") {
        dataStore.getState().setAccuracy(meta.accuracy);
      }
    }, []),
    onLoadingChange: useCallback((loading: boolean) => {
      dataStore.getState().setDataLoading(loading);
    }, []),
    onError: useCallback((error: string | null) => {
      dataStore.getState().setError(error);
    }, []),
  });

  // Histogram fetching hook
  const { fetchHistogram, cancelHistogram } = useDiscoverHistogram({
    cancellationManager,
    onHistogramDataReceived: useCallback((data) => {
      dataStore.getState().setHistogramData(data);
    }, []),
    onLoadingChange: useCallback((loading: boolean) => {
      dataStore.getState().setHistogramLoading(loading);
    }, []),
  });

  // Combined cancel function
  const cancelQuery = useCallback(() => {
    cancelDataQuery();
    cancelHistogram();
  }, [cancelDataQuery, cancelHistogram]);

  // Set selected columns with localStorage persistence
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

  // Set selected time column with localStorage persistence
  const setSelectedTimeColumn = useCallback(
    (col: string) => {
      queryStore.setSelectedTimeColumn(col);
      if (selectedDatabase && selectedTable) {
        saveColumnPrefs(selectedDatabase, selectedTable, queryStore.selectedColumns, col);
      }
    },
    [selectedDatabase, selectedTable, queryStore],
  );

  // Set group by with automatic count column handling
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

  // Handle search with cache tracking
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

      // Track query for cache metadata
      trackQuery({
        filter: filterToApply,
        flexibleRange: queryStore.flexibleRange,
        columns: queryStore.selectedColumns,
        timeColumn: queryStore.selectedTimeColumn,
        sorting: queryStore.sorting,
        groupBy: queryStore.groupBy,
      });

      queryStore.markClean();
      queryStore.setAppliedFilter(filterToApply);

      if (page !== 1) {
        setPage(1);
      }

      // Always fetch when user explicitly searches
      fetchData({
        selectedDatabase,
        selectedTable,
        selectedColumns: queryStore.selectedColumns,
        selectedTimeColumn: queryStore.selectedTimeColumn,
        activeMinTime,
        activeMaxTime,
        appliedFilter: filterToApply,
        sorting: queryStore.sorting,
        groupBy: queryStore.groupBy,
        page,
        pageSize,
      });
      fetchHistogram({
        selectedDatabase,
        selectedTable,
        selectedTimeColumn: queryStore.selectedTimeColumn,
        activeMinTime,
        activeMaxTime,
        appliedFilter: filterToApply,
      });
    },
    [
      page,
      pageSize,
      selectedDatabase,
      selectedTable,
      activeMinTime,
      activeMaxTime,
      queryStore,
      trackQuery,
      fetchData,
      fetchHistogram,
    ],
  );

  // Handle histogram bar click
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

  // Set selected database
  const setSelectedDatabase = useCallback((db: string) => {
    setSelectedDatabaseRaw(db);
    setSelectedTable("");
    dataStore.getState().setRows([]);
    dataStore.getState().setHistogramData([]);
    setTables([]);
  }, []);

  // Handle table change
  const handleTableChange = useCallback((table: string) => {
    setSelectedTable(table);
    queryStore.setSelectedColumns([]);
    dataStore.getState().setRows([]);
    dataStore.getState().setHistogramData([]);
    queryStore.setQuery("");
    queryStore.setAppliedFilter("");
    queryStore.setSort([]);
    queryStore.setGroupBy([]);
  }, [queryStore]);

  // Build filter clause helper
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

  // Filter for value
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

  // Filter out value
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

  // Reset columns to defaults
  const resetColumns = useCallback(() => {
    if (!schema) return;
    const defaultCols = applyDefaultColumns(schema);
    queryStore.setSelectedColumns(defaultCols);

    if (selectedDatabase && selectedTable) {
      removeColumnPrefs(selectedDatabase, selectedTable);
    }
  }, [schema, selectedDatabase, selectedTable, queryStore, applyDefaultColumns]);

  // Initial load: databases and URL params
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
    dataStore.getState().setRows([]);
    dataStore.getState().setHistogramData([]);
  }, [selectedDatabase]);

  // Apply schema when loaded
  useEffect(() => {
    if (!schema) return;

    const prefs = loadColumnPreferences(selectedDatabase, selectedTable);
    if (prefs) {
      const validCols = prefs.columns.filter((c: string) =>
        schema.columns.some((sc: ColumnMetadata) => sc.name === c),
      );
      
      const newCols = validCols.length > 0 ? validCols : applyDefaultColumns(schema);
      if (JSON.stringify(queryStore.selectedColumns) !== JSON.stringify(newCols)) {
        queryStore.setSelectedColumns(newCols);
      }

      const timeValid = schema.timeColumns.some(
        (tc: TimeColumnCandidate) => tc.name === prefs.timeColumn,
      );
      
      const newTimeCol = timeValid ? prefs.timeColumn : selectDefaultTimeColumn(schema);
      if (queryStore.selectedTimeColumn !== newTimeCol) {
        queryStore.setSelectedTimeColumn(newTimeCol);
      }
    } else {
      const newCols = applyDefaultColumns(schema);
      if (JSON.stringify(queryStore.selectedColumns) !== JSON.stringify(newCols)) {
        queryStore.setSelectedColumns(newCols);
      }
      
      const newTimeCol = selectDefaultTimeColumn(schema);
      if (queryStore.selectedTimeColumn !== newTimeCol) {
        queryStore.setSelectedTimeColumn(newTimeCol);
      }
    }
  }, [schema, selectedDatabase, selectedTable, queryStore, loadColumnPreferences, applyDefaultColumns, selectDefaultTimeColumn]);

  // Fetch data when schema is ready (initial load only)
  // Subsequent searches are triggered explicitly via handleSearch
  const initialFetchRef = useRef(false);
  useEffect(() => {
    if (schema && !initialFetchRef.current) {
      initialFetchRef.current = true;
      fetchData({
        selectedDatabase,
        selectedTable,
        selectedColumns: queryStore.selectedColumns,
        selectedTimeColumn: queryStore.selectedTimeColumn,
        activeMinTime,
        activeMaxTime,
        appliedFilter: queryStore.appliedFilter,
        sorting: queryStore.sorting,
        groupBy: queryStore.groupBy,
        page,
        pageSize,
      });
    }
  }, [schema, selectedDatabase, selectedTable]);

  // Refetch when pagination, sorting, or time range changes
  useEffect(() => {
    if (!schema || !initialFetchRef.current) return;
    fetchData({
      selectedDatabase,
      selectedTable,
      selectedColumns: queryStore.selectedColumns,
      selectedTimeColumn: queryStore.selectedTimeColumn,
      activeMinTime,
      activeMaxTime,
      appliedFilter: queryStore.appliedFilter,
      sorting: queryStore.sorting,
      groupBy: queryStore.groupBy,
      page,
      pageSize,
    });
  }, [page, pageSize, queryStore.sorting, queryStore.groupBy, activeMinTime, activeMaxTime]);

  // Fetch histogram when schema is ready (initial load)
  const initialHistogramRef = useRef(false);
  useEffect(() => {
    if (schema && !initialHistogramRef.current) {
      initialHistogramRef.current = true;
      fetchHistogram({
        selectedDatabase,
        selectedTable,
        selectedTimeColumn: queryStore.selectedTimeColumn,
        activeMinTime,
        activeMaxTime,
        appliedFilter: queryStore.appliedFilter,
      });
    }
  }, [schema, selectedDatabase, selectedTable]);

  // Refetch histogram when time range, filter, or time column changes
  useEffect(() => {
    if (!schema || !initialHistogramRef.current) return;
    fetchHistogram({
      selectedDatabase,
      selectedTable,
      selectedTimeColumn: queryStore.selectedTimeColumn,
      activeMinTime,
      activeMaxTime,
      appliedFilter: queryStore.appliedFilter,
    });
  }, [activeMinTime, activeMaxTime, queryStore.appliedFilter, queryStore.selectedTimeColumn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancellationManager.cancelAll();
    };
  }, [cancellationManager]);

  // Sync to URL when state changes
  useEffect(() => {
    if (hydratedRef.current) {
      syncToURL();
    }
  }, [syncToURL, selectedDatabase, selectedTable, queryStore.appliedFilter, queryStore.flexibleRange, page]);

  // Set sorting handler
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
    isApproximate: dataState.isApproximate,
    accuracy: dataState.accuracy,
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
