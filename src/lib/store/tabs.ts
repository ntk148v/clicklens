"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QueryHistoryEntry {
  id: string;
  sql: string;
  timestamp: number;
  duration?: number;
  rowsReturned?: number;
  error?: string;
}

interface Tab {
  id: string;
  name: string;
  sql: string;
  result: {
    data: Record<string, unknown>[];
    meta: Array<{ name: string; type: string }>;
    rows: number;
    rows_before_limit_at_least?: number;
    statistics: {
      elapsed: number;
      rows_read: number;
      bytes_read: number;
    };
  } | null;
  isRunning: boolean;
  error: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  } | null;
}

interface TabsState {
  tabs: Tab[];
  activeTabId: string | null;
  history: QueryHistoryEntry[];
  maxHistorySize: number;

  // Actions
  addTab: (tab?: Partial<Tab>) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  getActiveTab: () => Tab | undefined;

  // History actions
  addToHistory: (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function generateTabName(existingTabs: Tab[]): string {
  const existingNumbers = existingTabs
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
        const newTab: Tab = {
          id,
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
            tab.id === id ? { ...tab, ...updates } : tab
          ),
        }));
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId);
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
            state.maxHistorySize
          ),
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },
    }),
    {
      name: "clicklens-tabs",
      partialize: (state) => ({
        tabs: state.tabs.map((t) => ({
          ...t,
          result: null, // Don't persist results
          isRunning: false,
          error: null,
        })),
        activeTabId: state.activeTabId,
        history: state.history,
      }),
    }
  )
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
