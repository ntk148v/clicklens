"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Database, Columns } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaginationControls } from "../monitoring";

interface ColumnInfo {
  name: string;
  type: string;
  default_kind: string;
  default_expression: string;
  comment: string;
}

interface TablePreviewProps {
  database: string;
  table: string;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TablePreview({ database, table }: TablePreviewProps) {
  const [pageSize, setPageSize] = useState(50);
  const [previewTab, setPreviewTab] = useState<"data" | "structure">("data");
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<Array<{ name: string; type: string }>>([]);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    fetchData(previewTab);
  }, [database, table, previewTab]);

  const fetchData = async (type: "data" | "structure") => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clickhouse/tables/${encodeURIComponent(
          table
        )}?database=${encodeURIComponent(database)}&type=${type}`
      );
      const result = await res.json();
      if (result.success) {
        if (type === "structure" && result.columns) {
          setColumns(result.columns);
        } else if (type === "data" && result.data) {
          setData(result.data);
          setMeta(result.meta || []);
          setCurrentPage(0);
        }
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  return (
    <Card className="flex flex-col h-full border-0 rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {database}.{table}
          </span>
        </div>
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
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
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
                {columns.map((col) => (
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
                  {meta.map((col) => (
                    <TableHead key={col.name} className="whitespace-nowrap">
                      {col.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, i) => (
                  <TableRow key={i}>
                    {meta.map((col) => (
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
      <div className="flex items-center justify-between px-4 py-1.5 border-t text-xs text-muted-foreground bg-muted/30">
        <span>
          {previewTab === "data"
            ? `${data.length} rows`
            : `${columns.length} columns`}
        </span>
      </div>
      {previewTab === "data" && (
        <PaginationControls
          page={currentPage + 1}
          totalPages={totalPages}
          totalItems={data.length}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p - 1)}
          onPageSizeChange={setPageSize}
        />
      )}
    </Card>
  );
}
