"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, HelpCircle, History, X, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueryBarProps {
  value: string;
  onChange: (query: string) => void;
  onExecute: (query: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  isDirty?: boolean;
  placeholder?: string;
  error?: string | null;
  className?: string;
}

const QUERY_HISTORY_KEY = "clicklens_discover_query_history";
const MAX_HISTORY_ITEMS = 20;

export function QueryBar({
  value,
  onChange,
  onExecute,
  onCancel,
  isLoading = false,
  isDirty = false,
  placeholder = "Enter filter expression, e.g. status >= 400 AND host LIKE '%api%'",
  error = null,
  className,
}: QueryBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedChangeRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(QUERY_HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
    return [];
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExecute = useCallback(() => {
    if (debouncedChangeRef.current) {
      clearTimeout(debouncedChangeRef.current);
    }

    const query = localValue;
    onChange(query);

    if (query.trim()) {
      setHistory((prev) => {
        const filtered = prev.filter((q) => q !== query.trim());
        const updated = [query.trim(), ...filtered].slice(0, MAX_HISTORY_ITEMS);
        try {
          localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // Ignore localStorage errors
        }
        return updated;
      });
    }

    onExecute(query);
  }, [localValue, onChange, onExecute]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);

    if (debouncedChangeRef.current) {
      clearTimeout(debouncedChangeRef.current);
    }

    debouncedChangeRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute],
  );

  const handleHistorySelect = useCallback(
    (query: string) => {
      setLocalValue(query);
      onChange(query);
      setHistoryOpen(false);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-20 font-mono text-sm",
            error && "border-destructive focus-visible:ring-destructive",
            isDirty &&
              !error &&
              "border-yellow-500/50 focus-visible:ring-yellow-500/50",
          )}
          disabled={isLoading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {localValue && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
              disabled={isLoading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}

          <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={history.length === 0}
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <div className="p-2 border-b">
                <p className="text-sm font-medium">Recent Queries</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {history.map((query, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-muted truncate"
                    onClick={() => handleHistorySelect(query)}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Query Syntax Help</p>
                  <p className="text-muted-foreground">
                    Enter a ClickHouse WHERE clause expression:
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      <code className="bg-muted px-1 rounded">
                        level = &apos;Error&apos;
                      </code>
                      <span className="text-xs ml-1">(quote strings!)</span>
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded">
                        status &gt;= 400
                      </code>
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded">
                        host LIKE &apos;%api%&apos;
                      </code>
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded">
                        level IN (&apos;Error&apos;, &apos;Fatal&apos;)
                      </code>
                    </li>
                    <li>
                      <code className="bg-muted px-1 rounded">
                        message ILIKE &apos;%timeout%&apos;
                      </code>
                    </li>
                  </ul>
                  <p className="text-muted-foreground text-xs">
                    Press <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">Enter</kbd> to execute
                    {" "}&bull;{" "}
                    <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">⌘/Ctrl+Enter</kbd> from anywhere
                    {" "}&bull;{" "}
                    <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">Esc</kbd> to cancel
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {isLoading ? (
        <Button
          variant="destructive"
          onClick={onCancel}
          className="shrink-0"
        >
          <Square className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      ) : (
        <Button
          onClick={handleExecute}
          className={cn(
            "shrink-0",
            isDirty &&
              "ring-2 ring-yellow-500/50 ring-offset-1 ring-offset-background",
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      )}
    </div>
  );
}
