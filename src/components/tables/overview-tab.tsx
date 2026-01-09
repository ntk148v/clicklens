"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Database,
  HardDrive,
  Layers,
  Key,
  Hash,
  Eye,
  Info,
} from "lucide-react";
import { useTableOverview } from "@/lib/hooks/use-table-explorer";

interface OverviewTabProps {
  database: string;
  table: string;
}

// Check if engine is a view type
function isViewEngine(engine: string): boolean {
  return engine === "View" || engine === "MaterializedView";
}

// Format bytes with null/view handling
function formatBytesOrDash(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes) || !isFinite(bytes)) return "–";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format number with null/view handling
function formatNumberOrDash(num: number | null | undefined): string {
  if (num == null || isNaN(num) || !isFinite(num)) return "–";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
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

  const isView = isViewEngine(data.engine);

  return (
    <div className="space-y-6 p-4">
      {/* Engine Badge */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-sm px-3 py-1">
          {isView ? (
            <Eye className="h-3 w-3 mr-2" />
          ) : (
            <Database className="h-3 w-3 mr-2" />
          )}
          {data.engine}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {database}.{table}
        </span>
      </div>

      {/* View Info Banner */}
      {isView && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="flex items-center gap-3 py-3">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {data.engine === "MaterializedView"
                ? "Materialized views compute and store results. The underlying data table stores the actual data."
                : "Views are virtual tables based on a SELECT query. They don't store data directly."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Rows"
          value={formatNumberOrDash(data.total_rows)}
          icon={Hash}
          description={isView ? "N/A for views" : "Approximate row count"}
        />
        <StatCard
          title="Size on Disk"
          value={formatBytesOrDash(data.total_bytes)}
          icon={HardDrive}
          description={isView ? "N/A for views" : "Compressed size"}
        />
        <StatCard
          title="Parts"
          value={isView ? "–" : data.parts}
          icon={Layers}
          description={isView ? "N/A for views" : "Active data parts"}
        />
        <StatCard
          title="Marks"
          value={formatNumberOrDash(data.total_marks)}
          icon={Key}
          description={isView ? "N/A for views" : "Index marks"}
        />
      </div>

      {/* Keys Section - Hide for views as they don't have keys */}
      {!isView && (
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
      )}
    </div>
  );
}
