"use client";

import { AlertCircle, GitMerge, Scissors, Loader2 } from "lucide-react";
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
import {
  useOperations,
  formatBytes,
  formatDuration,
} from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/monitoring";

// Progress bar component
function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`h-2 w-full bg-muted rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

interface OperationsTabProps {
  refreshInterval?: number;
}

export function OperationsTab({ refreshInterval = 10000 }: OperationsTabProps) {
  const { data, isLoading, error, refetch } = useOperations({
    refreshInterval,
  });

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const hasActiveMerges = data && data.merges.length > 0;
  const hasActiveMutations = data && data.mutations.length > 0;
  const noOperations = !isLoading && !hasActiveMerges && !hasActiveMutations;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Merges"
          value={data?.mergeSummary.activeMerges ?? "-"}
          icon={GitMerge}
          loading={isLoading}
        />
        <StatCard
          title="Merge Progress"
          value={
            data
              ? `${Math.round((data.mergeSummary.avgProgress || 0) * 100)}%`
              : "-"
          }
          description={
            data && data.mergeSummary.totalBytesProcessing > 0
              ? `Processing ${formatBytes(
                  data.mergeSummary.totalBytesProcessing
                )}`
              : undefined
          }
          loading={isLoading}
        />
        <StatCard
          title="Active Mutations"
          value={data?.mutationSummary.activeMutations ?? "-"}
          icon={Scissors}
          loading={isLoading}
        />
        <StatCard
          title="Failed Mutations"
          value={data?.mutationSummary.failedMutations ?? "-"}
          status={
            data && data.mutationSummary.failedMutations > 0 ? "critical" : "ok"
          }
          loading={isLoading}
        />
      </div>

      {/* No operations message */}
      {noOperations && (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
          <Loader2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Active Operations</h3>
          <p className="text-muted-foreground max-w-md">
            There are no active merges or mutations running at the moment.
            Background operations will appear here when ClickHouse is processing
            data.
          </p>
        </div>
      )}

      {/* Active Merges */}
      {hasActiveMerges && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Active Merges
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Database.Table</TableHead>
                  <TableHead>Result Part</TableHead>
                  <TableHead className="text-center">Parts</TableHead>
                  <TableHead className="w-[150px]">Progress</TableHead>
                  <TableHead className="text-right">Elapsed</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Memory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.merges.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      <TruncatedCell
                        value={`${m.database}.${m.table}`}
                        maxWidth={200}
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell
                        value={m.resultPartName}
                        maxWidth={150}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell className="text-center">{m.numParts}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={m.progress * 100}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-10 text-right">
                          {Math.round(m.progress * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatDuration(m.elapsed * 1000)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(m.totalSizeBytesCompressed)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(m.memoryUsage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Active Mutations */}
      {hasActiveMutations && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Active Mutations
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Database.Table</TableHead>
                  <TableHead>Mutation ID</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead className="text-center">Parts To Do</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.mutations.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      <TruncatedCell
                        value={`${m.database}.${m.table}`}
                        maxWidth={200}
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell value={m.mutationId} maxWidth={120} />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell
                        value={m.command}
                        maxWidth={200}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {m.partsToDo}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.latestFailReason ? (
                        <StatusBadge
                          status="critical"
                          label="Failed"
                          size="sm"
                        />
                      ) : (
                        <StatusBadge status="ok" label="Running" size="sm" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.createTime}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Show failed mutation details */}
          {data?.mutations.some((m) => m.latestFailReason) && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <h4 className="text-sm font-medium text-destructive mb-2">
                Failed Mutations
              </h4>
              {data.mutations
                .filter((m) => m.latestFailReason)
                .map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-mono">
                      {m.database}.{m.table}
                    </span>
                    : {m.latestFailReason}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Data sourced from <code className="text-primary">system.merges</code>{" "}
          and <code className="text-primary">system.mutations</code>. Merges
          combine smaller parts into larger ones for efficient storage.
          Mutations are ALTER TABLE operations that modify data.
        </p>
      </div>
    </div>
  );
}
