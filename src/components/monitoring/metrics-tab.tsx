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
import { useMetrics, formatNumber } from "@/lib/hooks/use-monitoring";
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
  connection: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  memory: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  merge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  replication: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  insert: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  io: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export function MetricsTab({ refreshInterval = 30000 }: MetricsTabProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MetricCategory | "all">("all");
  const [activeSubTab, setActiveSubTab] = useState("metrics");

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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeSubTab === "metrics" && (
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as MetricCategory | "all")}
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
                ) : filteredMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No metrics found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMetrics.map((m) => (
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
                        {formatNumber(m.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
                ) : filteredAsyncMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No async metrics found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAsyncMetrics.map((m) => (
                    <TableRow key={m.metric}>
                      <TableCell className="font-mono text-sm">
                        {m.metric}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(m.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((e) => (
                    <TableRow key={e.event}>
                      <TableCell className="font-mono text-sm">
                        {e.event}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(e.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
