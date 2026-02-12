"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

interface QueryHistoryEntry {
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

interface QueryTab {
  id: string;
  type: "query";
  name: string;
  sql: string;
  result: {
    data: unknown[];
    meta: Array<{ name: string; type: string }>;
    rows: number;
    rows_before_limit_at_least?: number;
    statistics: {
      elapsed: number;
      rows_read: number;
      bytes_read: number;
      memory_usage?: number;
    };
  } | null;
  isRunning: boolean;
  error: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
    category?: string;
    hint?: string;
  } | null;
  queryId?: string;
  explainResult?: {
    type: "AST" | "SYNTAX" | "PLAN" | "PIPELINE";
    data: string | object;
  } | null;
}

interface TableTab {
  id: string;
  type: "table";
  name: string;
  database: string;
  table: string;
}

type Tab = QueryTab | TableTab;

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
  history: QueryHistoryEntry[];
  maxHistorySize: number;

  // Actions
  addTab: (tab?: Partial<QueryTab>) => string;
  addTableTab: (database: string, table: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<QueryTab>) => void;
  getActiveTab: () => Tab | undefined;
  getActiveQueryTab: () => QueryTab | undefined;

  // History actions
  addToHistory: (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
  reset: () => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function generateTabName(existingTabs: Tab[]): string {
  const queryTabs = existingTabs.filter(
    (t) => t.type === "query",
  ) as QueryTab[];
  const existingNumbers = queryTabs
    .map((t) => {
      const match = t.name.match(/^Query (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

  return `Query ${nextNumber}`;
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      history: [],
      maxHistorySize: 100,

      addTab: (tabData) => {
        const id = generateId();
        const { tabs } = get();
        const newTab: QueryTab = {
          id,
          type: "query",
          name: tabData?.name || generateTabName(tabs),
          sql: tabData?.sql || "SELECT 1",
          result: tabData?.result || null,
          isRunning: false,
          error: null,
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));

        return id;
      },

      addTableTab: (database: string, table: string) => {
        const { tabs, setActiveTab } = get();

        // Check if table tab already exists
        const existing = tabs.find(
          (t) =>
            t.type === "table" && t.database === database && t.table === table,
        );

        if (existing) {
          setActiveTab(existing.id);
          return existing.id;
        }

        const id = generateId();
        const newTab: TableTab = {
          id,
          type: "table",
          name: `${database}.${table}`,
          database,
          table,
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));

        return id;
      },

      removeTab: (id) => {
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;

          if (state.activeTabId === id) {
            const index = state.tabs.findIndex((t) => t.id === id);
            if (newTabs.length > 0) {
              newActiveId = newTabs[Math.min(index, newTabs.length - 1)].id;
            } else {
              newActiveId = null;
            }
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveId,
          };
        });
      },

      setActiveTab: (id) => {
        set({ activeTabId: id });
      },

      updateTab: (id, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === id && tab.type === "query"
              ? { ...tab, ...updates }
              : tab,
          ),
        }));
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId);
      },

      getActiveQueryTab: () => {
        const { tabs, activeTabId } = get();
        const tab = tabs.find((t) => t.id === activeTabId);
        return tab?.type === "query" ? tab : undefined;
      },

      addToHistory: (entry) => {
        const historyEntry: QueryHistoryEntry = {
          ...entry,
          id: generateId(),
          timestamp: Date.now(),
        };

        set((state) => ({
          history: [historyEntry, ...state.history].slice(
            0,
            state.maxHistorySize,
          ),
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },

      reset: () => {
        set({ tabs: [], activeTabId: null, history: [] });
      },
    }),
    {
      name: "clicklens-tabs",
      partialize: (state) => ({
        tabs: state.tabs
          .filter((t) => t.type === "query") // Only persist query tabs
          .map((t) => ({
            ...t,
            result: null,
            explainResult: null,
            isRunning: false,
            error: null,
          })),
        activeTabId: state.activeTabId,
        history: state.history,
      }),
    },
  ),
);

// Initialize with a default tab if none exist
export function initializeTabs() {
  const { tabs, addTab } = useTabsStore.getState();
  if (tabs.length === 0) {
    addTab({
      sql: "-- Welcome to ClickLens!\n-- Press Ctrl+Enter to execute queries\n\nSELECT version()",
    });
  }
}

export type { Tab, QueryTab, TableTab, QueryHistoryEntry };

/**
 * Optimized selector hooks for better performance.
 * These use shallow comparison to prevent unnecessary re-renders.
 */

/** Get tabs and activeTabId only - avoids re-renders from history changes */
export function useTabsOnly() {
  return useTabsStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    })),
  );
}

/** Get tab actions only - stable references that never cause re-renders */
export function useTabActions() {
  return useTabsStore(
    useShallow((state) => ({
      addTab: state.addTab,
      addTableTab: state.addTableTab,
      removeTab: state.removeTab,
      setActiveTab: state.setActiveTab,
      updateTab: state.updateTab,
    })),
  );
}

/** Get history only - avoids re-renders from tab changes */
export function useQueryHistory() {
  return useTabsStore(
    useShallow((state) => ({
      history: state.history,
      addToHistory: state.addToHistory,
      clearHistory: state.clearHistory,
    })),
  );
}

/** Get the active tab — only re-renders when the active tab itself changes */
export function useActiveTab() {
  return useTabsStore(
    (state) => state.tabs.find((t) => t.id === state.activeTabId),
  );
}

/** Get the active query tab only - returns undefined if active tab is not a query */
export function useActiveQueryTab() {
  const activeTab = useActiveTab();
  return activeTab?.type === "query" ? activeTab : undefined;
}
