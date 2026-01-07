"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type SortDirection = "asc" | "desc" | null;

interface SortableHeaderProps {
  column: string;
  children: React.ReactNode;
  sortedColumn?: string;
  sortDirection?: SortDirection;
  onSort: (column: string, direction: SortDirection) => void;
  className?: string;
}

export function SortableHeader({
  column,
  children,
  sortedColumn,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isSorted = sortedColumn === column;

  const toggleSort = () => {
    if (isSorted) {
      if (sortDirection === "asc") {
        onSort(column, "desc");
      } else if (sortDirection === "desc") {
        onSort(column, null);
      } else {
        onSort(column, "asc");
      }
    } else {
      onSort(column, "asc");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 data-[state=open]:bg-accent", className)}
      onClick={toggleSort}
    >
      <span>{children}</span>
      {isSorted ? (
        sortDirection === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : sortDirection === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        )
      ) : (
        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-0 hover:opacity-50" />
      )}
    </Button>
  );
}
