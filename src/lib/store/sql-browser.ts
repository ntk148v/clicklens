"use client";

import { create } from "zustand";

interface TableInfo {
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

  fetchDatabases: async () => {
    set({ loadingDatabases: true });
    try {
      const res = await fetch("/api/clickhouse/databases");
      const data = await res.json();
      if (data.success && data.data) {
        const dbNames = data.data.map((d: { name: string }) => d.name);
        set({ databases: dbNames, loadingDatabases: false });
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
    set({ selectedDatabase: db, loadingTables: true, selectedTable: null });
    try {
      const res = await fetch(
        `/api/clickhouse/tables?database=${encodeURIComponent(db)}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        set({ tables: data.data, loadingTables: false });
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
}));
