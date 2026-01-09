"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { DatabaseSelector } from "@/components/sql";
import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Database,
  Loader2,
  RefreshCw,
  LayoutDashboard,
  Layers,
  Columns,
  Server,
  Zap,
  Combine,
  Code,
} from "lucide-react";
import {
  OverviewTab,
  PartsTab,
  ColumnsTab,
  ReplicasTab,
  MutationsTab,
  MergesTab,
  DdlTab,
} from "@/components/tables";

export default function TablesPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Permission guard
  useEffect(() => {
    if (!authLoading && !permissions?.canBrowseTables) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  // Use the SQL browser store for database selection and tables
  const { selectedDatabase, tables, loadingTables } = useSqlBrowserStore();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  // Clear selected table when database changes
  useEffect(() => {
    // Defer to next tick to avoid set-state-in-effect lint warning
    const t = setTimeout(() => setSelectedTable(null), 0);
    return () => clearTimeout(t);
  }, [selectedDatabase]);

  // Auto-select first table when tables update and nothing selected
  useEffect(() => {
    // If no tables or loading, skip
    if (loadingTables || tables.length === 0) {
      return;
    }

    // If no selection, select first
    if (!selectedTable) {
      // Defer to next tick to avoid set-state-in-effect
      const t = setTimeout(() => setSelectedTable(tables[0].name), 0);
      return () => clearTimeout(t);
    }
  }, [tables, selectedTable, loadingTables]);

  const handleRefresh = () => {
    // Trigger re-fetch by incrementing refresh key
    // For table data, this refreshes the tab content
    setRefreshKey((k) => k + 1);
  };

  // Show loading while checking permissions
  if (authLoading || !permissions?.canBrowseTables) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Table Explorer" />

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {/* Selection Bar */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Database:</span>
              <DatabaseSelector />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Table:</span>
              <Select
                value={selectedTable || ""}
                onValueChange={setSelectedTable}
                disabled={!selectedDatabase || loadingTables}
              >
                <SelectTrigger className="w-[200px]">
                  {loadingTables ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SelectValue placeholder="Select table" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table.name} value={table.name}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTable && (
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
        </Card>

        {/* Main Content */}
        {!selectedDatabase || !selectedTable ? (
          <Card className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Database className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a database and table</p>
            <p className="text-sm mt-2">
              Choose a database and table to explore its structure and stats
            </p>
          </Card>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview" className="text-xs">
                <LayoutDashboard className="h-3 w-3 mr-1" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="parts" className="text-xs">
                <Layers className="h-3 w-3 mr-1" />
                Parts
              </TabsTrigger>
              <TabsTrigger value="columns" className="text-xs">
                <Columns className="h-3 w-3 mr-1" />
                Columns
              </TabsTrigger>
              <TabsTrigger value="replicas" className="text-xs">
                <Server className="h-3 w-3 mr-1" />
                Replicas
              </TabsTrigger>
              <TabsTrigger value="mutations" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Mutations
              </TabsTrigger>
              <TabsTrigger value="merges" className="text-xs">
                <Combine className="h-3 w-3 mr-1" />
                Merges
              </TabsTrigger>
              <TabsTrigger value="ddl" className="text-xs">
                <Code className="h-3 w-3 mr-1" />
                DDL
              </TabsTrigger>
            </TabsList>

            <Card className="flex-1 mt-4 overflow-auto">
              <TabsContent
                value="overview"
                className="m-0 h-full"
                key={`overview-${refreshKey}`}
              >
                <OverviewTab
                  database={selectedDatabase}
                  table={selectedTable}
                />
              </TabsContent>
              <TabsContent
                value="parts"
                className="m-0 h-full"
                key={`parts-${refreshKey}`}
              >
                <PartsTab database={selectedDatabase} table={selectedTable} />
              </TabsContent>
              <TabsContent
                value="columns"
                className="m-0 h-full"
                key={`columns-${refreshKey}`}
              >
                <ColumnsTab database={selectedDatabase} table={selectedTable} />
              </TabsContent>
              <TabsContent
                value="replicas"
                className="m-0 h-full"
                key={`replicas-${refreshKey}`}
              >
                <ReplicasTab
                  database={selectedDatabase}
                  table={selectedTable}
                />
              </TabsContent>
              <TabsContent
                value="mutations"
                className="m-0 h-full"
                key={`mutations-${refreshKey}`}
              >
                <MutationsTab
                  database={selectedDatabase}
                  table={selectedTable}
                />
              </TabsContent>
              <TabsContent
                value="merges"
                className="m-0 h-full"
                key={`merges-${refreshKey}`}
              >
                <MergesTab database={selectedDatabase} table={selectedTable} />
              </TabsContent>
              <TabsContent
                value="ddl"
                className="m-0 h-full"
                key={`ddl-${refreshKey}`}
              >
                <DdlTab database={selectedDatabase} table={selectedTable} />
              </TabsContent>
            </Card>
          </Tabs>
        )}
      </div>
    </div>
  );
}
