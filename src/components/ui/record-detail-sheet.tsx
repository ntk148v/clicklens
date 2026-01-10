"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Copy, Check, FileJson } from "lucide-react";
import { useState } from "react";
import { cn, copyToClipboard } from "@/lib/utils";

interface ColumnMeta {
  name: string;
  type: string;
}

interface RecordDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Record<string, any> | unknown[] | null;
  columns: ColumnMeta[];
  title?: string;
  rowIndex?: number;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function getTypeColor(type: string): string {
  const lowerType = type.toLowerCase();
  if (
    lowerType.includes("int") ||
    lowerType.includes("float") ||
    lowerType.includes("decimal")
  ) {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  }
  if (lowerType.includes("string") || lowerType.includes("fixedstring")) {
    return "bg-green-500/10 text-green-600 dark:text-green-400";
  }
  if (lowerType.includes("date") || lowerType.includes("time")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  }
  if (lowerType.includes("bool")) {
    return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  }
  if (
    lowerType.includes("array") ||
    lowerType.includes("tuple") ||
    lowerType.includes("map")
  ) {
    return "bg-pink-500/10 text-pink-600 dark:text-pink-400";
  }
  return "bg-muted text-muted-foreground";
}

function getValueStyle(value: unknown): string {
  if (value === null || value === undefined)
    return "text-muted-foreground italic";
  if (typeof value === "number") return "text-blue-600 dark:text-blue-400";
  if (typeof value === "boolean") return "text-orange-600 dark:text-orange-400";
  if (typeof value === "object") return "text-pink-600 dark:text-pink-400";
  return "";
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 shrink-0", className)}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

export function RecordDetailSheet({
  open,
  onOpenChange,
  record,
  columns,
  title = "Record Details",
  rowIndex,
}: RecordDetailSheetProps) {
  // Convert array-based record to object if needed
  const recordObj = useMemo(() => {
    if (!record) return null;
    if (Array.isArray(record)) {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col.name] = record[i];
      });
      return obj;
    }
    return record as Record<string, unknown>;
  }, [record, columns]);

  const jsonString = useMemo(() => {
    if (!recordObj) return "";
    return JSON.stringify(recordObj, null, 2);
  }, [recordObj]);

  if (!recordObj) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[500px] sm:max-w-[500px] p-0 flex flex-col h-full overflow-hidden">
        <SheetHeader className="px-4 py-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle className="text-base">{title}</SheetTitle>
              {rowIndex !== undefined && (
                <SheetDescription>Row #{rowIndex + 1}</SheetDescription>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => copyToClipboard(jsonString)}
            >
              <FileJson className="h-4 w-4" />
              Copy JSON
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-1">
              {columns.map((col, idx) => {
                const value = recordObj[col.name];
                const formattedValue = formatValue(value);
                const isMultiline =
                  formattedValue.includes("\n") || formattedValue.length > 100;

                return (
                  <div
                    key={col.name}
                    className={cn(
                      "group rounded-lg p-3 hover:bg-muted/50 transition-colors",
                      idx % 2 === 0 ? "bg-muted/20" : ""
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {col.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 shrink-0",
                            getTypeColor(col.type)
                          )}
                        >
                          {col.type}
                        </Badge>
                      </div>
                      <CopyButton
                        text={formattedValue}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <div
                      className={cn(
                        "font-mono text-sm break-all",
                        getValueStyle(value),
                        isMultiline &&
                          "whitespace-pre-wrap bg-muted/50 rounded p-2 mt-1 max-h-[200px] overflow-auto"
                      )}
                    >
                      {formattedValue}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t px-4 py-3 bg-muted/30 shrink-0">
          <p className="text-xs text-muted-foreground">
            {columns.length} fields • Click outside or press Escape to close
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
