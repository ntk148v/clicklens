"use client";

import { Suspense, useEffect } from "react";
import { Header } from "@/components/layout";
import { DiscoverHistogram } from "@/components/discover/DiscoverHistogram";
import { DiscoverGrid } from "@/components/discover/DiscoverGrid";
import { QueryBar } from "@/components/discover/QueryBar";
import { FieldsSidebar } from "@/components/discover/FieldsSidebar";
import { TimeSelector, RefreshControl } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterX, Database, Table2, AlertCircle } from "lucide-react";
import { getFlexibleRangeFromEnum } from "@/lib/types/discover";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/components/auth";
import { useDiscoverState } from "@/lib/hooks/use-discover-state";

function DiscoverPageContent() {
  const { permissions, isLoading: authLoading } = useAuth();

  const {
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
    activeMinTime,
    activeMaxTime,
    refreshInterval,
    rows,
    totalHits,
    histogramData,
    isLoading,
    histLoading,
    error,
    page,
    pageSize,

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
  } = useDiscoverState();

  // Keyboard shortcuts: Cmd/Ctrl+Enter to execute, Esc to cancel (P8)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSearch();
      }
      if (e.key === "Escape" && isLoading) {
        e.preventDefault();
        cancelQuery();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSearch, cancelQuery, isLoading]);

  if (authLoading) {
    return null;
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
      <Header
        title="Discover"
        actions={
          <div className="flex items-center gap-2">
            <TimeSelector value={flexibleRange} onChange={setFlexibleRange} />
            <RefreshControl
              onRefresh={() => handleSearch()}
              interval={refreshInterval}
              onIntervalChange={setRefreshInterval}
              isLoading={isLoading}
            />
          </div>
        }
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedDatabase}
              onValueChange={setSelectedDatabase}
            >
              <SelectTrigger
                className="w-[180px] h-9"
                aria-label="Select database"
              >
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

          <div className="flex items-center gap-1.5">
            <Table2 className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedTable}
              onValueChange={handleTableChange}
              disabled={!selectedDatabase || tables.length === 0}
            >
              <SelectTrigger
                className="w-[200px] h-9"
                aria-label="Select table"
              >
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
            onCancel={cancelQuery}
            isLoading={isLoading}
            isDirty={isQueryDirty}
            error={error}
            placeholder={`Filter with ClickHouse SQL, e.g. ${
              schema.columns[0]?.name || "column"
            } = 'value'`}
          />
        )}

        {/* Inline error display (P7) */}
        {error && !isLoading && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/50 bg-destructive/5 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Query Error</p>
              <p className="text-xs mt-0.5 opacity-90 break-all">{error}</p>
            </div>
          </div>
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
              <FieldsSidebar
                columns={schema.columns}
                timeColumns={schema.timeColumns}
                selectedColumns={selectedColumns}
                onSelectedColumnsChange={setSelectedColumns}
                selectedTimeColumn={selectedTimeColumn}
                onTimeColumnChange={setSelectedTimeColumn}
                onResetColumns={resetColumns}
                onFilterForValue={filterForValue}
                onFilterOutValue={filterOutValue}
                fieldValuesParams={{
                  database: selectedDatabase,
                  table: selectedTable,
                  timeColumn: selectedTimeColumn || undefined,
                  minTime: activeMinTime,
                  maxTime: activeMaxTime,
                  filter: appliedFilter || undefined,
                }}
                className="hidden md:flex w-64 max-h-[calc(100vh-280px)]"
              />

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
                <div className="flex-1 overflow-auto relative">
                  <DiscoverGrid
                    rows={rows}
                    columns={schema.columns}
                    selectedColumns={selectedColumns}
                    isLoading={isLoading && rows.length === 0}
                    page={page}
                    pageSize={pageSize}
                    totalHits={totalHits}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onFilterForValue={filterForValue}
                    onFilterOutValue={filterOutValue}
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

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      }
    >
      <DiscoverPageContent />
    </Suspense>
  );
}
