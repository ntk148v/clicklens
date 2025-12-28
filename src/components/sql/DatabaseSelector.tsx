"use client";

import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import { ChevronDown, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect } from "react";

export function DatabaseSelector() {
  const {
    databases,
    selectedDatabase,
    loadingDatabases,
    fetchDatabases,
    selectDatabase,
  } = useSqlBrowserStore();

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
          {loadingDatabases ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                {selectedDatabase || "Select database"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
        {databases.length === 0 ? (
          <DropdownMenuItem disabled>No databases found</DropdownMenuItem>
        ) : (
          databases.map((db) => (
            <DropdownMenuItem
              key={db}
              onClick={() => selectDatabase(db)}
              className={db === selectedDatabase ? "bg-accent" : ""}
            >
              <Database className="w-3.5 h-3.5 mr-2" />
              {db}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
