"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DiscoverHistogram } from "@/components/discover/DiscoverHistogram";
import { DiscoverGrid } from "@/components/discover/DiscoverGrid";
import { QueryBar } from "@/components/discover/QueryBar";
import { FieldsSidebar } from "@/components/discover/FieldsSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, FilterX, Database, Table2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import type {
  TableSchema,
  DiscoverRow,
  TimeRange,
  ColumnMetadata,
  TimeColumnCandidate,
} from "@/lib/types/discover";
import { getMinTimeFromRange } from "@/lib/types/discover";

/**
 * Discover Page - Flexible data exploration for any ClickHouse table
 *
 * Features:
 * - Database/table selection
 * - Dynamic field sidebar (controls SELECT clause)
 * - Custom query bar (controls WHERE clause)
 * - Time range filtering
 * - Log volume histogram
 * - Results grid with sorting and detail view
 */
export default function DiscoverPage() {
  // Source selection state
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<{ name: string; engine: string }[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<string>("");

  // Schema state
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Query state
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedTimeColumn, setSelectedTimeColumn] = useState<string>("");
  const [customFilter, setCustomFilter] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [customMinTime, setCustomMinTime] = useState<string | null>(null);

  // Results state
  const [rows, setRows] = useState<DiscoverRow[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [histogramData, setHistogramData] = useState<
    { time: string; count: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageSize] = useState(100);

  // Derived values
  const activeMinTime = useMemo(() => {
    if (customMinTime) return customMinTime;
    const minDate = getMinTimeFromRange(timeRange);
    return minDate ? minDate.toISOString() : undefined;
  }, [timeRange, customMinTime]);

  // Load databases on mount
  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const res = await fetch("/api/clickhouse/databases");
        const data = await res.json();
        if (data.success && data.data) {
          const dbNames = data.data.map((d: { name: string }) => d.name);
          setDatabases(dbNames);
          // Default to first database or 'default' if available
          if (dbNames.includes("default")) {
            setSelectedDatabase("default");
          } else if (dbNames.length > 0) {
            setSelectedDatabase(dbNames[0]);
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
    loadDatabases();
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
          `/api/clickhouse/tables?database=${encodeURIComponent(
            selectedDatabase
          )}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setTables(
            data.data.map((t: { name: string; engine: string }) => ({
              name: t.name,
              engine: t.engine,
            }))
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

    // Reset table selection when database changes
    setSelectedTable("");
    setSchema(null);
    setRows([]);
    setHistogramData([]);
  }, [selectedDatabase]);

  // Load schema when table changes
  useEffect(() => {
    if (!selectedDatabase || !selectedTable) {
      setSchema(null);
      return;
    }

    const loadSchema = async () => {
      setSchemaLoading(true);
      try {
        const res = await fetch(
          `/api/clickhouse/schema/table-columns?database=${encodeURIComponent(
            selectedDatabase
          )}&table=${encodeURIComponent(selectedTable)}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setSchema(data.data);

          // Auto-select first 10 columns by default
          const defaultCols = data.data.columns
            .slice(0, 10)
            .map((c: ColumnMetadata) => c.name);
          setSelectedColumns(defaultCols);

          // Auto-select primary time column if available
          const primaryTime = data.data.timeColumns.find(
            (tc: TimeColumnCandidate) => tc.isPrimary
          );
          if (primaryTime) {
            setSelectedTimeColumn(primaryTime.name);
          } else if (data.data.timeColumns.length > 0) {
            setSelectedTimeColumn(data.data.timeColumns[0].name);
          } else {
            setSelectedTimeColumn("");
          }
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

    // Clear results when table changes
    setRows([]);
    setHistogramData([]);
    setCustomFilter("");
  }, [selectedDatabase, selectedTable]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!selectedDatabase || !selectedTable) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "data",
        limit: String(pageSize),
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

      if (customFilter.trim()) {
        params.set("filter", customFilter.trim());
      }

      const res = await fetch(`/api/clickhouse/discover?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        setRows(data.data.rows || []);
        setTotalHits(data.data.totalHits || 0);
      } else {
        setError(data.error || "Failed to fetch data");
        setRows([]);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedDatabase,
    selectedTable,
    selectedColumns,
    selectedTimeColumn,
    activeMinTime,
    customFilter,
    pageSize,
  ]);

  // Fetch more data (Load More)
  const fetchMore = useCallback(async () => {
    if (!selectedDatabase || !selectedTable) return;
    if (rows.length >= totalHits) return; // No more data

    setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "data",
        limit: String(pageSize),
        offset: String(rows.length), // Offset by current rows
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

      if (customFilter.trim()) {
        params.set("filter", customFilter.trim());
      }

      const res = await fetch(`/api/clickhouse/discover?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        // Append new rows to existing
        setRows((prev) => [...prev, ...(data.data.rows || [])]);
      }
    } catch (err) {
      console.error("Failed to fetch more data:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    selectedDatabase,
    selectedTable,
    selectedColumns,
    selectedTimeColumn,
    activeMinTime,
    customFilter,
    rows.length,
    totalHits,
    pageSize,
  ]);

  // Fetch histogram
  const fetchHistogram = useCallback(async () => {
    if (!selectedDatabase || !selectedTable || !selectedTimeColumn) {
      setHistogramData([]);
      return;
    }

    setHistLoading(true);

    try {
      const params = new URLSearchParams({
        database: selectedDatabase,
        table: selectedTable,
        mode: "histogram",
        timeColumn: selectedTimeColumn,
      });

      if (activeMinTime) {
        params.set("minTime", activeMinTime);
      }

      if (customFilter.trim()) {
        params.set("filter", customFilter.trim());
      }

      const res = await fetch(`/api/clickhouse/discover?${params}`);
      const data = await res.json();

      if (data.success && data.histogram) {
        setHistogramData(data.histogram);
      }
    } catch (err) {
      console.error("Failed to fetch histogram:", err);
    } finally {
      setHistLoading(false);
    }
  }, [
    selectedDatabase,
    selectedTable,
    selectedTimeColumn,
    activeMinTime,
    customFilter,
  ]);

  // Execute search
  const handleSearch = useCallback(() => {
    fetchData();
    fetchHistogram();
  }, [fetchData, fetchHistogram]);

  // Handle histogram bar click
  const handleHistogramBarClick = (time: string) => {
    setCustomMinTime(time);
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-4">
      {/* Header / Source Selection */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Discover</h1>

          {/* Database selector */}
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedDatabase}
              onValueChange={setSelectedDatabase}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Select database" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db} value={db}>
                    {db}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table selector */}
          <div className="flex items-center gap-1.5">
            <Table2 className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedTable}
              onValueChange={setSelectedTable}
              disabled={!selectedDatabase || tables.length === 0}
            >
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    <span className="flex items-center gap-2">
                      {t.name}
                      <span className="text-xs text-muted-foreground">
                        ({t.engine})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Time Range & Refresh */}
        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onValueChange={(v) => {
              setTimeRange(v as TimeRange);
              setCustomMinTime(null);
            }}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">Last 5 min</SelectItem>
              <SelectItem value="15m">Last 15 min</SelectItem>
              <SelectItem value="30m">Last 30 min</SelectItem>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="3h">Last 3 hours</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="12h">Last 12 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="3d">Last 3 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleSearch}
            disabled={isLoading || !selectedTable}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Query Bar */}
      {schema && (
        <QueryBar
          value={customFilter}
          onChange={setCustomFilter}
          onExecute={handleSearch}
          isLoading={isLoading}
          error={error}
          placeholder={`Filter with ClickHouse SQL, e.g. ${
            schema.columns[0]?.name || "column"
          } = 'value'`}
        />
      )}

      {/* Main Content */}
      {!selectedTable ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <Database className="h-12 w-12 mx-auto opacity-50" />
            <p>Select a database and table to start exploring</p>
          </div>
        </div>
      ) : schemaLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading schema...
          </div>
        </div>
      ) : schema ? (
        <>
          {/* Histogram */}
          {selectedTimeColumn && (
            <div className="border rounded-md p-4 bg-card shadow-sm relative">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Document Count Over Time
                </h3>
                {customMinTime && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomMinTime(null)}
                    className="h-6 text-xs"
                  >
                    <FilterX className="mr-1 h-3 w-3" />
                    Reset Zoom
                  </Button>
                )}
              </div>
              <DiscoverHistogram
                data={histogramData}
                isLoading={histLoading}
                onBarClick={handleHistogramBarClick}
              />
            </div>
          )}

          {/* Grid + Sidebar */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left Sidebar: Fields */}
            <FieldsSidebar
              columns={schema.columns}
              timeColumns={schema.timeColumns}
              selectedColumns={selectedColumns}
              onSelectedColumnsChange={setSelectedColumns}
              selectedTimeColumn={selectedTimeColumn}
              onTimeColumnChange={setSelectedTimeColumn}
              className="hidden md:flex w-64 max-h-[calc(100vh-280px)]"
            />

            {/* Main Grid */}
            <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-md shadow-sm overflow-hidden">
              <div className="p-2 border-b text-xs text-muted-foreground flex justify-between items-center">
                <span>
                  {rows.length.toLocaleString()} of {totalHits.toLocaleString()}{" "}
                  hits
                </span>
                <span className="font-mono">
                  {selectedDatabase}.{selectedTable}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                <DiscoverGrid
                  rows={rows}
                  columns={schema.columns}
                  selectedColumns={selectedColumns}
                  isLoading={isLoading && rows.length === 0}
                  hasMore={rows.length < totalHits}
                  onLoadMore={fetchMore}
                />
                {isLoadingMore && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading more...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
