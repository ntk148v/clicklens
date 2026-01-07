"use client";

import { useState } from "react";
import {
  Loader2,
  TrendingUp,
  Clock,
  HardDrive,
  Zap,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryAnalytics } from "@/lib/hooks/use-query-analytics";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";

export function AnalyticsTab() {
  const [metric, setMetric] = useState<"duration" | "memory" | "read_bytes">(
    "duration"
  );
  const { data, isLoading, error } = useQueryAnalytics(metric);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
        <p>No analytics data available</p>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
    return `${(ms / 60000).toFixed(2)} min`;
  };

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.summary.total_queries)}
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Total Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.summary.total_duration_ms)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-green-500" />
              Data Read
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_read_bytes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Peak Memory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_memory)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(data.summary.failed_queries)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metric Tabs */}
      <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
        <TabsList>
          <TabsTrigger value="duration">
            <Clock className="h-3 w-3 mr-1" />
            Slowest
          </TabsTrigger>
          <TabsTrigger value="memory">
            <HardDrive className="h-3 w-3 mr-1" />
            Most Memory
          </TabsTrigger>
          <TabsTrigger value="read_bytes">
            <TrendingUp className="h-3 w-3 mr-1" />
            Most Data Read
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">
              Top Query Patterns (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[300px]">Query Pattern</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                  <TableHead className="text-right">Max Duration</TableHead>
                  <TableHead className="text-right">Avg Memory</TableHead>
                  <TableHead className="text-right">Avg Read</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.queries.map((query, idx) => (
                  <TableRow key={query.normalized_query_hash || idx}>
                    <TableCell>
                      <TruncatedCell
                        value={query.query}
                        maxWidth={400}
                        className="bg-muted px-2 py-1 rounded"
                      />
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Last run:{" "}
                        {new Date(query.last_event_time).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {query.user}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatNumber(query.count)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatDuration(query.avg_duration_ms)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatDuration(query.max_duration_ms)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(query.avg_memory)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(query.avg_read_bytes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Tabs>
    </div>
  );
}
