import type { Node, Edge } from "@xyflow/react";
import type { TableNode as ApiTableNode } from "@/lib/hooks/use-table-explorer";

// Extend React Flow Node with our data
// Using type with index signature for React Flow compatibility
export type TableNodeData = {
  label: string;
  database: string;
  name: string;
  engine: string;
  type: ApiTableNode["type"];
  totalRows: number | null;
  totalBytes: number | null;
  isSelected?: boolean;
  isConnected?: boolean;
  isExternal?: boolean;
  [key: string]: unknown;
};

export type TableFlowNode = Node<TableNodeData, "tableNode">;
export type TableFlowEdge = Edge;
