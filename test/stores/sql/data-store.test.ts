import { describe, it, expect, beforeEach } from "bun:test";
import { createSqlDataStore, type TabData, type QueryResult, type QueryError, type ExplainResult } from "@/stores/sql/data-store";

describe("SqlDataStore", () => {
  let store: ReturnType<typeof createSqlDataStore>;

  beforeEach(() => {
    store = createSqlDataStore();
  });

  describe("initial state", () => {
    it("should have empty tabs array", () => {
      const state = store.getState();
      expect(state.tabs).toEqual([]);
    });

    it("should have default maxTabs of 10", () => {
      const state = store.getState();
      expect(state.maxTabs).toBe(10);
    });
  });

  describe("addTab", () => {
    it("should add a new tab with default values", () => {
      const { addTab } = store.getState();
      const id = addTab();

      const state = store.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(id);
      expect(state.tabs[0].name).toBe("Query 1");
      expect(state.tabs[0].sql).toBe("SELECT 1");
      expect(state.tabs[0].result).toBeNull();
      expect(state.tabs[0].isRunning).toBe(false);
      expect(state.tabs[0].error).toBeNull();
      expect(state.tabs[0].createdAt).toBeTypeOf("number");
    });

    it("should add a tab with custom values", () => {
      const { addTab } = store.getState();
      const customTab: Partial<TabData> = {
        name: "Custom Query",
        sql: "SELECT * FROM users",
      };
      const id = addTab(customTab);

      const state = store.getState();
      expect(state.tabs[0].id).toBe(id);
      expect(state.tabs[0].name).toBe("Custom Query");
      expect(state.tabs[0].sql).toBe("SELECT * FROM users");
    });

    it("should generate sequential tab names", () => {
      const { addTab } = store.getState();
      addTab();
      addTab();
      addTab();

      const state = store.getState();
      expect(state.tabs[0].name).toBe("Query 1");
      expect(state.tabs[1].name).toBe("Query 2");
      expect(state.tabs[2].name).toBe("Query 3");
    });

    it("should handle gaps in tab numbering", () => {
      const { addTab, removeTab } = store.getState();
      const id1 = addTab();
      addTab();
      addTab();
      removeTab(id1);

      const id4 = addTab();
      const state = store.getState();
      const newTab = state.tabs.find((t) => t.id === id4);
      expect(newTab?.name).toBe("Query 4");
    });

    it("should enforce max tabs limit", () => {
      const { addTab } = store.getState();
      
      // Add 10 tabs (maxTabs = 10)
      for (let i = 0; i < 10; i++) {
        addTab();
      }

      let state = store.getState();
      expect(state.tabs).toHaveLength(10);

      // Add one more tab - should remove oldest
      addTab();
      state = store.getState();
      expect(state.tabs).toHaveLength(10);
      expect(state.tabs[0].name).toBe("Query 2"); // First tab removed
      expect(state.tabs[9].name).toBe("Query 11"); // New tab added
    });

    it("should return the new tab id", () => {
      const { addTab } = store.getState();
      const id = addTab();
      expect(id).toBeTypeOf("string");
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe("updateTab", () => {
    it("should update tab properties", () => {
      const { addTab, updateTab } = store.getState();
      const id = addTab();

      updateTab(id, { sql: "SELECT * FROM orders" });

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.sql).toBe("SELECT * FROM orders");
    });

    it("should not update non-existent tab", () => {
      const { updateTab } = store.getState();
      updateTab("non-existent-id", { sql: "SELECT 1" });

      const state = store.getState();
      expect(state.tabs).toHaveLength(0);
    });

    it("should update multiple properties at once", () => {
      const { addTab, updateTab } = store.getState();
      const id = addTab();

      updateTab(id, {
        sql: "SELECT * FROM users",
        name: "Users Query",
        isRunning: true,
      });

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.sql).toBe("SELECT * FROM users");
      expect(tab?.name).toBe("Users Query");
      expect(tab?.isRunning).toBe(true);
    });
  });

  describe("removeTab", () => {
    it("should remove a tab by id", () => {
      const { addTab, removeTab } = store.getState();
      const id1 = addTab();
      const id2 = addTab();

      removeTab(id1);

      const state = store.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(id2);
    });

    it("should not affect other tabs when removing", () => {
      const { addTab, removeTab } = store.getState();
      const id1 = addTab();
      const id2 = addTab();
      const id3 = addTab();

      removeTab(id2);

      const state = store.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.tabs.map((t) => t.id)).toEqual([id1, id3]);
    });

    it("should handle removing non-existent tab", () => {
      const { addTab, removeTab } = store.getState();
      addTab();

      removeTab("non-existent-id");

      const state = store.getState();
      expect(state.tabs).toHaveLength(1);
    });
  });

  describe("setTabResult", () => {
    it("should set result for a tab", () => {
      const { addTab, setTabResult } = store.getState();
      const id = addTab();

      const result: QueryResult = {
        data: [{ id: 1, name: "Test" }],
        meta: [
          { name: "id", type: "Int32" },
          { name: "name", type: "String" },
        ],
        rows: 1,
        statistics: {
          elapsed: 0.5,
          rows_read: 100,
          bytes_read: 1024,
        },
      };

      setTabResult(id, result);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.result).toEqual(result);
      expect(tab?.error).toBeNull(); // Error should be cleared
    });

    it("should clear result when set to null", () => {
      const { addTab, setTabResult, updateTab } = store.getState();
      const id = addTab();

      const result: QueryResult = {
        data: [{ id: 1 }],
        meta: [{ name: "id", type: "Int32" }],
        rows: 1,
        statistics: { elapsed: 0.1, rows_read: 10, bytes_read: 100 },
      };

      updateTab(id, { result });
      setTabResult(id, null);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.result).toBeNull();
    });

    it("should not affect non-existent tab", () => {
      const { setTabResult } = store.getState();
      const result: QueryResult = {
        data: [],
        meta: [],
        rows: 0,
        statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 },
      };

      setTabResult("non-existent-id", result);

      const state = store.getState();
      expect(state.tabs).toHaveLength(0);
    });
  });

  describe("setTabLoading", () => {
    it("should set loading state for a tab", () => {
      const { addTab, setTabLoading } = store.getState();
      const id = addTab();

      setTabLoading(id, true);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.isRunning).toBe(true);
    });

    it("should clear loading state", () => {
      const { addTab, setTabLoading } = store.getState();
      const id = addTab();

      setTabLoading(id, true);
      setTabLoading(id, false);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.isRunning).toBe(false);
    });
  });

  describe("setTabError", () => {
    it("should set error for a tab", () => {
      const { addTab, setTabError } = store.getState();
      const id = addTab();

      const error: QueryError = {
        code: 60,
        message: "Table not found",
        type: "TABLE_NOT_FOUND",
        userMessage: "The requested table does not exist",
        hint: "Check the table name",
      };

      setTabError(id, error);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.error).toEqual(error);
      expect(tab?.result).toBeNull(); // Result should be cleared
    });

    it("should clear error when set to null", () => {
      const { addTab, setTabError, updateTab } = store.getState();
      const id = addTab();

      const error: QueryError = {
        code: 60,
        message: "Error",
        type: "ERROR",
        userMessage: "Error occurred",
      };

      updateTab(id, { error });
      setTabError(id, null);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.error).toBeNull();
    });
  });

  describe("setTabExplainResult", () => {
    it("should set explain result for a tab", () => {
      const { addTab, setTabExplainResult } = store.getState();
      const id = addTab();

      const explainResult: ExplainResult = {
        type: "AST",
        data: "SELECT * FROM users",
      };

      setTabExplainResult(id, explainResult);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.explainResult).toEqual(explainResult);
    });

    it("should clear explain result when set to null", () => {
      const { addTab, setTabExplainResult, updateTab } = store.getState();
      const id = addTab();

      const explainResult: ExplainResult = {
        type: "PLAN",
        data: { plan: "test" },
      };

      updateTab(id, { explainResult });
      setTabExplainResult(id, null);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.explainResult).toBeNull();
    });
  });

  describe("setTabQueryId", () => {
    it("should set query id for a tab", () => {
      const { addTab, setTabQueryId } = store.getState();
      const id = addTab();

      setTabQueryId(id, "query-123");

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.queryId).toBe("query-123");
    });

    it("should clear query id when set to undefined", () => {
      const { addTab, setTabQueryId, updateTab } = store.getState();
      const id = addTab();

      updateTab(id, { queryId: "query-123" });
      setTabQueryId(id, undefined);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.queryId).toBeUndefined();
    });
  });

  describe("clearTabData", () => {
    it("should clear all data for a tab", () => {
      const { addTab, updateTab, clearTabData } = store.getState();
      const id = addTab();

      updateTab(id, {
        result: {
          data: [{ id: 1 }],
          meta: [{ name: "id", type: "Int32" }],
          rows: 1,
          statistics: { elapsed: 0.1, rows_read: 10, bytes_read: 100 },
        },
        error: {
          code: 60,
          message: "Error",
          type: "ERROR",
          userMessage: "Error",
        },
        explainResult: { type: "AST", data: "test" },
        queryId: "query-123",
        isRunning: true,
      });

      clearTabData(id);

      const state = store.getState();
      const tab = state.tabs.find((t) => t.id === id);
      expect(tab?.result).toBeNull();
      expect(tab?.error).toBeNull();
      expect(tab?.explainResult).toBeNull();
      expect(tab?.queryId).toBeUndefined();
      expect(tab?.isRunning).toBe(false);
    });
  });

  describe("clearAllTabsData", () => {
    it("should clear data for all tabs", () => {
      const { addTab, updateTab, clearAllTabsData } = store.getState();
      const id1 = addTab();
      const id2 = addTab();

      updateTab(id1, {
        result: {
          data: [{ id: 1 }],
          meta: [{ name: "id", type: "Int32" }],
          rows: 1,
          statistics: { elapsed: 0.1, rows_read: 10, bytes_read: 100 },
        },
        isRunning: true,
      });

      updateTab(id2, {
        error: {
          code: 60,
          message: "Error",
          type: "ERROR",
          userMessage: "Error",
        },
      });

      clearAllTabsData();

      const state = store.getState();
      state.tabs.forEach((tab) => {
        expect(tab.result).toBeNull();
        expect(tab.error).toBeNull();
        expect(tab.explainResult).toBeNull();
        expect(tab.queryId).toBeUndefined();
        expect(tab.isRunning).toBe(false);
      });
    });
  });

  describe("reset", () => {
    it("should reset store to initial state", () => {
      const { addTab, reset } = store.getState();
      addTab();
      addTab();

      reset();

      const state = store.getState();
      expect(state.tabs).toEqual([]);
      expect(state.maxTabs).toBe(10);
    });
  });

  describe("getTab", () => {
    it("should return tab by id", () => {
      const { addTab, getTab } = store.getState();
      const id = addTab({ name: "Test Tab" });

      const tab = getTab(id);
      expect(tab).toBeDefined();
      expect(tab?.name).toBe("Test Tab");
    });

    it("should return undefined for non-existent id", () => {
      const { getTab } = store.getState();
      const tab = getTab("non-existent-id");
      expect(tab).toBeUndefined();
    });
  });

  describe("getTabsByCreationOrder", () => {
    it("should return tabs sorted by creation time", () => {
      const { addTab, getTabsByCreationOrder } = store.getState();
      
      // Add tabs with small delays to ensure different timestamps
      const id1 = addTab({ name: "First" });
      const id2 = addTab({ name: "Second" });
      const id3 = addTab({ name: "Third" });

      const sortedTabs = getTabsByCreationOrder();
      expect(sortedTabs).toHaveLength(3);
      expect(sortedTabs[0].id).toBe(id1);
      expect(sortedTabs[1].id).toBe(id2);
      expect(sortedTabs[2].id).toBe(id3);
    });
  });

  describe("getTabsWithActiveFirst", () => {
    it("should return active tab first, then others by creation order", () => {
      const { addTab, getTabsWithActiveFirst } = store.getState();
      
      const id1 = addTab({ name: "First" });
      const id2 = addTab({ name: "Second" });
      const id3 = addTab({ name: "Third" });

      const tabsWithActiveFirst = getTabsWithActiveFirst(id2);
      expect(tabsWithActiveFirst).toHaveLength(3);
      expect(tabsWithActiveFirst[0].id).toBe(id2); // Active tab first
      expect(tabsWithActiveFirst[1].id).toBe(id1); // Then by creation order
      expect(tabsWithActiveFirst[2].id).toBe(id3);
    });

    it("should return all tabs by creation order when no active tab", () => {
      const { addTab, getTabsWithActiveFirst } = store.getState();
      
      const id1 = addTab({ name: "First" });
      const id2 = addTab({ name: "Second" });

      const tabs = getTabsWithActiveFirst(null);
      expect(tabs).toHaveLength(2);
      expect(tabs[0].id).toBe(id1);
      expect(tabs[1].id).toBe(id2);
    });

    it("should handle non-existent active tab id", () => {
      const { addTab, getTabsWithActiveFirst } = store.getState();
      
      const id1 = addTab({ name: "First" });
      const id2 = addTab({ name: "Second" });

      const tabs = getTabsWithActiveFirst("non-existent-id");
      expect(tabs).toHaveLength(2);
      expect(tabs[0].id).toBe(id1);
      expect(tabs[1].id).toBe(id2);
    });
  });

  describe("tab lifecycle", () => {
    it("should handle complete tab lifecycle", () => {
      const { addTab, updateTab, setTabLoading, setTabResult, setTabError, removeTab } = store.getState();

      // Create tab
      const id = addTab({ name: "Lifecycle Test" });
      let state = store.getState();
      expect(state.tabs).toHaveLength(1);

      // Start loading
      setTabLoading(id, true);
      state = store.getState();
      expect(state.tabs[0].isRunning).toBe(true);

      // Set result
      const result: QueryResult = {
        data: [{ id: 1 }],
        meta: [{ name: "id", type: "Int32" }],
        rows: 1,
        statistics: { elapsed: 0.5, rows_read: 100, bytes_read: 1024 },
      };
      setTabResult(id, result);
      state = store.getState();
      expect(state.tabs[0].result).toEqual(result);
      expect(state.tabs[0].isRunning).toBe(true); // Still running

      // Finish loading
      setTabLoading(id, false);
      state = store.getState();
      expect(state.tabs[0].isRunning).toBe(false);

      // Set error
      const error: QueryError = {
        code: 60,
        message: "Error",
        type: "ERROR",
        userMessage: "Error occurred",
      };
      setTabError(id, error);
      state = store.getState();
      expect(state.tabs[0].error).toEqual(error);
      expect(state.tabs[0].result).toBeNull(); // Result cleared

      // Remove tab
      removeTab(id);
      state = store.getState();
      expect(state.tabs).toHaveLength(0);
    });
  });

  describe("max tabs enforcement", () => {
    it("should remove oldest tab when max tabs reached", () => {
      const { addTab } = store.getState();
      
      // Add exactly maxTabs tabs
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(addTab({ name: `Tab ${i + 1}` }));
      }

      let state = store.getState();
      expect(state.tabs).toHaveLength(10);
      expect(state.tabs[0].name).toBe("Tab 1");

      // Add one more - should remove oldest
      const newId = addTab({ name: "New Tab" });
      state = store.getState();
      expect(state.tabs).toHaveLength(10);
      expect(state.tabs[0].name).toBe("Tab 2"); // First tab removed
      expect(state.tabs[9].id).toBe(newId); // New tab at end
    });

    it("should not remove tabs when under limit", () => {
      const { addTab } = store.getState();
      
      for (let i = 0; i < 5; i++) {
        addTab();
      }

      const state = store.getState();
      expect(state.tabs).toHaveLength(5);
    });
  });
});
