"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type {
  TableNode as ApiTableNode,
  TableEdge as ApiTableEdge,
} from "@/lib/hooks/use-table-explorer";
import type { TableFlowNode, TableFlowEdge, TableNodeData } from "./types";
import { TableNode } from "./table-node";
import { applyDagreLayout, getConnectedNodeIds } from "./layout";

// Register custom node types
// Using explicit typing to satisfy React Flow's strict type requirements
const nodeTypes = {
  tableNode: TableNode,
} as const;

interface DependencyGraphProps {
  nodes: ApiTableNode[];
  edges: ApiTableEdge[];
  selectedTable?: string | null;
  onNodeClick?: (nodeId: string) => void;
}

// Convert API data to React Flow format
function convertToFlowData(
  apiNodes: ApiTableNode[],
  apiEdges: ApiTableEdge[],
  selectedTable: string | null,
  connectedNodes: Set<string>
): { nodes: TableFlowNode[]; edges: TableFlowEdge[] } {
  const flowNodes: TableFlowNode[] = apiNodes.map((node) => {
    const isSelected = selectedTable
      ? node.id === selectedTable ||
        node.name === selectedTable ||
        node.id === `${node.database}.${selectedTable}`
      : false;
    const isConnected = connectedNodes.has(node.id);

    return {
      id: node.id,
      type: "tableNode",
      position: { x: 0, y: 0 }, // Will be set by dagre
      data: {
        label: node.name,
        database: node.database,
        name: node.name,
        engine: node.engine,
        type: node.type,
        totalRows: node.totalRows,
        totalBytes: node.totalBytes,
        isSelected,
        isConnected,
        isExternal: node.engine === "Unknown",
      } satisfies TableNodeData,
    };
  });

  const flowEdges: TableFlowEdge[] = apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
    },
    style: {
      strokeWidth: 2,
    },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}

export function DependencyGraph({
  nodes: apiNodes,
  edges: apiEdges,
  selectedTable,
  onNodeClick,
}: DependencyGraphProps) {
  const [layoutKey, setLayoutKey] = useState(0);

  // Find connected nodes for selected table
  const connectedNodes = useMemo(() => {
    if (!selectedTable) return new Set<string>();

    // Find matching node
    const matchingNode = apiNodes.find(
      (n) =>
        n.id === selectedTable ||
        n.name === selectedTable ||
        n.id.endsWith(`.${selectedTable}`)
    );

    const selectedId = matchingNode?.id || null;
    return selectedId
      ? getConnectedNodeIds(
          selectedId,
          apiEdges.map((e) => ({ ...e, id: e.id, source: e.source, target: e.target }))
        )
      : new Set<string>();
  }, [apiNodes, apiEdges, selectedTable]);

  // Convert and layout nodes
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = convertToFlowData(
      apiNodes,
      apiEdges,
      selectedTable ?? null,
      connectedNodes
    );
    const layoutedNodes = applyDagreLayout(nodes, edges);
    return { initialNodes: layoutedNodes, initialEdges: edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiNodes, apiEdges, selectedTable, connectedNodes, layoutKey]);

  const [nodes, setNodes, onNodesChange] = useNodesState<TableFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<TableFlowEdge>(initialEdges);

  // Update nodes/edges when initial data changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: TableFlowNode) => {
      if (onNodeClick) {
        onNodeClick(node.data.name);
      }
    },
    [onNodeClick]
  );

  // Reset layout
  const handleResetLayout = useCallback(() => {
    setLayoutKey((k) => k + 1);
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange<TableFlowNode>}
        onEdgesChange={onEdgesChange as OnEdgesChange<TableFlowEdge>}
        onNodeClick={handleNodeClick}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeTypes={nodeTypes as any}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-muted/50"
        />
        <Panel position="top-right" className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetLayout}
            title="Reset layout"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
