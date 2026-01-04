"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TruncatedCellProps {
  value: string | number | null | undefined;
  maxWidth?: number;
  className?: string;
}

/**
 * A table cell that truncates long content with "..." and shows full content on hover
 */
export function TruncatedCell({
  value,
  maxWidth = 150,
  className = "",
}: TruncatedCellProps) {
  const displayValue = value?.toString() || "-";

  // Don't need tooltip for short values
  if (displayValue.length <= 20) {
    return (
      <span className={`font-mono text-sm ${className}`}>{displayValue}</span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`font-mono text-sm block truncate cursor-help ${className}`}
            style={{ maxWidth }}
          >
            {displayValue}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md break-all">
          <p className="font-mono text-xs">{displayValue}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
