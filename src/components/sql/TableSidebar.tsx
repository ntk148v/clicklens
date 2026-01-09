"use client";

import { useState, useMemo } from "react";
import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import { useTabsStore } from "@/lib/store/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table2,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  HardDrive,
  ChevronRight,
  ChevronDown,
  Eye,
  Layers,
  Network,
  Box,
} from "lucide-react";

interface TableInfo {
  name: string;
  engine: string;
  total_rows: number;
  total_bytes: number;
}

// Categories for grouping tables by engine type
type TableCategory =
  | "tables"
  | "views"
  | "materialized"
  | "distributed"
  | "other";

interface CategoryConfig {
  label: string;
  icon: React.ElementType;
  engines: string[];
}

const CATEGORY_CONFIG: Record<TableCategory, CategoryConfig> = {
  tables: {
    label: "Tables",
    icon: Table2,
    engines: [
      "MergeTree",
      "ReplicatedMergeTree",
      "ReplacingMergeTree",
      "SummingMergeTree",
      "AggregatingMergeTree",
      "CollapsingMergeTree",
      "VersionedCollapsingMergeTree",
      "GraphiteMergeTree",
      "ReplicatedReplacingMergeTree",
      "ReplicatedSummingMergeTree",
      "ReplicatedAggregatingMergeTree",
      "ReplicatedCollapsingMergeTree",
      "ReplicatedVersionedCollapsingMergeTree",
      "ReplicatedGraphiteMergeTree",
      "SharedMergeTree",
      "SharedReplacingMergeTree",
      "SharedSummingMergeTree",
      "SharedAggregatingMergeTree",
      "SharedCollapsingMergeTree",
      "SharedVersionedCollapsingMergeTree",
      "SharedGraphiteMergeTree",
      "TinyLog",
      "StripeLog",
      "Log",
      "Memory",
    ],
  },
  views: {
    label: "Views",
    icon: Eye,
    engines: ["View"],
  },
  materialized: {
    label: "Materialized Views",
    icon: Layers,
    engines: ["MaterializedView"],
  },
  distributed: {
    label: "Distributed",
    icon: Network,
    engines: ["Distributed"],
  },
  other: {
    label: "Other",
    icon: Box,
    engines: [], // Catch-all for unmatched engines
  },
};

const CATEGORY_ORDER: TableCategory[] = [
  "tables",
  "views",
  "materialized",
  "distributed",
  "other",
];

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes)) return "–";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "–";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getTableCategory(engine: string): TableCategory {
  for (const [category, config] of Object.entries(CATEGORY_CONFIG) as [
    TableCategory,
    CategoryConfig
  ][]) {
    if (category === "other") continue;
    if (config.engines.some((e) => engine.startsWith(e))) {
      return category;
    }
  }
  return "other";
}

interface TableGroupProps {
  category: TableCategory;
  tables: TableInfo[];
  activeTableName: string | null;
  onTableClick: (tableName: string) => void;
}

function TableGroup({
  category,
  tables,
  activeTableName,
  onTableClick,
}: TableGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  if (tables.length === 0) return null;

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{config.label}</span>
        <span className="text-[10px] text-muted-foreground/70">
          {tables.length}
        </span>
      </button>

      {isExpanded && (
        <div className="pb-1">
          {tables.map((table) => (
            <button
              key={table.name}
              onClick={() => onTableClick(table.name)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors",
                activeTableName === table.name && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2 pl-5">
                <Table2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate font-medium">{table.name}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 ml-10 text-[10px] text-muted-foreground">
                <span title="Rows">{formatNumber(table.total_rows)} rows</span>
                <span className="flex items-center gap-0.5" title="Size">
                  <HardDrive className="w-2.5 h-2.5" />
                  {formatBytes(table.total_bytes)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TableSidebar() {
  const {
    tables,
    loadingTables,
    sidebarCollapsed,
    toggleSidebar,
    selectedDatabase,
  } = useSqlBrowserStore();

  const { addTableTab, tabs, activeTabId } = useTabsStore();

  // Find if current active tab is a table tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTableName = activeTab?.type === "table" ? activeTab.table : null;

  // Group tables by category
  const groupedTables = useMemo(() => {
    const groups: Record<TableCategory, TableInfo[]> = {
      tables: [],
      views: [],
      materialized: [],
      distributed: [],
      other: [],
    };

    tables.forEach((table) => {
      const category = getTableCategory(table.engine);
      groups[category].push(table);
    });

    // Sort tables within each group alphabetically
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [tables]);

  const handleTableClick = (tableName: string) => {
    if (selectedDatabase) {
      addTableTab(selectedDatabase, tableName);
    }
  };

  if (sidebarCollapsed) {
    return (
      <div className="w-10 border-r flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleSidebar}
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-56 border-r flex flex-col bg-muted/30 h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Tables
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleSidebar}
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {!selectedDatabase ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Select a database
          </div>
        ) : loadingTables ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No tables found
          </div>
        ) : (
          <div>
            {CATEGORY_ORDER.map((category) => (
              <TableGroup
                key={category}
                category={category}
                tables={groupedTables[category]}
                activeTableName={activeTableName}
                onTableClick={handleTableClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
