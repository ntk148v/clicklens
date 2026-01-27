"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { fetchClient } from "@/lib/api/client";

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

interface TablePreviewResponse {
  columns?: ColumnInfo[];
  data?: Record<string, unknown>[];
  meta?: Array<{ name: string; type: string }>;
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
    type: "data" | "structure",
  ) => Promise<void>;
  setPreviewTab: (tab: "data" | "structure") => void;
  toggleSidebar: () => void;
  reset: () => void;
  // Column caching for autocomplete
  getColumnsForTable: (
    database: string,
    table: string,
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
      const dbNames = await fetchClient<{ name: string }[]>(
        "/api/clickhouse/databases",
      );
      if (dbNames) {
        const names = dbNames.map((d) => d.name);
        set({ databases: names, loadingDatabases: false });

        // Preload all tables
        try {
          const allTables = await fetchClient<TableInfo[]>(
            "/api/clickhouse/tables",
          );
          if (allTables) {
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
        if (names.length > 0 && !get().selectedDatabase) {
          get().selectDatabase(names[0]);
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
      const tables = await fetchClient<TableInfo[]>(
        `/api/clickhouse/tables?database=${encodeURIComponent(db)}`,
      );

      if (tables) {
        set((state) => ({
          tables: tables,
          loadingTables: false,
          tablesCache: { ...state.tablesCache, [db]: tables },
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
      const result = await fetchClient<TablePreviewResponse>(
        `/api/clickhouse/tables/${encodeURIComponent(
          table,
        )}?database=${encodeURIComponent(selectedDatabase)}&type=${type}`,
      );

      if (result) {
        if (type === "structure" && result.columns) {
          set({ tableColumns: result.columns, loadingTablePreview: false });
        } else if (type === "data" && result.data) {
          set({
            tableData: result.data,
            tableMeta: result.meta || [],
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
    table: string,
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
      const columns = await fetchClient<AutocompleteColumnInfo[]>(
        `/api/clickhouse/schema/columns?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`,
      );

      if (columns) {
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

/**
 * Optimized selector hooks for better performance.
 * These use shallow comparison to prevent unnecessary re-renders.
 */

/** Get databases list only */
export function useDatabases() {
  return useSqlBrowserStore(
    useShallow((state) => ({
      databases: state.databases,
      selectedDatabase: state.selectedDatabase,
      loadingDatabases: state.loadingDatabases,
      selectDatabase: state.selectDatabase,
      fetchDatabases: state.fetchDatabases,
    })),
  );
}

/** Get tables list only */
export function useTables() {
  return useSqlBrowserStore(
    useShallow((state) => ({
      tables: state.tables,
      loadingTables: state.loadingTables,
    })),
  );
}

/** Get sidebar state only */
export function useSidebarState() {
  return useSqlBrowserStore(
    useShallow((state) => ({
      sidebarCollapsed: state.sidebarCollapsed,
      toggleSidebar: state.toggleSidebar,
    })),
  );
}

/** Get columns for autocomplete */
export function useColumnsForAutocomplete() {
  return useSqlBrowserStore((state) => state.getColumnsForTable);
}
