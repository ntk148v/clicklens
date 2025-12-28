"use client";

import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, X, Database, Columns } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TablePreview() {
  const {
    selectedTable,
    selectedDatabase,
    tableColumns,
    tableData,
    tableMeta,
    loadingTablePreview,
    previewTab,
    setPreviewTab,
    selectTable,
  } = useSqlBrowserStore();

  if (!selectedTable) {
    return null;
  }

  return (
    <Card className="flex flex-col h-full border-t-0 rounded-t-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {selectedDatabase}.{selectedTable}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 rounded-none text-xs",
                previewTab === "data" && "bg-accent"
              )}
              onClick={() => setPreviewTab("data")}
            >
              <Database className="w-3 h-3 mr-1" />
              Data
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 rounded-none text-xs border-l",
                previewTab === "structure" && "bg-accent"
              )}
              onClick={() => setPreviewTab("structure")}
            >
              <Columns className="w-3 h-3 mr-1" />
              Structure
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectTable(null)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loadingTablePreview ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : previewTab === "structure" ? (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableColumns.map((col) => (
                  <TableRow key={col.name}>
                    <TableCell className="font-mono font-medium">
                      {col.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {col.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {col.default_kind ? (
                        <code>
                          {col.default_kind}: {col.default_expression}
                        </code>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {col.comment || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  {tableMeta.map((col) => (
                    <TableHead key={col.name} className="whitespace-nowrap">
                      {col.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row, i) => (
                  <TableRow key={i}>
                    {tableMeta.map((col) => (
                      <TableCell
                        key={col.name}
                        className="font-mono text-xs max-w-[200px] truncate"
                      >
                        {formatCellValue(row[col.name])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t text-xs text-muted-foreground bg-muted/30">
        {previewTab === "data"
          ? `${tableData.length} rows (preview limited to 100)`
          : `${tableColumns.length} columns`}
      </div>
    </Card>
  );
}
