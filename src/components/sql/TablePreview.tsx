"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
  ClickableTableRow,
} from "@/components/ui/table";
import { Database, Columns } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
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

  if (typeof value === "string") {
    // Try to detect if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return formatDateTime(value);
    }
  }

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
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clickhouse/tables/${encodeURIComponent(
            table
          )}?database=${encodeURIComponent(
            database
          )}&type=${previewTab}&timezone=${encodeURIComponent(
            Intl.DateTimeFormat().resolvedOptions().timeZone
          )}`
        );
        const result = await res.json();
        if (result.success) {
          if (previewTab === "structure" && result.columns) {
            setColumns(result.columns);
          } else if (previewTab === "data" && result.data) {
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

    fetchData();
  }, [database, table, previewTab]);

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  // Convert columns to meta format for ClickableTableRow
  const structureMeta = [
    { name: "name", type: "String" },
    { name: "type", type: "String" },
    { name: "default_kind", type: "String" },
    { name: "default_expression", type: "String" },
    { name: "comment", type: "String" },
  ];

  return (
    <Card className="flex flex-col h-full border-0 rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {database}.{table}
          </span>
          {previewTab === "data" && (
            <span className="text-xs text-muted-foreground">
              (showing first 100 rows)
            </span>
          )}
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

      {/* Content - TableWrapper for proper scrolling */}
      <TableWrapper className="flex-1 min-h-0">
        {previewTab === "structure" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-8" /> {/* Expand icon column */}
              </TableRow>
            </TableHeader>
            <TableBody isLoading={loading}>
              {columns.map((col, index) => (
                <ClickableTableRow
                  key={col.name}
                  record={col}
                  columns={structureMeta}
                  rowIndex={index}
                  sheetTitle={`Column: ${col.name}`}
                  expandable={true}
                >
                  <TableCell className="font-medium">{col.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {col.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {col.default_kind ? (
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {col.default_kind}: {col.default_expression}
                      </code>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {col.comment || "—"}
                  </TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {meta.map((col) => (
                  <TableHead key={col.name} className="whitespace-nowrap">
                    {col.name}
                  </TableHead>
                ))}
                <TableHead className="w-8" /> {/* Expand icon column */}
              </TableRow>
            </TableHeader>
            <TableBody isLoading={loading}>
              {paginatedData.map((row, i) => (
                <ClickableTableRow
                  key={i}
                  record={row}
                  columns={meta}
                  rowIndex={currentPage * pageSize + i}
                  sheetTitle={`Row ${currentPage * pageSize + i + 1}`}
                  expandable={true}
                >
                  {meta.map((col) => (
                    <TableCell
                      key={col.name}
                      className="max-w-[200px] truncate"
                    >
                      {formatCellValue(row[col.name])}
                    </TableCell>
                  ))}
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableWrapper>

      {previewTab === "data" && totalPages > 0 && (
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
