"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  // If totalPages is -1 or undefined, we are in "unknown total" mode (server-side pagination without count)
  const isUnknownTotal = totalPages === -1 || totalPages === undefined;

  // Logic:
  // If distinct totalPages is > 1 => show
  // If unknown total => show (assume at least potentially more pages)
  if (!isUnknownTotal && totalPages <= 1 && !onPageSizeChange) return null;

  const start = (page - 1) * pageSize + 1;
  // If unknown total, we don't know end exactly unless we pass current page rows.
  // But typically usage passes totalItems as "known so far".
  // For now let's just show "Showing X-..." or just "Page X"

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {isUnknownTotal ? (
            <span>
              Showing {start}-{page * pageSize}
            </span>
          ) : (
            <span>
              Showing {start}-{Math.min(page * pageSize, totalItems)} of{" "}
              {totalItems}
            </span>
          )}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[50, 100, 200, 500, 1000].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </Button>

        {!isUnknownTotal && (
          <span className="text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!isUnknownTotal && page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
