"use client";

import { AlertCircle, CheckCircle, Database, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StatCard,
  PaginationControls,
  TruncatedCell,
} from "@/components/monitoring";
import { StatusBadge, StatusDot } from "@/components/monitoring";
import { useReplicas, formatNumber } from "@/lib/hooks/use-monitoring";
import { useState, useMemo } from "react";

const PAGE_SIZE = 20;

interface ReplicationTabProps {
  refreshInterval?: number;
}

export function ReplicationTab({
  refreshInterval = 30000,
}: ReplicationTabProps) {
  const { data, isLoading, error, refetch } = useReplicas({ refreshInterval });
  const [page, setPage] = useState(1);

  // Paginate replicas
  const paginatedReplicas = useMemo(() => {
    if (!data?.replicas) return [];
    const start = (page - 1) * PAGE_SIZE;
    return data.replicas.slice(start, start + PAGE_SIZE);
  }, [data?.replicas, page]);

  const totalPages = useMemo(() => {
    if (!data?.replicas) return 0;
    return Math.ceil(data.replicas.length / PAGE_SIZE);
  }, [data?.replicas]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const getDelayStatus = (delay: number) => {
    if (delay >= 60) return "critical" as const;
    if (delay >= 10) return "warning" as const;
    return "ok" as const;
  };

  const formatDelay = (seconds: number): string => {
    if (seconds === 0) return "0s";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(
      (seconds % 3600) / 60
    )}m`;
  };

  // If no replicas found
  if (!isLoading && data?.replicas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Database className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Replicated Tables</h3>
        <p className="text-muted-foreground max-w-md">
          Your cluster doesn't have any replicated tables yet. Replicated tables
          use ReplicatedMergeTree engine family and require ZooKeeper or
          ClickHouse Keeper.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Tables"
          value={data?.summary.totalTables ?? "-"}
          icon={Database}
          loading={isLoading}
        />
        <StatCard
          title="Healthy"
          value={data?.summary.healthyTables ?? "-"}
          icon={CheckCircle}
          status={
            data && data.summary.healthyTables === data.summary.totalTables
              ? "ok"
              : undefined
          }
          loading={isLoading}
        />
        <StatCard
          title="Readonly"
          value={data?.summary.readonlyTables ?? "-"}
          status={data && data.summary.readonlyTables > 0 ? "critical" : "ok"}
          loading={isLoading}
        />
        <StatCard
          title="Max Delay"
          value={data ? formatDelay(data.summary.maxDelay) : "-"}
          icon={Clock}
          status={data ? getDelayStatus(data.summary.maxDelay) : undefined}
          loading={isLoading}
        />
      </div>

      {/* Replicas Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Database</TableHead>
              <TableHead>Table</TableHead>
              <TableHead className="text-center">Leader</TableHead>
              <TableHead className="text-center">Readonly</TableHead>
              <TableHead className="text-right">Queue</TableHead>
              <TableHead className="text-right">Delay</TableHead>
              <TableHead className="text-right">Replicas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-3 w-3 bg-muted animate-pulse rounded-full" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              : paginatedReplicas.map((r) => {
                  const replicaStatus = r.isReadonly
                    ? "critical"
                    : r.absoluteDelay >= 10
                    ? "warning"
                    : "ok";

                  return (
                    <TableRow key={`${r.database}.${r.table}`}>
                      <TableCell>
                        <StatusDot status={replicaStatus} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <TruncatedCell value={r.database} maxWidth={150} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <TruncatedCell value={r.table} maxWidth={200} />
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isLeader ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isReadonly ? (
                          <StatusBadge
                            status="critical"
                            label="Yes"
                            size="sm"
                          />
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(r.queueSize)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            r.absoluteDelay >= 60
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : r.absoluteDelay >= 10
                              ? "text-yellow-600 dark:text-yellow-400"
                              : ""
                          }
                        >
                          {formatDelay(r.absoluteDelay)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.activeReplicas}/{r.totalReplicas}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={data?.replicas.length || 0}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Data sourced from{" "}
          <code className="text-primary">system.replicas</code>. The delay
          column shows the replication lag in seconds. A value greater than 10
          seconds indicates the replica may be falling behind.
        </p>
      </div>
    </div>
  );
}
