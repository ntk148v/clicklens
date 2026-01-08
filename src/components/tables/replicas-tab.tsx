"use client";

import {
  Loader2,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTableReplicas } from "@/lib/hooks/use-table-explorer";

interface ReplicasTabProps {
  database: string;
  table: string;
}

function StatusIndicator({
  value,
  goodValue,
  label,
}: {
  value: number;
  goodValue: number;
  label: string;
}) {
  const isGood = value === goodValue;
  return (
    <div className="flex items-center gap-2">
      {isGood ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={isGood ? "text-green-600" : "text-red-600"}>
        {label}
      </span>
    </div>
  );
}

export function ReplicasTab({ database, table }: ReplicasTabProps) {
  const { data, isLoading, error } = useTableReplicas(database, table);

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

  if (!data || !data.is_replicated) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Server className="h-12 w-12 mb-4 opacity-50" />
        <p>This table is not replicated</p>
        <p className="text-sm mt-2">
          Only ReplicatedMergeTree tables have replication status
        </p>
      </div>
    );
  }

  const replica = data.replica!;
  const hasIssues =
    replica.is_readonly === 1 ||
    replica.is_session_expired === 1 ||
    replica.queue_size > 10 ||
    replica.absolute_delay > 10;

  return (
    <div className="space-y-4 p-4">
      {/* Status Banner */}
      {hasIssues && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-300">
              This replica may have issues. Check the status below.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Leader Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={replica.is_leader === 1 ? "default" : "secondary"}
              className="text-sm"
            >
              {replica.is_leader === 1 ? "Leader" : "Follower"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Replicas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {replica.active_replicas} / {replica.total_replicas}
            </div>
            <p className="text-xs text-muted-foreground">Active / Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replica.queue_size}</div>
            <p className="text-xs text-muted-foreground">
              {replica.inserts_in_queue} inserts, {replica.merges_in_queue}{" "}
              merges
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Delay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replica.absolute_delay}s</div>
            <p className="text-xs text-muted-foreground">Replication lag</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Health Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatusIndicator
            value={replica.is_readonly}
            goodValue={0}
            label={replica.is_readonly === 0 ? "Writable" : "Read-only"}
          />
          <StatusIndicator
            value={replica.is_session_expired}
            goodValue={0}
            label={
              replica.is_session_expired === 0
                ? "Session Active"
                : "Session Expired"
            }
          />
          <StatusIndicator
            value={replica.parts_to_check}
            goodValue={0}
            label={`${replica.parts_to_check} parts to check`}
          />
        </CardContent>
      </Card>

      {/* ZooKeeper Paths */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ZooKeeper</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-xs text-muted-foreground">Replica Name</span>
            <code className="block text-xs bg-muted px-2 py-1 rounded font-mono mt-1">
              {replica.replica_name}
            </code>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">
              ZooKeeper Path
            </span>
            <code className="block text-xs bg-muted px-2 py-1 rounded font-mono mt-1 break-all">
              {replica.zookeeper_path}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
