"use client";

import { useMemo } from "react";
import { Loader2, Network, AlertCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useTableDependencies,
  type TableNode,
  type TableEdge,
} from "@/lib/hooks/use-table-explorer";
import { DependencyGraph } from "./dependency-graph";

interface DependenciesTabProps {
  database: string;
  selectedTable?: string | null;
}

/**
 * Find all nodes connected to the selected table (directly or transitively)
 * Uses BFS to traverse the graph in both directions
 */
function getConnectedSubgraph(
  selectedTableId: string,
  nodes: TableNode[],
  edges: TableEdge[]
): { nodes: TableNode[]; edges: TableEdge[] } {
  // Build adjacency lists for both directions
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, new Set());
    if (!incoming.has(edge.target)) incoming.set(edge.target, new Set());
    outgoing.get(edge.source)!.add(edge.target);
    incoming.get(edge.target)!.add(edge.source);
  }

  // BFS to find all connected nodes
  const connectedNodeIds = new Set<string>();
  const queue: string[] = [selectedTableId];
  connectedNodeIds.add(selectedTableId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Add outgoing neighbors (tables this depends on / writes to)
    const outNeighbors = outgoing.get(current);
    if (outNeighbors) {
      for (const neighbor of outNeighbors) {
        if (!connectedNodeIds.has(neighbor)) {
          connectedNodeIds.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Add incoming neighbors (tables that depend on this)
    const inNeighbors = incoming.get(current);
    if (inNeighbors) {
      for (const neighbor of inNeighbors) {
        if (!connectedNodeIds.has(neighbor)) {
          connectedNodeIds.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  // Filter nodes and edges
  const filteredNodes = nodes.filter((n) => connectedNodeIds.has(n.id));
  const filteredEdges = edges.filter(
    (e) => connectedNodeIds.has(e.source) && connectedNodeIds.has(e.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

export function DependenciesTab({
  database,
  selectedTable,
}: DependenciesTabProps) {
  const { data, isLoading, error } = useTableDependencies(database);

  // Filter to only show tables related to the selected table
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (!data || !selectedTable)
      return { filteredNodes: [], filteredEdges: [] };

    const { nodes, edges } = data;

    // Find the selected table node ID
    const selectedNode = nodes.find(
      (n) =>
        n.id === selectedTable ||
        n.name === selectedTable ||
        n.id === `${database}.${selectedTable}`
    );

    if (!selectedNode) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    // Get the subgraph connected to the selected table
    const subgraph = getConnectedSubgraph(selectedNode.id, nodes, edges);

    return { filteredNodes: subgraph.nodes, filteredEdges: subgraph.edges };
  }, [data, selectedTable, database]);

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

  if (!selectedTable) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Network className="h-12 w-12 opacity-50" />
        <p>Select a table to view its dependencies</p>
      </div>
    );
  }

  // Check if there are any dependencies for the selected table
  const hasDependencies = filteredEdges.length > 0;

  if (!hasDependencies) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Network className="h-12 w-12 opacity-50" />
        <p className="font-medium">{selectedTable}</p>
        <p className="text-sm text-center max-w-md">
          This table has no dependencies. It is not referenced by any
          Materialized Views, Views, or Distributed tables, and does not
          reference other tables.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Info banner */}
      <Card className="m-4 mb-0 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
        <CardContent className="flex items-center gap-3 py-3">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Showing dependencies for <strong>{selectedTable}</strong>. Arrows
            indicate data flow direction (source → dependent).
          </p>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="px-4 pt-4 pb-2 space-y-2 text-xs text-muted-foreground">
        {/* Node types */}
        <div className="flex flex-wrap gap-4">
          <span className="font-medium w-12">Nodes:</span>
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
            <span>External</span>
          </div>
        </div>
        {/* Edge types */}
        <div className="flex flex-wrap gap-4">
          <span className="font-medium w-12">Edges:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-indigo-500" />
            <span>Source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-green-500" />
            <span>Target (TO)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-500" />
            <span>Join</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-pink-500" />
            <span>Distributed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-0.5 bg-violet-500"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #8b5cf6 0, #8b5cf6 3px, transparent 3px, transparent 6px)",
              }}
            />
            <span>Dictionary</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground/60">
              {filteredNodes.length} tables, {filteredEdges.length} edges
            </span>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-h-[400px]">
        <DependencyGraph
          nodes={filteredNodes}
          edges={filteredEdges}
          selectedTable={selectedTable}
        />
      </div>
    </div>
  );
}
