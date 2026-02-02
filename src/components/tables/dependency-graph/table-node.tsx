"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Database,
  Eye,
  Layers,
  Server,
  BookOpen,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableNodeData } from "./types";

// Icon mapping by table type
const iconMap: Record<TableNodeData["type"], LucideIcon> = {
  materialized_view: Layers,
  view: Eye,
  distributed: Server,
  dictionary: BookOpen,
  table: Database,
};

// Color classes by table type
const colorClassMap: Record<TableNodeData["type"], string> = {
  materialized_view: "text-purple-500",
  view: "text-blue-500",
  distributed: "text-orange-500",
  dictionary: "text-green-500",
  table: "text-muted-foreground",
};

// Format number compactly
function formatCompact(num: number | null): string {
  if (num === null || num === undefined) return "–";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// Separate icon component to avoid static component lint error
const TableTypeIcon = memo(function TableTypeIcon({
  type,
}: {
  type: TableNodeData["type"];
}) {
  const IconComponent = iconMap[type] || HelpCircle;
  const colorClass = colorClassMap[type] || "text-muted-foreground";

  return (
    <IconComponent className={cn("h-4 w-4 flex-shrink-0", colorClass)} />
  );
});

function TableNodeComponent({ data }: { data: TableNodeData }) {
  const isHighlighted = data.isSelected || data.isConnected;

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 bg-background shadow-sm min-w-[140px] transition-all",
        data.isSelected && "border-primary ring-2 ring-primary/20",
        data.isConnected &&
          !data.isSelected &&
          "border-blue-400 bg-blue-50/50 dark:bg-blue-950/30",
        !isHighlighted && "border-border",
        data.isExternal && "border-dashed opacity-70"
      )}
    >
      {/* Target handle (incoming edges - dependencies point to this) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground"
      />

      <div className="flex items-center gap-2">
        <TableTypeIcon type={data.type} />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium truncate" title={data.name}>
            {data.name}
          </span>
          {data.database !== data.name && (
            <span
              className="text-[10px] text-muted-foreground truncate"
              title={data.database}
            >
              {data.database}
            </span>
          )}
        </div>
      </div>

      {/* Row count badge */}
      {data.totalRows !== null && (
        <div className="mt-1 text-[10px] text-muted-foreground text-right">
          {formatCompact(data.totalRows)} rows
        </div>
      )}

      {/* Source handle (outgoing edges - this points to dependents) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground"
      />
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
