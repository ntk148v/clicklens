"use client";

import { useState, useMemo } from "react";
import { AlertCircle, HardDrive, Database, Layers } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard, PaginationControls } from "@/components/monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import { StatusBadge } from "@/components/monitoring";
import { Badge } from "@/components/ui/badge";
import { useDisks, formatBytes } from "@/lib/hooks/use-monitoring";

const DEFAULT_PAGE_SIZE = 50;

// Progress bar component
function DiskUsageBar({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  const getColor = () => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div
      className={`h-2 w-full bg-muted rounded-full overflow-hidden ${className}`}
    >
      <div
        className={`h-full transition-all duration-300 ${getColor()}`}
        style={{ width: `${Math.min(100, percentage)}%` }}
      />
    </div>
  );
}

interface DisksTabProps {
  refreshInterval?: number;
}

export function DisksTab({ refreshInterval = 30000 }: DisksTabProps) {
  const { data, isLoading, error, refetch } = useDisks({ refreshInterval });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>(
    "usedPercentage"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "desc"
  );

  const sortedDisks = useMemo(() => {
    if (!data?.disks) return [];

    return [...data.disks].sort((a, b) => {
      if (!sortColumn || !sortDirection) return 0;

      const aValue = (a as any)[sortColumn];
      const bValue = (b as any)[sortColumn];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data?.disks, sortColumn, sortDirection]);

  const updateSort = (column: string, direction: "asc" | "desc" | null) => {
    setSortColumn(column);
    setSortDirection(direction);
  };

  // Paginate disks
  const paginatedDisks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedDisks.slice(start, start + pageSize);
  }, [sortedDisks, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!data?.disks) return 0;
    return Math.ceil(data.disks.length / pageSize);
  }, [data?.disks, pageSize]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const getUsageStatus = (percentage: number) => {
    if (percentage >= 90) return "critical" as const;
    if (percentage >= 75) return "warning" as const;
    return "ok" as const;
  };

  const formatCompressionRatio = (ratio?: number) => {
    if (!ratio || ratio === 0) return "-";
    return `${(ratio * 100).toFixed(1)}%`;
  };

  // Check if we have multiple nodes
  const isMultiNode = data?.nodes && data.nodes.length > 1;

  return (
    <div className="space-y-6">
      {/* Cluster info banner */}
      {data?.clusterName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="w-4 h-4" />
          <span>
            Cluster: <strong>{data.clusterName}</strong>
          </span>
          <Badge variant="outline">{data.nodes?.length || 0} nodes</Badge>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Disks"
          value={data?.summary.totalDisks ?? "-"}
          icon={HardDrive}
          loading={isLoading}
        />
        <StatCard
          title="Total Space"
          value={data ? formatBytes(data.summary.totalSpace) : "-"}
          icon={Database}
          loading={isLoading}
        />
        <StatCard
          title="Used Space"
          value={data ? formatBytes(data.summary.totalUsed) : "-"}
          description={
            data ? `${data.summary.overallUsedPercentage}% used` : undefined
          }
          status={
            data
              ? getUsageStatus(data.summary.overallUsedPercentage)
              : undefined
          }
          loading={isLoading}
        />
        <StatCard
          title="Free Space"
          value={data ? formatBytes(data.summary.totalFree) : "-"}
          status={
            data
              ? getUsageStatus(data.summary.overallUsedPercentage)
              : undefined
          }
          loading={isLoading}
        />
      </div>

      {/* Overall usage bar */}
      {data && (
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Disk Usage</span>
            <StatusBadge
              status={getUsageStatus(data.summary.overallUsedPercentage)}
              label={`${data.summary.overallUsedPercentage}%`}
              size="sm"
            />
          </div>
          <DiskUsageBar
            percentage={data.summary.overallUsedPercentage}
            className="h-3"
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Used: {formatBytes(data.summary.totalUsed)}</span>
            <span>Free: {formatBytes(data.summary.totalFree)}</span>
          </div>
        </div>
      )}

      {/* Disks Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isMultiNode && (
                  <SortableTableHead
                    currentSort={sortColumn === "node" ? sortDirection : null}
                    onSort={(dir) => updateSort("node", dir)}
                  >
                    Node
                  </SortableTableHead>
                )}
                <SortableTableHead
                  currentSort={sortColumn === "name" ? sortDirection : null}
                  onSort={(dir) => updateSort("name", dir)}
                >
                  Name
                </SortableTableHead>
                <SortableTableHead
                  currentSort={sortColumn === "type" ? sortDirection : null}
                  onSort={(dir) => updateSort("type", dir)}
                >
                  Type
                </SortableTableHead>
                <SortableTableHead
                  currentSort={sortColumn === "path" ? sortDirection : null}
                  onSort={(dir) => updateSort("path", dir)}
                >
                  Path
                </SortableTableHead>
                <SortableTableHead
                  className="w-[180px]"
                  currentSort={
                    sortColumn === "usedPercentage" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("usedPercentage", dir)}
                >
                  Usage
                </SortableTableHead>
                <SortableTableHead
                  className="text-right"
                  currentSort={
                    sortColumn === "totalSpace" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("totalSpace", dir)}
                >
                  Total
                </SortableTableHead>
                <SortableTableHead
                  className="text-right"
                  currentSort={
                    sortColumn === "usedSpace" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("usedSpace", dir)}
                >
                  Used
                </SortableTableHead>
                <SortableTableHead
                  className="text-right"
                  currentSort={
                    sortColumn === "freeSpace" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("freeSpace", dir)}
                >
                  Free
                </SortableTableHead>
                <SortableTableHead
                  className="text-right"
                  currentSort={
                    sortColumn === "compressedBytes" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("compressedBytes", dir)}
                >
                  Compressed
                </SortableTableHead>
                <SortableTableHead
                  className="text-right"
                  currentSort={
                    sortColumn === "compressionRatio" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("compressionRatio", dir)}
                >
                  Ratio
                </SortableTableHead>
                <SortableTableHead
                  className="text-right"
                  currentSort={
                    sortColumn === "partsCount" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("partsCount", dir)}
                >
                  Parts
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {isMultiNode && (
                      <TableCell>
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedDisks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isMultiNode ? 11 : 10}
                    className="text-center text-muted-foreground"
                  >
                    No disks found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDisks.map((disk, idx) => (
                  <TableRow key={`${disk.node}-${disk.name}-${idx}`}>
                    {isMultiNode && (
                      <TableCell>
                        <TruncatedCell value={disk.node} maxWidth={100} />
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium">
                      {disk.name}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded-full bg-muted">
                        {disk.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TruncatedCell
                        value={disk.path}
                        maxWidth={150}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DiskUsageBar
                          percentage={disk.usedPercentage || 0}
                          className="flex-1"
                        />
                        <span
                          className={`text-xs font-mono w-12 text-right ${
                            (disk.usedPercentage || 0) >= 90
                              ? "text-red-500"
                              : (disk.usedPercentage || 0) >= 75
                              ? "text-yellow-500"
                              : ""
                          }`}
                        >
                          {disk.usedPercentage || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(disk.totalSpace)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(disk.usedSpace)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(disk.freeSpace)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {disk.compressedBytes
                        ? formatBytes(disk.compressedBytes)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCompressionRatio(disk.compressionRatio)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {disk.partsCount?.toLocaleString() || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination */}
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={data?.disks.length || 0}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Data from <code className="text-primary">system.disks</code> and{" "}
          <code className="text-primary">system.parts</code>.
          {data?.clusterName && " Cluster-aware: showing all nodes."} Disk usage
          above 75% shows a warning, above 90% is critical.
        </p>
      </div>
    </div>
  );
}
