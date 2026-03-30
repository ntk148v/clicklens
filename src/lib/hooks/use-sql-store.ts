import { useMemo, useState, useCallback } from "react";

export interface SqlQueryTab {
  id: string;
  type: "query";
  sql: string;
  isRunning: boolean;
  result: SqlQueryResult | null;
  error: SqlError | null;
  queryId: string | undefined;
  explainResult: { type: string; data: string | object } | null;
}

export interface SqlTableTab {
  id: string;
  type: "table";
  database: string;
  table: string;
}

export type SqlTab = SqlQueryTab | SqlTableTab;

export interface SqlQueryResult {
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
}

export interface SqlError {
  code: number;
  type: string;
  category?: string;
  message: string;
  userMessage: string;
  hint?: string;
}

export interface SqlHistoryEntry {
  id: string;
  sql: string;
  timestamp: Date;
  duration?: number;
  rowsReturned?: number;
  rowsRead?: number;
  bytesRead?: number;
  memoryUsage?: number;
  error?: string;
  user?: string;
}

export interface SqlStoreState {
  tabs: SqlTab[];
  activeTabId: string | null;
  history: SqlHistoryEntry[];
  selectedDatabase: string;
  databases: string[];
  tables: Array<{ name: string; engine: string }>;
}

export interface SqlStoreActions {
  addTab: (tab?: Partial<SqlQueryTab>) => string;
  updateTab: (id: string, updates: Partial<SqlTab>) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  getActiveQueryTab: () => SqlQueryTab | null;
  addToHistory: (entry: Omit<SqlHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
  setSelectedDatabase: (db: string) => void;
  setDatabases: (dbs: string[]) => void;
  setTables: (tables: Array<{ name: string; engine: string }>) => void;
  getColumnsForTable: (database: string, table: string) => string[];
}

export function useSqlStore(): SqlStoreState & SqlStoreActions {
  const [tabs, setTabs] = useState<SqlTab[]>([
    {
      id: "default",
      type: "query",
      sql: "",
      isRunning: false,
      result: null,
      error: null,
      queryId: undefined,
      explainResult: null,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>("default");
  const [history, setHistory] = useState<SqlHistoryEntry[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<Array<{ name: string; engine: string }>>([]);

  const addTab = useCallback((tab?: Partial<SqlQueryTab>) => {
    const id = `tab-${Date.now()}`;
    const newTab: SqlQueryTab = {
      id,
      type: "query",
      sql: "",
      isRunning: false,
      result: null,
      error: null,
      queryId: undefined,
      explainResult: null,
      ...tab,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    return id;
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<SqlTab>) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== id) return tab;
        if (tab.type === "query") {
          return { ...tab, ...updates } as SqlQueryTab;
        }
        return { ...tab, ...updates } as SqlTableTab;
      }),
    );
  }, []);

  const removeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((tab) => tab.id !== id);
      if (filtered.length === 0) {
        const defaultTab: SqlQueryTab = {
          id: "default",
          type: "query",
          sql: "",
          isRunning: false,
          result: null,
          error: null,
          queryId: undefined,
          explainResult: null,
        };
        return [defaultTab];
      }
      return filtered;
    });
    setActiveTabId((prev) => {
      if (prev === id) {
        return tabs.find((t) => t.id !== id)?.id || "default";
      }
      return prev;
    });
  }, [tabs]);

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const getActiveQueryTab = useCallback(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    return tab?.type === "query" ? tab : null;
  }, [tabs, activeTabId]);

  const addToHistory = useCallback(
    (entry: Omit<SqlHistoryEntry, "id" | "timestamp">) => {
      const historyEntry: SqlHistoryEntry = {
        ...entry,
        id: `history-${Date.now()}`,
        timestamp: new Date(),
      };
      setHistory((prev) => [historyEntry, ...prev].slice(0, 100));
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getColumnsForTable = useCallback(
    (_database: string, _table: string) => {
      return [];
    },
    [],
  );

  return useMemo(
    () => ({
      tabs,
      activeTabId,
      history,
      selectedDatabase,
      databases,
      tables,
      addTab,
      updateTab,
      removeTab,
      setActiveTab,
      getActiveQueryTab,
      addToHistory,
      clearHistory,
      setSelectedDatabase,
      setDatabases,
      setTables,
      getColumnsForTable,
    }),
    [
      tabs,
      activeTabId,
      history,
      selectedDatabase,
      databases,
      tables,
      addTab,
      updateTab,
      removeTab,
      setActiveTab,
      getActiveQueryTab,
      addToHistory,
      clearHistory,
      getColumnsForTable,
    ],
  );
}

export function useSqlQueryState() {
  const { tabs, activeTabId, getActiveQueryTab, updateTab, addTab, removeTab, setActiveTab } =
    useSqlStore();
  return { tabs, activeTabId, getActiveQueryTab, updateTab, addTab, removeTab, setActiveTab };
}

export function useSqlHistoryState() {
  const { history, addToHistory, clearHistory } = useSqlStore();
  return { history, addToHistory, clearHistory };
}
