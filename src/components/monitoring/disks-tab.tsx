"use client";

import { AlertCircle, HardDrive, Database } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import { useDisks, formatBytes } from "@/lib/hooks/use-monitoring";

// Progress bar component
function DiskUsageBar({ percentage, className }: { percentage: number; className?: string }) {
  const getColor = () => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className={`h-2 w-full bg-muted rounded-full overflow-hidden ${className}`}>
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
  const { data, isLoading, error } = useDisks({ refreshInterval });

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

  return (
    <div className="space-y-6">
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
          description={data ? `${data.summary.overallUsedPercentage}% used` : undefined}
          status={data ? getUsageStatus(data.summary.overallUsedPercentage) : undefined}
          loading={isLoading}
        />
        <StatCard
          title="Free Space"
          value={data ? formatBytes(data.summary.totalFree) : "-"}
          status={data ? getUsageStatus(data.summary.overallUsedPercentage) : undefined}
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
          <DiskUsageBar percentage={data.summary.overallUsedPercentage} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Used: {formatBytes(data.summary.totalUsed)}</span>
            <span>Free: {formatBytes(data.summary.totalFree)}</span>
          </div>
        </div>
      )}

      {/* Disks Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Path</TableHead>
              <TableHead className="w-[200px]">Usage</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Free</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-40 bg-muted animate-pulse rounded" />
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
                </TableRow>
              ))
            ) : data?.disks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No disks found
                </TableCell>
              </TableRow>
            ) : (
              data?.disks.map((disk) => (
                <TableRow key={disk.name}>
                  <TableCell className="font-mono font-medium">
                    {disk.name}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {disk.type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground max-w-[200px] truncate">
                    {disk.path}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DiskUsageBar
                        percentage={disk.usedPercentage}
                        className="flex-1"
                      />
                      <span
                        className={`text-xs font-mono w-12 text-right ${
                          disk.usedPercentage >= 90
                            ? "text-red-500"
                            : disk.usedPercentage >= 75
                              ? "text-yellow-500"
                              : ""
                        }`}
                      >
                        {disk.usedPercentage}%
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Data sourced from{" "}
          <code className="text-primary">system.disks</code>. Disk usage above
          75% shows a warning, and above 90% is critical. Keep sufficient free
          space for merges and temporary files.
        </p>
      </div>
    </div>
  );
}
