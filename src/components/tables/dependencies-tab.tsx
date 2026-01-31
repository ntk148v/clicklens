"use client";

import { Loader2, Network, AlertCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTableDependencies } from "@/lib/hooks/use-table-explorer";
import { DependencyGraph } from "./dependency-graph";

interface DependenciesTabProps {
  database: string;
  selectedTable?: string | null;
}

export function DependenciesTab({
  database,
  selectedTable,
}: DependenciesTabProps) {
  const { data, isLoading, error } = useTableDependencies(database);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive gap-2">
        <AlertCircle className="h-8 w-8" />
        <span>{error}</span>
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

  const { nodes, edges } = data;

  // Check if there are any dependencies
  const hasDependencies = edges.length > 0;

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Network className="h-12 w-12 opacity-50" />
        <p>No tables found in this database</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Info banner */}
      {!hasDependencies && (
        <Card className="m-4 mb-0 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="flex items-center gap-3 py-3">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              No dependencies found between tables in this database. Tables with
              dependencies (Materialized Views, Views referencing other tables,
              Distributed tables) will show connections here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="px-4 pt-4 pb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted-foreground/20 border border-muted-foreground/40" />
          <span>Table</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500" />
          <span>Materialized View</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500" />
          <span>View</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500" />
          <span>Distributed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-dashed border-muted-foreground/40" />
          <span>External Table</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-muted-foreground/60">
            {nodes.length} tables, {edges.length} dependencies
          </span>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-h-[400px]">
        <DependencyGraph
          nodes={nodes}
          edges={edges}
          selectedTable={selectedTable}
        />
      </div>
    </div>
  );
}
