"use client";

import { create } from "zustand";

interface TableInfo {
  database?: string;
  name: string;
  engine: string;
  total_rows: number;
  total_bytes: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  default_kind: string;
  default_expression: string;
  comment: string;
}

interface SqlBrowserState {
  // Databases
  databases: string[];
  selectedDatabase: string | null;
  loadingDatabases: boolean;

  // Tables
  tables: TableInfo[];
  loadingTables: boolean;
  tablesCache: Record<string, TableInfo[]>;

  // Selected table preview
  selectedTable: string | null;
  tableColumns: ColumnInfo[];
  tableData: Record<string, unknown>[];
  tableMeta: Array<{ name: string; type: string }>;
  loadingTablePreview: boolean;
  previewTab: "data" | "structure";

  // Sidebar
  sidebarCollapsed: boolean;

  // Actions
  fetchDatabases: () => Promise<void>;
  selectDatabase: (db: string) => Promise<void>;
  selectTable: (table: string | null) => void;
  fetchTablePreview: (
    table: string,
    type: "data" | "structure"
  ) => Promise<void>;
  setPreviewTab: (tab: "data" | "structure") => void;
  toggleSidebar: () => void;
  reset: () => void;
}

export const useSqlBrowserStore = create<SqlBrowserState>()((set, get) => ({
  databases: [],
  selectedDatabase: null,
  loadingDatabases: false,
  tables: [],
  loadingTables: false,
  selectedTable: null,
  tableColumns: [],
  tableData: [],
  tableMeta: [],
  loadingTablePreview: false,
  previewTab: "data",
  sidebarCollapsed: false,

  tablesCache: {},

  fetchDatabases: async () => {
    set({ loadingDatabases: true });
    try {
      const res = await fetch("/api/clickhouse/databases");
      const data = await res.json();
      if (data.success && data.data) {
        const dbNames = data.data.map((d: { name: string }) => d.name);
        set({ databases: dbNames, loadingDatabases: false });

        // Preload all tables
        // We do this in the background or immediately if list is small?
        // Let's do it immediately to ensure cache is hot.
        try {
          const tableRes = await fetch("/api/clickhouse/tables");
          const tableResult = await tableRes.json();
          if (tableResult.success && tableResult.data) {
            const allTables = tableResult.data as TableInfo[];
            const cache: Record<string, TableInfo[]> = {};

            // Group by database
            allTables.forEach((t) => {
              const db = t.database || "default";
              if (!cache[db]) cache[db] = [];
              cache[db].push(t);
            });

            set({ tablesCache: cache });
          }
        } catch (e) {
          console.error("Failed to preload tables", e);
        }

        // Auto-select first database if none selected
        if (dbNames.length > 0 && !get().selectedDatabase) {
          get().selectDatabase(dbNames[0]);
        }
      } else {
        set({ loadingDatabases: false });
      }
    } catch {
      set({ loadingDatabases: false });
    }
  },

  selectDatabase: async (db: string) => {
    const { tablesCache } = get();

    // Use cache if available
    if (tablesCache[db]) {
      set({
        selectedDatabase: db,
        tables: tablesCache[db],
        selectedTable: null,
      });
      return;
    }

    set({ selectedDatabase: db, loadingTables: true, selectedTable: null });

    // Fallback to fetch if not cached (though fetchDatabases should have populated it)
    try {
      const res = await fetch(
        `/api/clickhouse/tables?database=${encodeURIComponent(db)}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        set((state) => ({
          tables: data.data,
          loadingTables: false,
          tablesCache: { ...state.tablesCache, [db]: data.data },
        }));
      } else {
        set({ tables: [], loadingTables: false });
      }
    } catch {
      set({ tables: [], loadingTables: false });
    }
  },

  selectTable: (table: string | null) => {
    set({
      selectedTable: table,
      tableData: [],
      tableColumns: [],
      tableMeta: [],
    });
    if (table) {
      get().fetchTablePreview(table, get().previewTab);
    }
  },

  fetchTablePreview: async (table: string, type: "data" | "structure") => {
    const { selectedDatabase } = get();
    if (!selectedDatabase) return;

    set({ loadingTablePreview: true });
    try {
      const res = await fetch(
        `/api/clickhouse/tables/${encodeURIComponent(
          table
        )}?database=${encodeURIComponent(selectedDatabase)}&type=${type}`
      );
      const data = await res.json();
      if (data.success) {
        if (type === "structure" && data.columns) {
          set({ tableColumns: data.columns, loadingTablePreview: false });
        } else if (type === "data" && data.data) {
          set({
            tableData: data.data,
            tableMeta: data.meta || [],
            loadingTablePreview: false,
          });
        } else {
          set({ loadingTablePreview: false });
        }
      } else {
        set({ loadingTablePreview: false });
      }
    } catch {
      set({ loadingTablePreview: false });
    }
  },

  setPreviewTab: (tab: "data" | "structure") => {
    set({ previewTab: tab });
    const { selectedTable } = get();
    if (selectedTable) {
      get().fetchTablePreview(selectedTable, tab);
    }
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  reset: () => {
    set({
      databases: [],
      selectedDatabase: null,
      loadingDatabases: false,
      tables: [],
      loadingTables: false,
      selectedTable: null,
      tableColumns: [],
      tableData: [],
      tableMeta: [],
      loadingTablePreview: false,
      previewTab: "data",
      tablesCache: {},
    });
  },
}));
