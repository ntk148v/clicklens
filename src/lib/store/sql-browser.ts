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

// Lightweight column info for autocomplete (from schema/columns API)
export interface AutocompleteColumnInfo {
  name: string;
  type: string;
  is_in_primary_key: boolean;
  is_in_sorting_key: boolean;
  comment: string;
}

interface ColumnsCacheEntry {
  columns: AutocompleteColumnInfo[];
  timestamp: number;
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

  // Columns cache for autocomplete (with TTL)
  columnsCache: Record<string, ColumnsCacheEntry>;

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
  // Column caching for autocomplete
  getColumnsForTable: (
    database: string,
    table: string
  ) => Promise<AutocompleteColumnInfo[]>;
  invalidateColumnsCache: (pattern?: string) => void;
}

// TTL for columns cache (5 minutes)
const COLUMNS_CACHE_TTL = 5 * 60 * 1000;

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
  columnsCache: {},

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
      columnsCache: {},
    });
  },

  getColumnsForTable: async (
    database: string,
    table: string
  ): Promise<AutocompleteColumnInfo[]> => {
    const cacheKey = `${database}.${table}`;
    const { columnsCache } = get();
    const cached = columnsCache[cacheKey];

    // Check if cache is valid (within TTL)
    if (cached && Date.now() - cached.timestamp < COLUMNS_CACHE_TTL) {
      return cached.columns;
    }

    // Fetch from API
    try {
      const res = await fetch(
        `/api/clickhouse/schema/columns?database=${encodeURIComponent(
          database
        )}&table=${encodeURIComponent(table)}`
      );
      const data = await res.json();

      if (data.success && data.data) {
        const columns = data.data as AutocompleteColumnInfo[];

        // Update cache
        set((state) => ({
          columnsCache: {
            ...state.columnsCache,
            [cacheKey]: { columns, timestamp: Date.now() },
          },
        }));

        return columns;
      }
    } catch (e) {
      console.error("Failed to fetch columns for autocomplete", e);
    }

    return [];
  },

  invalidateColumnsCache: (pattern?: string) => {
    if (!pattern) {
      set({ columnsCache: {} });
      return;
    }

    const { columnsCache } = get();
    const newCache: Record<string, ColumnsCacheEntry> = {};

    for (const [key, value] of Object.entries(columnsCache)) {
      if (!key.startsWith(pattern)) {
        newCache[key] = value;
      }
    }

    set({ columnsCache: newCache });
  },
}));
