"use client";

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Clock, Hash, Type, Calendar, Binary } from "lucide-react";
import type { ColumnMetadata, TimeColumnCandidate } from "@/lib/types/discover";
import { cn } from "@/lib/utils";

interface FieldsSidebarProps {
  columns: ColumnMetadata[];
  timeColumns: TimeColumnCandidate[];
  selectedColumns: string[];
  onSelectedColumnsChange: (columns: string[]) => void;
  selectedTimeColumn: string | null;
  onTimeColumnChange: (column: string) => void;
  className?: string;
}

// Map ClickHouse types to icons
function getTypeIcon(type: string) {
  const baseType = type
    .replace(/^Nullable\(/, "")
    .replace(/\)$/, "")
    .replace(/\(.*\)/, "");

  if (baseType.startsWith("DateTime") || baseType.startsWith("Date")) {
    return <Calendar className="h-3.5 w-3.5 text-purple-500" />;
  }
  if (
    baseType.startsWith("Int") ||
    baseType.startsWith("UInt") ||
    baseType.startsWith("Float") ||
    baseType.startsWith("Decimal")
  ) {
    return <Hash className="h-3.5 w-3.5 text-blue-500" />;
  }
  if (baseType.startsWith("String") || baseType.startsWith("FixedString")) {
    return <Type className="h-3.5 w-3.5 text-green-500" />;
  }
  if (baseType.startsWith("Bool")) {
    return <Binary className="h-3.5 w-3.5 text-orange-500" />;
  }
  return <Type className="h-3.5 w-3.5 text-muted-foreground" />;
}

// Shorten ClickHouse type for display
function shortenType(type: string): string {
  return type
    .replace(/^Nullable\(/, "")
    .replace(/\)$/, "")
    .replace(/^LowCardinality\(/, "")
    .replace(/DateTime64\(\d*\)/, "DateTime64")
    .replace(/Enum(8|16)\(.+\)/, "Enum$1")
    .replace(/FixedString\(\d+\)/, "FixedString")
    .replace(/Array\(.+\)/, "Array")
    .replace(/Map\(.+\)/, "Map")
    .replace(/Tuple\(.+\)/, "Tuple")
    .replace(/Nested\(.+\)/, "Nested");
}

/**
 * Sidebar for selecting which columns to include in the query
 *
 * Features:
 * - Search/filter columns
 * - Select/deselect columns (affects SQL SELECT clause)
 * - Time column selector (affects ORDER BY and WHERE)
 * - Type indicators with icons
 */
export function FieldsSidebar({
  columns,
  timeColumns,
  selectedColumns,
  onSelectedColumnsChange,
  selectedTimeColumn,
  onTimeColumnChange,
  className,
}: FieldsSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return columns;
    const lower = searchTerm.toLowerCase();
    return columns.filter((col) => col.name.toLowerCase().includes(lower));
  }, [columns, searchTerm]);

  const handleColumnToggle = (columnName: string, checked: boolean) => {
    if (checked) {
      onSelectedColumnsChange([...selectedColumns, columnName]);
    } else {
      onSelectedColumnsChange(selectedColumns.filter((c) => c !== columnName));
    }
  };

  const handleSelectAll = () => {
    onSelectedColumnsChange(columns.map((c) => c.name));
  };

  const handleSelectNone = () => {
    onSelectedColumnsChange([]);
  };

  const isTimeColumn = (name: string) =>
    timeColumns.some((tc) => tc.name === name);

  return (
    <div
      className={cn(
        "flex flex-col border rounded-md bg-card overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Fields</h3>
          <div className="flex gap-1 text-xs">
            <button
              onClick={handleSelectAll}
              className="text-primary hover:underline"
            >
              All
            </button>
            <span className="text-muted-foreground">/</span>
            <button
              onClick={handleSelectNone}
              className="text-primary hover:underline"
            >
              None
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter fields..."
            className="h-8 pl-7 text-xs"
          />
        </div>

        {/* Time column selector */}
        {timeColumns.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Time Column
            </Label>
            <select
              value={selectedTimeColumn || ""}
              onChange={(e) => onTimeColumnChange(e.target.value)}
              className="w-full h-8 text-xs rounded-md border bg-background px-2"
            >
              <option value="">None (no time filtering)</option>
              {timeColumns.map((tc) => (
                <option key={tc.name} value={tc.name}>
                  {tc.name} {tc.isPrimary && "(primary)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Column list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchTerm ? "No matching fields" : "No columns available"}
            </p>
          ) : (
            filteredColumns.map((col) => (
              <div
                key={col.name}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors",
                  selectedColumns.includes(col.name) && "bg-muted/30"
                )}
              >
                <Checkbox
                  id={`field-${col.name}`}
                  checked={selectedColumns.includes(col.name)}
                  onCheckedChange={(checked) =>
                    handleColumnToggle(col.name, checked === true)
                  }
                  className="h-3.5 w-3.5"
                />
                <Label
                  htmlFor={`field-${col.name}`}
                  className="flex-1 flex items-center gap-1.5 text-xs font-normal cursor-pointer truncate"
                >
                  {getTypeIcon(col.type)}
                  <span className="truncate">{col.name}</span>
                  {isTimeColumn(col.name) && (
                    <Clock className="h-3 w-3 text-purple-500 shrink-0" />
                  )}
                </Label>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 shrink-0 font-mono"
                >
                  {shortenType(col.type)}
                </Badge>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer with count */}
      <div className="p-2 border-t text-xs text-muted-foreground">
        {selectedColumns.length} of {columns.length} fields selected
      </div>
    </div>
  );
}
