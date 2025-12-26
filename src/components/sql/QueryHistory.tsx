"use client";

import { useTabsStore } from "@/lib/store/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface QueryHistoryProps {
  onSelect?: (sql: string) => void;
}

export function QueryHistory({ onSelect }: QueryHistoryProps) {
  const { history, clearHistory, addTab } = useTabsStore();

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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-medium">Query History</h3>
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
        <div className="p-2 space-y-1">
          {history.map((entry) => (
            <button
              key={entry.id}
              className={cn(
                "w-full text-left p-3 rounded-md border border-transparent transition-colors",
                "hover:bg-muted hover:border-border",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
              onClick={() => handleSelect(entry.sql)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.timestamp)}
                </span>
                <div className="flex items-center gap-1">
                  {entry.error ? (
                    <AlertCircle className="w-3 h-3 text-red-600" />
                  ) : (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  )}
                  {entry.duration !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {entry.duration < 1
                        ? `${(entry.duration * 1000).toFixed(0)}ms`
                        : `${entry.duration.toFixed(2)}s`}
                    </span>
                  )}
                </div>
              </div>
              <pre className="text-xs font-mono truncate max-w-full overflow-hidden">
                {entry.sql.split("\n")[0].trim()}
              </pre>
              {entry.rowsReturned !== undefined && (
                <span className="text-xs text-muted-foreground mt-1 block">
                  {entry.rowsReturned} rows
                </span>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
