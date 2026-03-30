import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Query result statistics
 */
export interface QueryStatistics {
  elapsed: number;
  rows_read: number;
  bytes_read: number;
  memory_usage?: number;
}

/**
 * Query result data structure
 */
export interface QueryResult {
  data: unknown[];
  meta: Array<{ name: string; type: string }>;
  rows: number;
  rows_before_limit_at_least?: number;
  statistics: QueryStatistics;
}

/**
 * Query error structure
 */
export interface QueryError {
  code: number;
  message: string;
  type: string;
  userMessage: string;
  category?: string;
  hint?: string;
}

/**
 * Explain result structure
 */
export interface ExplainResult {
  type: "AST" | "SYNTAX" | "PLAN" | "PIPELINE";
  data: string | object;
}

/**
 * Tab data structure
 */
export interface TabData {
  id: string;
  name: string;
  sql: string;
  result: QueryResult | null;
  isRunning: boolean;
  error: QueryError | null;
  queryId?: string;
  explainResult?: ExplainResult | null;
  createdAt: number;
}

/**
 * SQL data store state
 */
export interface SqlDataState {
  tabs: TabData[];
  maxTabs: number;
}

/**
 * SQL data store actions
 */
export interface SqlDataActions {
  // Tab management
  addTab: (tab?: Partial<TabData>) => string;
  updateTab: (id: string, updates: Partial<TabData>) => void;
  removeTab: (id: string) => void;
  
  // Result management
  setTabResult: (id: string, result: QueryResult | null) => void;
  
  // Loading state management
  setTabLoading: (id: string, isRunning: boolean) => void;
  
  // Error management
  setTabError: (id: string, error: QueryError | null) => void;
  
  // Explain result management
  setTabExplainResult: (id: string, explainResult: ExplainResult | null) => void;
  
  // Query ID management
  setTabQueryId: (id: string, queryId: string | undefined) => void;
  
  // Utility actions
  clearTabData: (id: string) => void;
  clearAllTabsData: () => void;
  reset: () => void;
  
  // Selectors
  getTab: (id: string) => TabData | undefined;
  getTabsByCreationOrder: () => TabData[];
  getTabsWithActiveFirst: (activeTabId: string | null) => TabData[];
}

/**
 * Combined store type
 */
export type SqlDataStore = SqlDataState & SqlDataActions;

/**
 * Generate unique ID for tabs
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Generate tab name based on existing tabs
 */
function generateTabName(existingTabs: TabData[]): string {
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

/**
 * Initial state
 */
const initialState: SqlDataState = {
  tabs: [],
  maxTabs: 10,
};

/**
 * Create SQL data store
 */
export const createSqlDataStore = () =>
  create<SqlDataStore>()(
    devtools(
      (set, get) => ({
        ...initialState,

        // Tab management
        addTab: (tabData) => {
          const { tabs, maxTabs } = get();
          
          // Check if we've reached max tabs
          if (tabs.length >= maxTabs) {
            // Remove oldest tab (first in array)
            const oldestTab = tabs[0];
            if (oldestTab) {
              set(
                (state) => ({
                  tabs: state.tabs.slice(1), // Remove oldest
                }),
                false,
                "removeOldestTab"
              );
            }
          }

          const id = tabData?.id || generateId();
          const newTab: TabData = {
            id,
            name: tabData?.name || generateTabName(get().tabs),
            sql: tabData?.sql || "SELECT 1",
            result: tabData?.result || null,
            isRunning: tabData?.isRunning || false,
            error: tabData?.error || null,
            queryId: tabData?.queryId,
            explainResult: tabData?.explainResult || null,
            createdAt: Date.now(),
          };

          set(
            (state) => ({
              tabs: [...state.tabs, newTab],
            }),
            false,
            "addTab"
          );

          return id;
        },

        updateTab: (id, updates) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, ...updates } : tab
              ),
            }),
            false,
            "updateTab"
          ),

        removeTab: (id) =>
          set(
            (state) => ({
              tabs: state.tabs.filter((tab) => tab.id !== id),
            }),
            false,
            "removeTab"
          ),

        // Result management
        setTabResult: (id, result) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, result, error: null } : tab
              ),
            }),
            false,
            "setTabResult"
          ),

        // Loading state management
        setTabLoading: (id, isRunning) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, isRunning } : tab
              ),
            }),
            false,
            "setTabLoading"
          ),

        // Error management
        setTabError: (id, error) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, error, result: null } : tab
              ),
            }),
            false,
            "setTabError"
          ),

        // Explain result management
        setTabExplainResult: (id, explainResult) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, explainResult } : tab
              ),
            }),
            false,
            "setTabExplainResult"
          ),

        // Query ID management
        setTabQueryId: (id, queryId) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, queryId } : tab
              ),
            }),
            false,
            "setTabQueryId"
          ),

        // Utility actions
        clearTabData: (id) =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) =>
                tab.id === id
                  ? {
                      ...tab,
                      result: null,
                      error: null,
                      explainResult: null,
                      queryId: undefined,
                      isRunning: false,
                    }
                  : tab
              ),
            }),
            false,
            "clearTabData"
          ),

        clearAllTabsData: () =>
          set(
            (state) => ({
              tabs: state.tabs.map((tab) => ({
                ...tab,
                result: null,
                error: null,
                explainResult: null,
                queryId: undefined,
                isRunning: false,
              })),
            }),
            false,
            "clearAllTabsData"
          ),

        reset: () => set(initialState, false, "reset"),

        // Selectors
        getTab: (id) => {
          const { tabs } = get();
          return tabs.find((tab) => tab.id === id);
        },

        getTabsByCreationOrder: () => {
          const { tabs } = get();
          return [...tabs].sort((a, b) => a.createdAt - b.createdAt);
        },

        getTabsWithActiveFirst: (activeTabId) => {
          const { tabs } = get();
          if (!activeTabId) {
            return [...tabs].sort((a, b) => a.createdAt - b.createdAt);
          }

          const activeTab = tabs.find((tab) => tab.id === activeTabId);
          const otherTabs = tabs
            .filter((tab) => tab.id !== activeTabId)
            .sort((a, b) => a.createdAt - b.createdAt);

          return activeTab ? [activeTab, ...otherTabs] : otherTabs;
        },
      }),
      {
        name: "sql-data-store",
        enabled: process.env.NODE_ENV !== "production",
      }
    )
  );

/**
 * Store hook type
 */
export type SqlDataStoreHook = ReturnType<typeof createSqlDataStore>;

/**
 * Default store instance
 */
export const sqlDataStore = createSqlDataStore();
