import { describe, it, expect, beforeEach } from "bun:test";
import { useTabsStore, initializeTabs, type QueryHistoryEntry } from "@/lib/store/tabs";

describe("useSqlPage - Tab Management Consolidation", () => {
  beforeEach(() => {
    useTabsStore.getState().reset();
  });

  describe("Tab Creation", () => {
    it("should create a new query tab with default SQL", () => {
      const tabId = useTabsStore.getState().addTab();

      expect(tabId).toBeDefined();
      expect(useTabsStore.getState().tabs.length).toBe(1);
      expect(useTabsStore.getState().tabs[0].type).toBe("query");
      expect(useTabsStore.getState().tabs[0].sql).toBe("SELECT 1");
      expect(useTabsStore.getState().tabs[0].isRunning).toBe(false);
      expect(useTabsStore.getState().tabs[0].error).toBeNull();
    });

    it("should create a tab with custom SQL", () => {
      const customSql = "SELECT * FROM users";

      useTabsStore.getState().addTab({ sql: customSql });

      expect(useTabsStore.getState().tabs[0].sql).toBe(customSql);
    });

    it("should auto-generate tab names sequentially", () => {
      useTabsStore.getState().addTab();
      useTabsStore.getState().addTab();
      useTabsStore.getState().addTab();

      expect(useTabsStore.getState().tabs[0].name).toBe("Query 1");
      expect(useTabsStore.getState().tabs[1].name).toBe("Query 2");
      expect(useTabsStore.getState().tabs[2].name).toBe("Query 3");
    });

    it("should set the new tab as active", () => {
      const tabId = useTabsStore.getState().addTab();

      expect(useTabsStore.getState().activeTabId).toBe(tabId);
    });
  });

  describe("Tab Switching", () => {
    it("should switch between tabs", () => {
      const tabId1 = useTabsStore.getState().addTab();
      const tabId2 = useTabsStore.getState().addTab();

      expect(useTabsStore.getState().activeTabId).toBe(tabId2);

      useTabsStore.getState().setActiveTab(tabId1);

      expect(useTabsStore.getState().activeTabId).toBe(tabId1);
    });

    it("should get the active tab correctly", () => {
      useTabsStore.getState().addTab({ name: "First Tab" });
      useTabsStore.getState().addTab({ name: "Second Tab" });

      useTabsStore.getState().setActiveTab(useTabsStore.getState().tabs[0].id);
      const activeTab = useTabsStore.getState().getActiveTab();

      expect(activeTab?.name).toBe("First Tab");
    });

    it("should get the active query tab only", () => {
      useTabsStore.getState().addTab({ name: "Query Tab" });
      useTabsStore.getState().addTableTab("mydb", "mytable");

      useTabsStore.getState().setActiveTab(useTabsStore.getState().tabs[0].id);
      const activeQueryTab = useTabsStore.getState().getActiveQueryTab();

      expect(activeQueryTab?.name).toBe("Query Tab");
      expect(activeQueryTab?.type).toBe("query");
    });

    it("should return undefined for active query tab when table tab is active", () => {
      useTabsStore.getState().addTab({ name: "Query Tab" });
      const tableTabId = useTabsStore.getState().addTableTab("mydb", "mytable");

      useTabsStore.getState().setActiveTab(tableTabId);
      const activeQueryTab = useTabsStore.getState().getActiveQueryTab();

      expect(activeQueryTab).toBeUndefined();
    });
  });

  describe("Tab Closing", () => {
    it("should remove a tab", () => {
      const tabId = useTabsStore.getState().addTab();
      expect(useTabsStore.getState().tabs.length).toBe(1);

      useTabsStore.getState().removeTab(tabId);

      expect(useTabsStore.getState().tabs.length).toBe(0);
    });

    it("should switch to another tab when active tab is closed", () => {
      const tabId1 = useTabsStore.getState().addTab();
      const tabId2 = useTabsStore.getState().addTab();

      expect(useTabsStore.getState().activeTabId).toBe(tabId2);

      useTabsStore.getState().removeTab(tabId2);

      expect(useTabsStore.getState().activeTabId).toBe(tabId1);
    });

    it("should set activeTabId to null when last tab is closed", () => {
      const tabId = useTabsStore.getState().addTab();
      useTabsStore.getState().removeTab(tabId);

      expect(useTabsStore.getState().activeTabId).toBeNull();
    });
  });

  describe("Tab Updates", () => {
    it("should update tab SQL content", () => {
      const tabId = useTabsStore.getState().addTab({ sql: "SELECT 1" });
      const newSql = "SELECT * FROM orders";

      useTabsStore.getState().updateTab(tabId, { sql: newSql });

      expect(useTabsStore.getState().tabs[0].sql).toBe(newSql);
    });

    it("should update tab running state", () => {
      const tabId = useTabsStore.getState().addTab();

      useTabsStore.getState().updateTab(tabId, { isRunning: true });

      expect(useTabsStore.getState().tabs[0].isRunning).toBe(true);
    });

    it("should update tab with query result", () => {
      const tabId = useTabsStore.getState().addTab();
      const result = {
        data: [{ id: 1, name: "Test" }],
        meta: [{ name: "id", type: "Int32" }, { name: "name", type: "String" }],
        rows: 1,
        statistics: {
          elapsed: 0.5,
          rows_read: 1,
          bytes_read: 100,
        },
      };

      useTabsStore.getState().updateTab(tabId, { result, isRunning: false });

      expect(useTabsStore.getState().tabs[0].result).toEqual(result);
      expect(useTabsStore.getState().tabs[0].isRunning).toBe(false);
    });

    it("should update tab with error", () => {
      const tabId = useTabsStore.getState().addTab();
      const error = {
        code: 404,
        message: "Table not found",
        type: "TABLE_NOT_FOUND",
        userMessage: "The requested table does not exist",
      };

      useTabsStore.getState().updateTab(tabId, { error, isRunning: false });

      expect(useTabsStore.getState().tabs[0].error).toEqual(error);
      expect(useTabsStore.getState().tabs[0].isRunning).toBe(false);
    });
  });

  describe("Query History", () => {
    it("should add successful query to history", () => {
      useTabsStore.getState().addToHistory({
        sql: "SELECT * FROM users",
        duration: 1.5,
        rowsReturned: 100,
        rowsRead: 1000,
        bytesRead: 50000,
        user: "testuser",
      });

      expect(useTabsStore.getState().history.length).toBe(1);
      expect(useTabsStore.getState().history[0].sql).toBe("SELECT * FROM users");
      expect(useTabsStore.getState().history[0].duration).toBe(1.5);
      expect(useTabsStore.getState().history[0].rowsReturned).toBe(100);
      expect(useTabsStore.getState().history[0].user).toBe("testuser");
      expect(useTabsStore.getState().history[0].id).toBeDefined();
      expect(useTabsStore.getState().history[0].timestamp).toBeDefined();
    });

    it("should add failed query to history with error", () => {
      useTabsStore.getState().addToHistory({
        sql: "SELECT * FROM nonexistent_table",
        error: "Table not found",
      });

      expect(useTabsStore.getState().history.length).toBe(1);
      expect(useTabsStore.getState().history[0].sql).toBe("SELECT * FROM nonexistent_table");
      expect(useTabsStore.getState().history[0].error).toBe("Table not found");
      expect(useTabsStore.getState().history[0].duration).toBeUndefined();
    });

    it("should maintain history in reverse chronological order", () => {
      useTabsStore.getState().addToHistory({ sql: "SELECT 1" });
      useTabsStore.getState().addToHistory({ sql: "SELECT 2" });
      useTabsStore.getState().addToHistory({ sql: "SELECT 3" });

      expect(useTabsStore.getState().history[0].sql).toBe("SELECT 3");
      expect(useTabsStore.getState().history[1].sql).toBe("SELECT 2");
      expect(useTabsStore.getState().history[2].sql).toBe("SELECT 1");
    });

    it("should limit history size to maxHistorySize", () => {
      const maxHistorySize = useTabsStore.getState().maxHistorySize;

      for (let i = 0; i < maxHistorySize + 10; i++) {
        useTabsStore.getState().addToHistory({ sql: `SELECT ${i}` });
      }

      expect(useTabsStore.getState().history.length).toBe(maxHistorySize);
    });

    it("should clear all history", () => {
      useTabsStore.getState().addToHistory({ sql: "SELECT 1" });
      useTabsStore.getState().addToHistory({ sql: "SELECT 2" });

      expect(useTabsStore.getState().history.length).toBe(2);

      useTabsStore.getState().clearHistory();

      expect(useTabsStore.getState().history.length).toBe(0);
    });
  });

  describe("History Persistence", () => {
    it("should persist history entries with all metadata", () => {
      const entry: Omit<QueryHistoryEntry, "id" | "timestamp"> = {
        sql: "SELECT * FROM events WHERE date > '2024-01-01'",
        duration: 2.5,
        rowsReturned: 5000,
        rowsRead: 10000,
        bytesRead: 1024000,
        memoryUsage: 512000,
        user: "analyst",
      };

      useTabsStore.getState().addToHistory(entry);

      const persistedEntry = useTabsStore.getState().history[0];
      expect(persistedEntry.sql).toBe(entry.sql);
      expect(persistedEntry.duration).toBe(entry.duration);
      expect(persistedEntry.rowsReturned).toBe(entry.rowsReturned);
      expect(persistedEntry.rowsRead).toBe(entry.rowsRead);
      expect(persistedEntry.bytesRead).toBe(entry.bytesRead);
      expect(persistedEntry.memoryUsage).toBe(entry.memoryUsage);
      expect(persistedEntry.user).toBe(entry.user);
    });
  });

  describe("Table Tabs", () => {
    it("should create a table tab", () => {
      const tabId = useTabsStore.getState().addTableTab("mydb", "users");

      expect(tabId).toBeDefined();
      expect(useTabsStore.getState().tabs.length).toBe(1);
      expect(useTabsStore.getState().tabs[0].type).toBe("table");
      expect(useTabsStore.getState().tabs[0].database).toBe("mydb");
      expect(useTabsStore.getState().tabs[0].table).toBe("users");
      expect(useTabsStore.getState().tabs[0].name).toBe("mydb.users");
    });

    it("should reuse existing table tab for same database.table", () => {
      const tabId1 = useTabsStore.getState().addTableTab("mydb", "users");
      const tabId2 = useTabsStore.getState().addTableTab("mydb", "users");

      expect(tabId1).toBe(tabId2);
      expect(useTabsStore.getState().tabs.length).toBe(1);
    });

    it("should create separate tabs for different tables", () => {
      useTabsStore.getState().addTableTab("mydb", "users");
      useTabsStore.getState().addTableTab("mydb", "orders");
      useTabsStore.getState().addTableTab("otherdb", "users");

      expect(useTabsStore.getState().tabs.length).toBe(3);
    });
  });

  describe("Initialization", () => {
    it("should initialize with default tab when empty", () => {
      useTabsStore.getState().reset();

      initializeTabs();

      expect(useTabsStore.getState().tabs.length).toBe(1);
      expect(useTabsStore.getState().tabs[0].sql).toContain("Welcome to ClickLens");
      expect(useTabsStore.getState().activeTabId).toBe(useTabsStore.getState().tabs[0].id);
    });

    it("should not add default tab if tabs already exist", () => {
      useTabsStore.getState().addTab({ sql: "SELECT 1" });
      const existingTabId = useTabsStore.getState().tabs[0].id;

      initializeTabs();

      expect(useTabsStore.getState().tabs.length).toBe(1);
      expect(useTabsStore.getState().activeTabId).toBe(existingTabId);
    });
  });

  describe("State Consolidation Verification", () => {
    it("should use single store for tabs and history", () => {
      const state = useTabsStore.getState();

      expect(state.tabs).toBeDefined();
      expect(state.activeTabId).toBeDefined();
      expect(state.history).toBeDefined();
      expect(state.addTab).toBeDefined();
      expect(state.removeTab).toBeDefined();
      expect(state.setActiveTab).toBeDefined();
      expect(state.updateTab).toBeDefined();
      expect(state.addToHistory).toBeDefined();
      expect(state.clearHistory).toBeDefined();
    });

    it("should not have dual history tracking after consolidation", () => {
      useTabsStore.getState().addToHistory({ sql: "SELECT 1" });

      expect(useTabsStore.getState().history.length).toBe(1);
      expect(useTabsStore.getState().history.filter(h => h.sql === "SELECT 1").length).toBe(1);
    });
  });
});
