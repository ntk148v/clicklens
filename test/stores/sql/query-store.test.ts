import { describe, expect, test, beforeEach } from "bun:test";
import { useSqlQueryStore, sqlQuerySelectors } from "../../../src/stores/sql/query-store";

describe("sql-query-store", () => {
  beforeEach(() => {
    useSqlQueryStore.getState().reset();
  });

  describe("initial state", () => {
    test("has correct default values", () => {
      const state = useSqlQueryStore.getState();
      expect(state.query).toBe("");
      expect(state.selectedTabId).toBeNull();
      expect(state.queryHistory).toEqual([]);
      expect(state.maxHistorySize).toBe(100);
    });
  });

  describe("setQuery", () => {
    test("updates query string", () => {
      const { setQuery } = useSqlQueryStore.getState();
      setQuery("SELECT * FROM users");
      expect(useSqlQueryStore.getState().query).toBe("SELECT * FROM users");
    });

    test("handles empty query", () => {
      const { setQuery } = useSqlQueryStore.getState();
      setQuery("SELECT 1");
      setQuery("");
      expect(useSqlQueryStore.getState().query).toBe("");
    });
  });

  describe("setSelectedTab", () => {
    test("updates selectedTabId", () => {
      const { setSelectedTab } = useSqlQueryStore.getState();
      setSelectedTab("tab-123");
      expect(useSqlQueryStore.getState().selectedTabId).toBe("tab-123");
    });

    test("can set to null", () => {
      const { setSelectedTab } = useSqlQueryStore.getState();
      setSelectedTab("tab-123");
      setSelectedTab(null);
      expect(useSqlQueryStore.getState().selectedTabId).toBeNull();
    });
  });

  describe("addToHistory", () => {
    test("adds entry to history", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      const history = useSqlQueryStore.getState().queryHistory;
      expect(history).toHaveLength(1);
      expect(history[0].sql).toBe("SELECT 1");
      expect(history[0].id).toBeDefined();
      expect(history[0].timestamp).toBeDefined();
    });

    test("prepends new entries", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      const history = useSqlQueryStore.getState().queryHistory;
      expect(history).toHaveLength(2);
      expect(history[0].sql).toBe("SELECT 2");
      expect(history[1].sql).toBe("SELECT 1");
    });

    test("respects maxHistorySize", () => {
      const store = useSqlQueryStore.getState();
      store.reset();
      useSqlQueryStore.setState({ maxHistorySize: 3 });
      
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      addToHistory({ sql: "SELECT 3" });
      addToHistory({ sql: "SELECT 4" });
      
      const history = useSqlQueryStore.getState().queryHistory;
      expect(history).toHaveLength(3);
      expect(history[0].sql).toBe("SELECT 4");
      expect(history[1].sql).toBe("SELECT 3");
      expect(history[2].sql).toBe("SELECT 2");
    });

    test("preserves optional fields", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({
        sql: "SELECT * FROM users",
        duration: 150,
        rowsReturned: 100,
        rowsRead: 1000,
        bytesRead: 50000,
        memoryUsage: 1024,
        user: "admin",
      });
      
      const entry = useSqlQueryStore.getState().queryHistory[0];
      expect(entry.duration).toBe(150);
      expect(entry.rowsReturned).toBe(100);
      expect(entry.rowsRead).toBe(1000);
      expect(entry.bytesRead).toBe(50000);
      expect(entry.memoryUsage).toBe(1024);
      expect(entry.user).toBe("admin");
    });

    test("preserves error field", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({
        sql: "INVALID SQL",
        error: "Syntax error",
      });
      
      const entry = useSqlQueryStore.getState().queryHistory[0];
      expect(entry.error).toBe("Syntax error");
    });
  });

  describe("clearHistory", () => {
    test("clears all history entries", () => {
      const { addToHistory, clearHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      expect(useSqlQueryStore.getState().queryHistory).toHaveLength(2);
      
      clearHistory();
      expect(useSqlQueryStore.getState().queryHistory).toHaveLength(0);
    });
  });

  describe("executeQuery", () => {
    test("adds query to history", () => {
      const { executeQuery } = useSqlQueryStore.getState();
      executeQuery("SELECT * FROM users");
      
      const history = useSqlQueryStore.getState().queryHistory;
      expect(history).toHaveLength(1);
      expect(history[0].sql).toBe("SELECT * FROM users");
    });

    test("includes execution options", () => {
      const { executeQuery } = useSqlQueryStore.getState();
      executeQuery("SELECT * FROM users", {
        duration: 200,
        rowsReturned: 50,
        rowsRead: 500,
        bytesRead: 25000,
        memoryUsage: 2048,
        user: "analyst",
      });
      
      const entry = useSqlQueryStore.getState().queryHistory[0];
      expect(entry.duration).toBe(200);
      expect(entry.rowsReturned).toBe(50);
      expect(entry.rowsRead).toBe(500);
      expect(entry.bytesRead).toBe(25000);
      expect(entry.memoryUsage).toBe(2048);
      expect(entry.user).toBe("analyst");
    });
  });

  describe("reset", () => {
    test("resets all state to initial values", () => {
      const { setQuery, setSelectedTab, addToHistory, reset } = useSqlQueryStore.getState();
      setQuery("SELECT * FROM users");
      setSelectedTab("tab-123");
      addToHistory({ sql: "SELECT 1" });
      
      reset();
      
      const state = useSqlQueryStore.getState();
      expect(state.query).toBe("");
      expect(state.selectedTabId).toBeNull();
      expect(state.queryHistory).toHaveLength(0);
    });
  });

  describe("sqlQuerySelectors", () => {
    test("currentQuery returns query string", () => {
      const { setQuery } = useSqlQueryStore.getState();
      setQuery("SELECT * FROM users");
      expect(sqlQuerySelectors.currentQuery(useSqlQueryStore.getState())).toBe(
        "SELECT * FROM users"
      );
    });

    test("selectedTab returns selectedTabId", () => {
      const { setSelectedTab } = useSqlQueryStore.getState();
      setSelectedTab("tab-456");
      expect(sqlQuerySelectors.selectedTab(useSqlQueryStore.getState())).toBe(
        "tab-456"
      );
    });

    test("history returns queryHistory", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      const history = sqlQuerySelectors.history(useSqlQueryStore.getState());
      expect(history).toHaveLength(2);
    });

    test("lastQuery returns most recent entry", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      const last = sqlQuerySelectors.lastQuery(useSqlQueryStore.getState());
      expect(last?.sql).toBe("SELECT 2");
    });

    test("lastQuery returns null when no history", () => {
      const last = sqlQuerySelectors.lastQuery(useSqlQueryStore.getState());
      expect(last).toBeNull();
    });

    test("errorHistory returns only entries with errors", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "INVALID", error: "Syntax error" });
      addToHistory({ sql: "SELECT 2" });
      addToHistory({ sql: "BAD", error: "Another error" });
      
      const errors = sqlQuerySelectors.errorHistory(useSqlQueryStore.getState());
      expect(errors).toHaveLength(2);
      expect(errors[0].error).toBe("Another error");
      expect(errors[1].error).toBe("Syntax error");
    });

    test("historyByUser returns entries for specific user", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1", user: "admin" });
      addToHistory({ sql: "SELECT 2", user: "analyst" });
      addToHistory({ sql: "SELECT 3", user: "admin" });
      
      const adminHistory = sqlQuerySelectors.historyByUser("admin")(
        useSqlQueryStore.getState()
      );
      expect(adminHistory).toHaveLength(2);
      expect(adminHistory[0].user).toBe("admin");
      expect(adminHistory[1].user).toBe("admin");
    });

    test("totalQueries returns count of history entries", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      addToHistory({ sql: "SELECT 3" });
      
      expect(sqlQuerySelectors.totalQueries(useSqlQueryStore.getState())).toBe(3);
    });

    test("averageDuration calculates correctly", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1", duration: 100 });
      addToHistory({ sql: "SELECT 2", duration: 200 });
      addToHistory({ sql: "SELECT 3", duration: 300 });
      
      expect(sqlQuerySelectors.averageDuration(useSqlQueryStore.getState())).toBe(200);
    });

    test("averageDuration returns 0 when no durations", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1" });
      addToHistory({ sql: "SELECT 2" });
      
      expect(sqlQuerySelectors.averageDuration(useSqlQueryStore.getState())).toBe(0);
    });

    test("averageDuration ignores entries without duration", () => {
      const { addToHistory } = useSqlQueryStore.getState();
      addToHistory({ sql: "SELECT 1", duration: 100 });
      addToHistory({ sql: "SELECT 2" });
      addToHistory({ sql: "SELECT 3", duration: 300 });
      
      expect(sqlQuerySelectors.averageDuration(useSqlQueryStore.getState())).toBe(200);
    });
  });
});
