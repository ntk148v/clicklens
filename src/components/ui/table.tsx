"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <ScrollArea className="w-full h-full relative" type="auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b sticky top-0 bg-background z-10 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] font-mono",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

// Sortable Table Head Component
export interface SortableTableHeadProps extends React.ComponentProps<"th"> {
  onSort?: (direction: "asc" | "desc" | null) => void;
  currentSort?: "asc" | "desc" | null;
  sortable?: boolean;
}

function SortableTableHead({
  className,
  children,
  onSort,
  currentSort,
  sortable = true,
  ...props
}: SortableTableHeadProps) {
  const handleSort = () => {
    if (!onSort) return;
    if (currentSort === "asc") onSort("desc");
    else if (currentSort === "desc") onSort(null);
    else onSort("asc");
  };

  if (!sortable) {
    return (
      <TableHead className={className} {...props}>
        {children}
      </TableHead>
    );
  }

  return (
    <TableHead className={className} {...props}>
      <div
        className="flex items-center gap-1 cursor-pointer select-none group"
        onClick={handleSort}
      >
        <span>{children}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-auto opacity-50 group-hover:opacity-100 data-[sorted=true]:opacity-100"
          data-sorted={!!currentSort}
        >
          {currentSort === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : currentSort === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </div>
    </TableHead>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  SortableTableHead,
};
