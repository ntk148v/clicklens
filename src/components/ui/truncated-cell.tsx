"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface TruncatedCellProps {
  value: string;
  className?: string;
  maxWidth?: number;
  showTooltip?: boolean;
}

export function TruncatedCell({
  value,
  className,
  maxWidth = 200,
  showTooltip = true,
}: TruncatedCellProps) {
  if (!value) return <span className="text-primary-foreground">-</span>;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn("truncate font-mono text-xs", className)}
            style={{ maxWidth }}
          >
            {value}
          </div>
        </TooltipTrigger>
        {showTooltip && (
          <TooltipContent className="max-w-[400px] break-all fg-popover text-primary-foreground border-border">
            <p className="font-mono text-xs whitespace-pre-wrap">{value}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
