"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, HardDrive, Layers, Key, Hash } from "lucide-react";
import {
  useTableOverview,
  type TableOverview,
} from "@/lib/hooks/use-table-explorer";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";

interface OverviewTabProps {
  database: string;
  table: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KeyDisplay({ label, value }: { label: string; value: string }) {
  if (!value || value === "") return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
        {value}
      </code>
    </div>
  );
}

export function OverviewTab({ database, table }: OverviewTabProps) {
  const { data, isLoading, error } = useTableOverview(database, table);

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
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available
      </div>
    );
  }

  const compressionRatio =
    data.total_bytes > 0 && data.avg_row_size
      ? ((1 - data.avg_row_size / 100) * 100).toFixed(1)
      : "N/A";

  return (
    <div className="space-y-6 p-4">
      {/* Engine Badge */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-sm px-3 py-1">
          <Database className="h-3 w-3 mr-2" />
          {data.engine}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {database}.{table}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Rows"
          value={formatNumber(data.total_rows)}
          icon={Hash}
          description="Approximate row count"
        />
        <StatCard
          title="Size on Disk"
          value={formatBytes(data.total_bytes)}
          icon={HardDrive}
          description="Compressed size"
        />
        <StatCard
          title="Parts"
          value={data.parts}
          icon={Layers}
          description="Active data parts"
        />
        <StatCard
          title="Marks"
          value={formatNumber(data.total_marks)}
          icon={Key}
          description="Index marks"
        />
      </div>

      {/* Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Table Keys</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KeyDisplay label="Partition Key" value={data.partition_key} />
          <KeyDisplay label="Sorting Key" value={data.sorting_key} />
          <KeyDisplay label="Primary Key" value={data.primary_key} />
          <KeyDisplay label="Sampling Key" value={data.sampling_key} />
        </CardContent>
      </Card>
    </div>
  );
}
