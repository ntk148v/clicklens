"use client";

import { useState, useMemo } from "react";
import { Search, Filter, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationControls } from "./pagination-controls";
import { useMetrics, formatBytes } from "@/lib/hooks/use-monitoring";
import type { MetricCategory } from "@/lib/clickhouse/monitoring";

interface MetricsTabProps {
  refreshInterval?: number;
}

const categoryLabels: Record<MetricCategory | "all", string> = {
  all: "All Categories",
  query: "Query",
  connection: "Connection",
  memory: "Memory",
  merge: "Merge",
  replication: "Replication",
  insert: "Insert",
  io: "I/O",
  other: "Other",
};

const categoryColors: Record<MetricCategory, string> = {
  query: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  connection:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  memory:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  merge:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  replication: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  insert: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  io: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

// Auto-format value based on metric name
function formatMetricValue(name: string, value: number): string {
  if (value == null || !isFinite(value)) return "0";

  const lowerName = name.toLowerCase();

  // Bytes-based metrics
  if (
    lowerName.includes("bytes") ||
    lowerName.includes("memory") ||
    lowerName.includes("size") ||
    lowerName.includes("cache") ||
    lowerName.includes("buffer") ||
    lowerName.includes("osmemory") ||
    lowerName.includes("resident") ||
    lowerName.includes("shared") ||
    lowerName.includes("virtual") ||
    lowerName.includes("rss") ||
    lowerName.includes("heap") ||
    lowerName.includes("stack")
  ) {
    return formatBytes(value);
  }

  // Percentage metrics
  if (lowerName.includes("percent") || lowerName.includes("ratio")) {
    return `${value.toFixed(2)}%`;
  }

  // Time-based metrics (seconds)
  if (lowerName.includes("seconds") || lowerName.includes("uptime")) {
    if (value >= 86400) return `${(value / 86400).toFixed(1)}d`;
    if (value >= 3600) return `${(value / 3600).toFixed(1)}h`;
    if (value >= 60) return `${(value / 60).toFixed(1)}m`;
    return `${value.toFixed(1)}s`;
  }

  // Microseconds
  if (lowerName.includes("microseconds")) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}s`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}ms`;
    return `${value.toFixed(0)}µs`;
  }

  // Default number formatting
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}

const DEFAULT_PAGE_SIZE = 50;

export function MetricsTab({ refreshInterval = 30000 }: MetricsTabProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MetricCategory | "all">("all");
  const [activeSubTab, setActiveSubTab] = useState("metrics");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [metricsPage, setMetricsPage] = useState(1);
  const [asyncPage, setAsyncPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);

  const { data, isLoading, error } = useMetrics(undefined, { refreshInterval });

  // Filter metrics based on search and category
  const filteredMetrics = useMemo(() => {
    if (!data?.metrics) return [];

    return data.metrics.filter((m) => {
      const matchesSearch =
        search === "" ||
        m.metric.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || m.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [data?.metrics, search, category]);

  // Filter async metrics
  const filteredAsyncMetrics = useMemo(() => {
    if (!data?.asyncMetrics) return [];

    return data.asyncMetrics.filter(
      (m) =>
        search === "" ||
        m.metric.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [data?.asyncMetrics, search]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];

    return data.events.filter(
      (e) =>
        search === "" ||
        e.event.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [data?.events, search]);

  // Paginated data
  const paginatedMetrics = useMemo(() => {
    const start = (metricsPage - 1) * pageSize;
    return filteredMetrics.slice(start, start + pageSize);
  }, [filteredMetrics, metricsPage, pageSize]);

  const paginatedAsyncMetrics = useMemo(() => {
    const start = (asyncPage - 1) * pageSize;
    return filteredAsyncMetrics.slice(start, start + pageSize);
  }, [filteredAsyncMetrics, asyncPage, pageSize]);

  const paginatedEvents = useMemo(() => {
    const start = (eventsPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, eventsPage, pageSize]);

  // Total pages
  const metricsTotalPages = Math.ceil(filteredMetrics.length / pageSize);
  const asyncTotalPages = Math.ceil(filteredAsyncMetrics.length / pageSize);
  const eventsTotalPages = Math.ceil(filteredEvents.length / pageSize);

  // Reset page when filter changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setMetricsPage(1);
    setAsyncPage(1);
    setEventsPage(1);
  };

  const handleCategoryChange = (value: MetricCategory | "all") => {
    setCategory(value);
    setMetricsPage(1);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search metrics..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeSubTab === "metrics" && (
          <Select
            value={category}
            onValueChange={(v) =>
              handleCategoryChange(v as MetricCategory | "all")
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="metrics">
            Metrics ({filteredMetrics.length})
          </TabsTrigger>
          <TabsTrigger value="async">
            Async Metrics ({filteredAsyncMetrics.length})
          </TabsTrigger>
          <TabsTrigger value="events">
            Events ({filteredEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Metric</TableHead>
                  <TableHead className="w-[100px]">Category</TableHead>
                  <TableHead className="w-[120px] text-right">Value</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No metrics found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMetrics.map((m) => (
                    <TableRow key={m.metric}>
                      <TableCell className="font-mono text-sm">
                        {m.metric}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={categoryColors[m.category]}
                        >
                          {categoryLabels[m.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMetricValue(m.metric, m.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={metricsPage}
              totalPages={metricsTotalPages}
              totalItems={filteredMetrics.length}
              pageSize={pageSize}
              onPageChange={setMetricsPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </TabsContent>

        <TabsContent value="async" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Metric</TableHead>
                  <TableHead className="w-[150px] text-right">Value</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-24 bg-muted animate-pulse rounded ml-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedAsyncMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No async metrics found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAsyncMetrics.map((m) => (
                    <TableRow key={m.metric}>
                      <TableCell className="font-mono text-sm">
                        {m.metric}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMetricValue(m.metric, m.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={asyncPage}
              totalPages={asyncTotalPages}
              totalItems={filteredAsyncMetrics.length}
              pageSize={pageSize}
              onPageChange={setAsyncPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Event</TableHead>
                  <TableHead className="w-[150px] text-right">Count</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-24 bg-muted animate-pulse rounded ml-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEvents.map((e) => (
                    <TableRow key={e.event}>
                      <TableCell className="font-mono text-sm">
                        {e.event}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMetricValue(e.event, e.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={eventsPage}
              totalPages={eventsTotalPages}
              totalItems={filteredEvents.length}
              pageSize={pageSize}
              onPageChange={setEventsPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
