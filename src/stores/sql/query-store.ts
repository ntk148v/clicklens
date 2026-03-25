import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  timestamp: number;
  duration?: number;
  rowsReturned?: number;
  rowsRead?: number;
  bytesRead?: number;
  memoryUsage?: number;
  error?: string;
  user?: string;
}

export interface SqlQueryState {
  query: string;
  selectedTabId: string | null;
  queryHistory: QueryHistoryEntry[];
  maxHistorySize: number;
}

export interface SqlQueryActions {
  setQuery: (query: string) => void;
  setSelectedTab: (tabId: string | null) => void;
  addToHistory: (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
  executeQuery: (sql: string, options?: { duration?: number; rowsReturned?: number; rowsRead?: number; bytesRead?: number; memoryUsage?: number; user?: string }) => void;
  reset: () => void;
}

export type SqlQueryStore = SqlQueryState & SqlQueryActions;

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const initialState: SqlQueryState = {
  query: "",
  selectedTabId: null,
  queryHistory: [],
  maxHistorySize: 100,
};

export const useSqlQueryStore = create<SqlQueryStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setQuery: (query: string) => {
          set({ query }, false, "setQuery");
        },

        setSelectedTab: (tabId: string | null) => {
          set({ selectedTabId: tabId }, false, "setSelectedTab");
        },

        addToHistory: (entry) => {
          const historyEntry: QueryHistoryEntry = {
            ...entry,
            id: generateId(),
            timestamp: Date.now(),
          };

          set(
            (state) => ({
              queryHistory: [historyEntry, ...state.queryHistory].slice(
                0,
                state.maxHistorySize
              ),
            }),
            false,
            "addToHistory"
          );
        },

        clearHistory: () => {
          set({ queryHistory: [] }, false, "clearHistory");
        },

        executeQuery: (sql: string, options = {}) => {
          const { addToHistory } = get();
          addToHistory({
            sql,
            duration: options.duration,
            rowsReturned: options.rowsReturned,
            rowsRead: options.rowsRead,
            bytesRead: options.bytesRead,
            memoryUsage: options.memoryUsage,
            user: options.user,
          });
        },

        reset: () => {
          set({ ...initialState }, false, "reset");
        },
      }),
      {
        name: "clicklens-sql-query",
        partialize: (state) => ({
          query: state.query,
          selectedTabId: state.selectedTabId,
          queryHistory: state.queryHistory,
          maxHistorySize: state.maxHistorySize,
        }),
      }
    ),
    {
      name: "clicklens-sql-query",
      enabled: process.env.NODE_ENV !== "production",
    }
  )
);

export const sqlQuerySelectors = {
  currentQuery: (state: SqlQueryStore) => state.query,
  selectedTab: (state: SqlQueryStore) => state.selectedTabId,
  history: (state: SqlQueryStore) => state.queryHistory,
  lastQuery: (state: SqlQueryStore) =>
    state.queryHistory.length > 0 ? state.queryHistory[0] : null,
  errorHistory: (state: SqlQueryStore) =>
    state.queryHistory.filter((entry) => entry.error),
  historyByUser: (user: string) => (state: SqlQueryStore) =>
    state.queryHistory.filter((entry) => entry.user === user),
  totalQueries: (state: SqlQueryStore) => state.queryHistory.length,
  averageDuration: (state: SqlQueryStore) => {
    const entriesWithDuration = state.queryHistory.filter(
      (entry) => entry.duration !== undefined
    );
    if (entriesWithDuration.length === 0) return 0;
    const total = entriesWithDuration.reduce(
      (sum, entry) => sum + (entry.duration || 0),
      0
    );
    return total / entriesWithDuration.length;
  },
};
