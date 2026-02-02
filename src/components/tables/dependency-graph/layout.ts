import dagre from "dagre";
import type { TableFlowNode, TableFlowEdge } from "./types";

interface LayoutOptions {
  direction?: "TB" | "BT" | "LR" | "RL";
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * Apply dagre layout to nodes and edges
 * Places source tables at top, dependents below
 */
export function applyDagreLayout(
  nodes: TableFlowNode[],
  edges: TableFlowEdge[],
  options: LayoutOptions = {}
): TableFlowNode[] {
  const {
    direction = "TB",
    nodeWidth = 160,
    nodeHeight = 60,
    rankSep = 80,
    nodeSep = 40,
  } = options;

  // Create dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 20,
    marginy: 20,
  });

  // Add nodes
  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run layout
  dagre.layout(g);

  // Apply positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
}

/**
 * Get connected node IDs for a given node
 */
export function getConnectedNodeIds(
  nodeId: string,
  edges: TableFlowEdge[]
): Set<string> {
  const connected = new Set<string>();

  for (const edge of edges) {
    if (edge.source === nodeId) {
      connected.add(edge.target);
    }
    if (edge.target === nodeId) {
      connected.add(edge.source);
    }
  }

  return connected;
}
