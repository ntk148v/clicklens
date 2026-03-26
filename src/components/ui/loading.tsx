"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Database, BarChart3, Hash } from "lucide-react";

interface StreamingProgressIndicatorProps {
  isStreaming: boolean;
  rowCount: number;
  totalHits: number;
  className?: string;
}

export function StreamingProgressIndicator({
  isStreaming,
  rowCount,
  totalHits,
  className,
}: StreamingProgressIndicatorProps) {
  const progressPercent = React.useMemo(() => {
    if (totalHits <= 0) return null;
    return Math.min(100, Math.round((rowCount / totalHits) * 100));
  }, [rowCount, totalHits]);

  if (!isStreaming) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 bg-muted/50 rounded-lg border animate-in fade-in-0 duration-200",
        className
      )}
      role="status"
      aria-label="Streaming data"
      data-testid="streaming-progress"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Streaming data...</span>
          <span className="font-mono text-xs">
            {rowCount.toLocaleString()}
            {totalHits > 0 && ` of ${totalHits.toLocaleString()}`} rows
          </span>
        </div>
        {progressPercent !== null ? (
          <Progress value={progressPercent} className="h-1.5" />
        ) : (
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary animate-pulse"
              style={{ width: "30%" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface CountProgressIndicatorProps {
  isCounting: boolean;
  currentCount?: number;
  className?: string;
}

export function CountProgressIndicator({
  isCounting,
  currentCount,
  className,
}: CountProgressIndicatorProps) {
  if (!isCounting) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20 animate-in fade-in-0 duration-200",
        className
      )}
      role="status"
      aria-label="Counting documents"
      data-testid="count-progress"
    >
      <Hash className="h-4 w-4 animate-pulse" />
      <span className="text-sm font-medium">
        Counting...
        {currentCount !== undefined && currentCount >= 0 && (
          <span className="ml-2 font-mono text-xs opacity-75">
            ({currentCount.toLocaleString()})
          </span>
        )}
      </span>
    </div>
  );
}

interface AggregationProgressIndicatorProps {
  isAggregating: boolean;
  aggregationType?: "histogram" | "group-by" | "custom";
  className?: string;
}

export function AggregationProgressIndicator({
  isAggregating,
  aggregationType = "histogram",
  className,
}: AggregationProgressIndicatorProps) {
  if (!isAggregating) return null;

  const labels = {
    histogram: "Building histogram...",
    "group-by": "Grouping data...",
    custom: "Aggregating...",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20 animate-in fade-in-0 duration-200",
        className
      )}
      role="status"
      aria-label="Aggregating data"
      data-testid="aggregation-progress"
    >
      <BarChart3 className="h-4 w-4 animate-pulse" />
      <span className="text-sm font-medium">{labels[aggregationType]}</span>
    </div>
  );
}

interface Operation {
  id: string;
  label: string;
  isActive: boolean;
  progress?: number;
  icon?: React.ReactNode;
}

interface CombinedProgressIndicatorProps {
  operations: Operation[];
  className?: string;
}

export function CombinedProgressIndicator({
  operations,
  className,
}: CombinedProgressIndicatorProps) {
  const activeOperations = operations.filter((op) => op.isActive);
  if (activeOperations.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border animate-in fade-in-0 duration-200",
        className
      )}
      role="status"
      aria-label="Multiple operations in progress"
      data-testid="combined-progress"
    >
      {activeOperations.map((op) => (
        <div
          key={op.id}
          className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border text-sm"
          data-testid={`operation-${op.id}`}
        >
          {op.icon || <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span className="text-muted-foreground">{op.label}</span>
          {op.progress !== undefined && (
            <span className="font-mono text-xs text-muted-foreground">
              {op.progress}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface QueryLoadingStateProps {
  isRunning: boolean;
  streamedRows?: number;
  className?: string;
}

export function QueryLoadingState({
  isRunning,
  streamedRows,
  className,
}: QueryLoadingStateProps) {
  if (!isRunning) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 bg-muted/50 rounded-lg border animate-in fade-in-0 duration-200",
        className
      )}
      role="status"
      aria-label="Query executing"
      data-testid="query-loading"
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <div className="flex-1">
        <div className="text-sm font-medium">Executing query...</div>
        {streamedRows !== undefined && streamedRows > 0 && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {streamedRows.toLocaleString()} rows received
          </div>
        )}
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function LoadingSkeleton({
  rows = 10,
  columns = 4,
  className,
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn("space-y-2 p-4", className)}
      role="status"
      aria-label="Loading content"
      data-testid="loading-skeleton"
    >
      <div className="flex gap-2 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 20}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface InlineLoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function InlineLoadingSpinner({
  className,
  size = "md",
}: InlineLoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Loader2
      className={cn("animate-spin", sizeClasses[size], className)}
      aria-label="Loading"
    />
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message = "Loading...",
  children,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div
          className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-20 animate-in fade-in-0 duration-200"
          data-testid="loading-overlay"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-lg border shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
