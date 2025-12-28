"use client";

import { useTabsStore } from "@/lib/store/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Trash2,
  Database,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "";
  if (ms < 1) return "< 1ms";
  if (ms < 1000) return `${ms.toFixed(0)} milliseconds`;
  return `${(ms / 1000).toFixed(2)} seconds`;
}

interface QueryHistoryProps {
  onSelect?: (sql: string) => void;
}

export function QueryHistory({ onSelect }: QueryHistoryProps) {
  const { history, clearHistory, addTab } = useTabsStore();
  const { user } = useAuth(); // Get current user for display context

  const handleSelect = (sql: string) => {
    if (onSelect) {
      onSelect(sql);
    } else {
      addTab({ sql });
    }
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No query history</p>
        <p className="text-xs mt-1">Executed queries will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Queries
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-red-600"
          onClick={clearHistory}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="group relative flex flex-col gap-2 pb-4 border-b last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border",
                    entry.error
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                      : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/50 dark:border-gray-800"
                  )}
                >
                  {entry.error ? (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Finished
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {entry.duration !== undefined
                    ? `Finished ${formatDuration(entry.duration * 1000)}`
                    : formatDate(entry.timestamp)}
                </span>
              </div>

              {/* Stats */}
              {!entry.error && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span>
                      Memory usage: {formatBytes(entry.memoryUsage || 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>
                      Read: {entry.rowsRead || 0} rows ({formatBytes(entry.bytesRead || 0)})
                    </span>
                  </div>
                </div>
              )}

              {/* User info */}
              <div className="text-xs text-muted-foreground">
                Ran by {entry.user || user?.username || "unknown"}
              </div>

              {/* SQL - Clickable */}
              <button
                onClick={() => handleSelect(entry.sql)}
                className="mt-1 text-left group-hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors"
                title="Click to use query"
              >
                <div className="text-xs font-mono text-foreground line-clamp-3 break-all">
                   {entry.sql}
                </div>
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
