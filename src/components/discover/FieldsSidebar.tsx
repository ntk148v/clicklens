"use client";

import { useMemo, useState, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Clock,
  Hash,
  Type,
  Calendar,
  Binary,
  ChevronRight,
  ChevronDown,
  Filter,
  FilterX,
  Loader2,
  FolderGit2,
  X,
} from "lucide-react";
import { fetchApi } from "@/lib/api/client";
import type { ColumnMetadata, TimeColumnCandidate } from "@/lib/types/discover";
import { cn } from "@/lib/utils";
import { TruncatedCell } from "@/components/monitoring";

interface FieldsSidebarProps {
  columns: ColumnMetadata[];
  timeColumns: TimeColumnCandidate[];
  selectedColumns: string[];
  onSelectedColumnsChange: (columns: string[]) => void;
  selectedTimeColumn: string | null;
  onTimeColumnChange: (column: string) => void;
  onResetColumns?: () => void;
  onFilterForValue?: (column: string, value: unknown) => void;
  onFilterOutValue?: (column: string, value: unknown) => void;
  groupBy?: string[];
  onGroupByChange?: (columns: string[]) => void;
  fieldValuesParams?: {
    database: string;
    table: string;
    timeColumn?: string;
    minTime?: string;
    maxTime?: string;
    filter?: string;
  };
  className?: string;
}

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

interface FieldValue {
  value: unknown;
  count: number;
}

export function FieldsSidebar({
  columns,
  timeColumns,
  selectedColumns,
  onSelectedColumnsChange,
  selectedTimeColumn,
  onTimeColumnChange,
  onResetColumns,
  onFilterForValue,
  onFilterOutValue,
  groupBy = [],
  onGroupByChange,
  fieldValuesParams,
  className,
}: FieldsSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [fieldValues, setFieldValues] = useState<
    Record<string, FieldValue[]>
  >({});
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());

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

  const handleGroupByToggle = (columnName: string) => {
    if (!onGroupByChange) return;
    if (groupBy.includes(columnName)) {
      onGroupByChange(groupBy.filter((c) => c !== columnName));
    } else {
      onGroupByChange([...groupBy, columnName]);
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

  const toggleFieldExpanded = useCallback(
    async (fieldName: string) => {
      const next = new Set(expandedFields);
      if (next.has(fieldName)) {
        next.delete(fieldName);
        setExpandedFields(next);
        return;
      }

      next.add(fieldName);
      setExpandedFields(next);

      if (fieldValues[fieldName] || !fieldValuesParams) return;

      setLoadingFields((prev) => new Set(prev).add(fieldName));

      try {
        const params = new URLSearchParams({
          database: fieldValuesParams.database,
          table: fieldValuesParams.table,
          column: fieldName,
        });
        if (fieldValuesParams.timeColumn)
          params.set("timeColumn", fieldValuesParams.timeColumn);
        if (fieldValuesParams.minTime)
          params.set("minTime", fieldValuesParams.minTime);
        if (fieldValuesParams.maxTime)
          params.set("maxTime", fieldValuesParams.maxTime);
        if (fieldValuesParams.filter)
          params.set("filter", fieldValuesParams.filter);

        const res = await fetchApi(
          `/api/clickhouse/discover/field-values?${params}`,
        );
        const data = await res.json();

        if (data.success && data.data) {
          setFieldValues((prev) => ({ ...prev, [fieldName]: data.data }));
        }
      } catch (err) {
        console.error("Failed to load field values:", err);
      } finally {
        setLoadingFields((prev) => {
          const next = new Set(prev);
          next.delete(fieldName);
          return next;
        });
      }
    },
    [expandedFields, fieldValues, fieldValuesParams],
  );

  const canExpand = !!fieldValuesParams && (!!onFilterForValue || !!onFilterOutValue);

  return (
    <div
      className={cn(
        "flex flex-col border rounded-md bg-card overflow-hidden",
        className,
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
            {onResetColumns && (
              <>
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={onResetColumns}
                  className="text-primary hover:underline"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter fields..."
            className="h-8 pl-7 text-xs"
          />
        </div>

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

        {/* Group By selector */}
        {onGroupByChange && (
          <div className="space-y-1.5 pt-1 border-t">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <FolderGit2 className="h-3 w-3" />
              Group By
            </Label>
            <div className="flex flex-col gap-1.5">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleGroupByToggle(e.target.value);
                }}
                className="w-full h-8 text-xs rounded-md border bg-background px-2"
              >
                <option value="">Add field to group...</option>
                {columns
                  .filter((c) => !groupBy.includes(c.name))
                  .map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>

              {groupBy.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {groupBy.map((g) => (
                    <Badge
                      key={g}
                      variant="secondary"
                      className="px-1.5 py-0 h-5 text-[10px] items-center gap-1 font-mono"
                    >
                      {g}
                      <button
                        onClick={() => handleGroupByToggle(g)}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                        title="Remove"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Column list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {filteredColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchTerm ? "No matching fields" : "No columns available"}
            </p>
          ) : (
            filteredColumns.map((col) => {
              const isExpanded = expandedFields.has(col.name);
              const isGrouped = groupBy.includes(col.name);
              const values = fieldValues[col.name];
              const isLoadingValues = loadingFields.has(col.name);

              return (
                <div key={col.name} className="group/field">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors",
                      (selectedColumns.includes(col.name) || isGrouped) && "bg-muted/30",
                    )}
                  >
                    {/* Expand chevron */}
                    {canExpand ? (
                      <button
                        onClick={() => toggleFieldExpanded(col.name)}
                        className="shrink-0 p-0.5 hover:bg-muted rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

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
                      className="flex items-center gap-1.5 text-xs font-normal cursor-pointer truncate min-w-0"
                    >
                      {getTypeIcon(col.type)}
                      <span className="truncate">{col.name}</span>
                      {isTimeColumn(col.name) && (
                        <Clock className="h-3 w-3 text-purple-500 shrink-0" />
                      )}
                    </Label>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4 shrink-0 font-mono max-w-[80px]"
                    >
                      <TruncatedCell
                        value={shortenType(col.type)}
                        tooltipContent={col.type}
                        className="truncate"
                      />
                    </Badge>
                    
                    {onGroupByChange && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-5 w-5 shrink-0 transition-opacity ml-auto",
                          isGrouped 
                            ? "opacity-100 text-primary bg-primary/10 hover:bg-primary/20" 
                            : "opacity-30 hover:opacity-100 group-hover/field:opacity-100 text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleGroupByToggle(col.name)}
                        title={isGrouped ? "Remove from Group By" : "Add to Group By"}
                      >
                        <FolderGit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Expanded field values */}
                  {isExpanded && canExpand && (
                    <div className="ml-8 pl-2 border-l border-muted mb-1">
                      {isLoadingValues ? (
                        <div className="flex items-center gap-1.5 py-1 px-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading values...
                        </div>
                      ) : values && values.length > 0 ? (
                        values.map((fv, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-1 py-0.5 px-2 rounded hover:bg-muted/50 group text-xs"
                          >
                            <span className="truncate font-mono min-w-0">
                              {fv.value === null || fv.value === undefined
                                ? "null"
                                : String(fv.value)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-muted-foreground tabular-nums">
                                {fv.count.toLocaleString()}
                              </span>
                              <div className="hidden group-hover:flex items-center gap-0.5">
                                {onFilterForValue && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    title="Filter for value"
                                    onClick={() =>
                                      onFilterForValue(col.name, fv.value)
                                    }
                                  >
                                    <Filter className="h-3 w-3" />
                                  </Button>
                                )}
                                {onFilterOutValue && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    title="Filter out value"
                                    onClick={() =>
                                      onFilterOutValue(col.name, fv.value)
                                    }
                                  >
                                    <FilterX className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground py-1 px-2">
                          No values found
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t text-xs text-muted-foreground">
        {selectedColumns.length} of {columns.length} fields selected
      </div>
    </div>
  );
}
