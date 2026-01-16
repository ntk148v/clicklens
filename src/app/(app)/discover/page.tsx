"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Header } from "@/components/layout";
import { DiscoverHistogram } from "@/components/discover/DiscoverHistogram";
import { DiscoverGrid } from "@/components/discover/DiscoverGrid";
import { QueryBar } from "@/components/discover/QueryBar";
import { FieldsSidebar } from "@/components/discover/FieldsSidebar";
import { DiscoverTimeSelector } from "@/components/discover/DiscoverTimeSelector";
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
  FlexibleTimeRange,
} from "@/lib/types/discover";
import { getFlexibleRangeFromEnum } from "@/lib/types/discover";

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
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/components/auth";

export default function DiscoverPage() {
  const { permissions, isLoading: authLoading } = useAuth();

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
  // Time range state (Unified)
  const [flexibleRange, setFlexibleRange] = useState<FlexibleTimeRange>(
    getFlexibleRangeFromEnum("1h")
  );

  // Results state
  const [rows, setRows] = useState<DiscoverRow[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [histogramData, setHistogramData] = useState<
    { time: string; count: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Derived values for API calls
  const { activeMinTime, activeMaxTime } = useMemo(() => {
    if (flexibleRange.type === "absolute") {
      return {
        activeMinTime: flexibleRange.from,
        activeMaxTime:
          flexibleRange.to === "now" ? undefined : flexibleRange.to, // API handles missing maxTime as "now" usually, but for absolute we might want explicit
      };
    } else {
      // Relative: "now-1h" -> parse "1h"
      const rangeKey = flexibleRange.from.replace("now-", "") as TimeRange;
      // This function is now internal to getFlexibleRangeFromEnum or similar,
      // but for direct use, we'd need a helper. For now, let's assume the API
      // can handle "now-1h" directly or we need to calculate it here.
      // Given the original `getMinTimeFromRange` was used, we'll re-introduce a similar logic.
      const getMinTimeFromRangeLocal = (range: TimeRange): Date | null => {
        const now = new Date();
        switch (range) {
          case "5m":
            return new Date(now.getTime() - 5 * 60 * 1000);
          case "15m":
            return new Date(now.getTime() - 15 * 60 * 1000);
          case "30m":
            return new Date(now.getTime() - 30 * 60 * 1000);
          case "1h":
            return new Date(now.getTime() - 60 * 60 * 1000);
          case "3h":
            return new Date(now.getTime() - 3 * 60 * 60 * 1000);
          case "6h":
            return new Date(now.getTime() - 6 * 60 * 60 * 1000);
          case "12h":
            return new Date(now.getTime() - 12 * 60 * 60 * 1000);
          case "24h":
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
          case "3d":
            return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          case "7d":
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          default:
            return null;
        }
      };
      const minDate = getMinTimeFromRangeLocal(rangeKey);
      return {
        activeMinTime: minDate ? minDate.toISOString() : undefined,
        activeMaxTime: undefined,
      };
    }
  }, [flexibleRange]);

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

      if (customFilter.trim()) {
        params.set("filter", customFilter.trim());
      }

      const res = await fetch(`/api/clickhouse/discover?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        setRows(data.data.rows || []);
        setTotalHits(data.data.totalHits || 0);
      } else {
        const errorMessage = data.error || "Failed to fetch data";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Query Error",
          description: errorMessage,
        });
        setRows([]);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch data";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Query Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedDatabase,
    selectedTable,
    selectedColumns,
    selectedTimeColumn,
    activeMinTime,
    activeMaxTime,
    customFilter,
    page,
    pageSize,
  ]);

  // Removed fetchMore

  // Fetch histogram
  const fetchHistogram = useCallback(async () => {
    // ... (same as before) ...
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

      if (activeMaxTime) {
        params.set("maxTime", activeMaxTime);
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
    activeMaxTime,
    customFilter,
  ]);

  // Execute search
  const handleSearch = useCallback(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      fetchData();
      fetchHistogram();
    }
  }, [page, fetchData, fetchHistogram]);

  // Effect to fetch active data when deps change
  useEffect(() => {
    if (schema) {
      fetchData();
    }
  }, [schema, fetchData]); // fetchData depends on page, pageSize, filters.

  // Effect to fetch histogram when deps change (excluding pagination)
  useEffect(() => {
    if (schema) {
      fetchHistogram();
    }
  }, [
    schema,
    fetchHistogram,
    selectedTimeColumn,
    activeMinTime,
    activeMaxTime,
    customFilter,
  ]); // Explicit deps for histogram

  // Handle histogram bar click (Zoom in)
  const handleHistogramBarClick = (startTime: string, endTime?: string) => {
    if (endTime) {
      const fromDate = new Date(startTime);
      const toDate = new Date(endTime);

      setFlexibleRange({
        type: "absolute",
        from: startTime,
        to: endTime,
        label: `${format(fromDate, "MMM d, HH:mm")} to ${format(
          toDate,
          "MMM d, HH:mm"
        )}`,
      });
    }
  };

  if (authLoading) {
    return null; // Or skeleton
  }

  if (!permissions?.canDiscover) {
    return (
      <div className="h-full flex flex-col p-4">
        <h1 className="text-xl font-bold tracking-tight mb-4">Discover</h1>
        <div className="flex-1 flex items-center justify-center">
          <AccessDenied
            title="Access Denied"
            message="You do not have permission to access the Discover feature."
            description="Please contact your administrator if you believe this is an error."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header / Source Selection */}
      <Header
        title="Discover"
        actions={
          <div className="flex items-center gap-2">
            <DiscoverTimeSelector
              value={flexibleRange}
              onChange={setFlexibleRange}
            />

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
        }
      >
        <div className="flex items-center gap-3">
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
      </Header>

      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
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
                  {flexibleRange.type === "absolute" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFlexibleRange(getFlexibleRangeFromEnum("1h"))
                      }
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
                    {rows.length.toLocaleString()} of{" "}
                    {totalHits.toLocaleString()} hits
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
                    // Pagination
                    page={page}
                    pageSize={pageSize}
                    totalHits={totalHits}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                  {isLoading && rows.length > 0 && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
