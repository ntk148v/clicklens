import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSqlCursor } from "./use-sql-cursor";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import type { QueryTab, QueryHistoryEntry } from "@/lib/store/tabs";

// Mock dependencies
mock.module("@/components/ui/use-toast", () => ({
  toast: mock(),
}));

mock.module("@/lib/utils", () => ({
  generateUUID: mock(() => "test-query-id"),
}));



describe("useSqlCursor", () => {
  let cancellationManager: QueryCancellationManager;
  let mockUpdateTab: ReturnType<typeof mock<(id: string, updates: Partial<QueryTab>) => void>>;
  let mockGetActiveQueryTab: ReturnType<typeof mock<() => QueryTab | undefined>>;
  let mockAddToHistory: ReturnType<typeof mock<(entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void>>;
  let currentTab: QueryTab | undefined;

  beforeEach(() => {
    cancellationManager = new QueryCancellationManager();
    currentTab = undefined;
    mockUpdateTab = mock((id: string, updates: Partial<QueryTab>) => {
      if (currentTab && currentTab.id === id) {
        currentTab = { ...currentTab, ...updates };
      }
    });
    mockGetActiveQueryTab = mock(() => currentTab);
    mockAddToHistory = mock();
  });

  it("tracks cursor position changes", () => {
    const { result } = renderHook(() =>
      useSqlCursor({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "test-db",
        user: { host: "localhost", username: "test", database: "test" },
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    expect(result.current.cursorPosition).toBe(0);

    act(() => {
      result.current.handleCursorChange(100);
    });

    expect(result.current.cursorPosition).toBe(100);

    act(() => {
      result.current.handleCursorChange(250);
    });

    expect(result.current.cursorPosition).toBe(250);
  });

  it("executes statement at cursor position", async () => {
    currentTab = {
      id: "tab-1",
      type: "query",
      name: "Test Tab",
      sql: "SELECT 1;\nSELECT 2;",
      result: null,
      isRunning: false,
      error: null,
    };

    let readCount = 0;
    global.fetch = mock(async () => {
      const encoder = new TextEncoder();
      const ndjson =
        '{"type":"meta","data":[{"name":"col1","type":"UInt32"}]}\n' +
        '{"type":"data","data":[{"col1":1}],"rows_count":1}\n' +
        '{"type":"done","statistics":{"elapsed":0.1,"rows_read":1,"bytes_read":8}}\n';
      return {
        ok: true,
        body: {
          getReader: mock(() => ({
            read: mock(async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              readCount++;
              if (readCount === 1) {
                return { done: false, value: encoder.encode(ndjson) };
              }
              return { done: true, value: undefined };
            }),
          })),
        },
      } as Response;
    });

    const { result } = renderHook(() =>
      useSqlCursor({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "test-db",
        user: { host: "localhost", username: "test", database: "test" },
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    // Set cursor position to first statement
    act(() => {
      result.current.handleCursorChange(5);
    });

    await act(async () => {
      await result.current.executeAtCursor();
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: true,
      error: null,
      queryId: "test-query-id",
    });

    await waitFor(
      () => {
        expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
          isRunning: false,
          result: expect.objectContaining({
            data: [{ col1: 1 }],
            meta: [{ name: "col1", type: "UInt32" }],
            rows: 1,
          }),
          error: null,
          queryId: undefined,
        });
      },
      { timeout: 3000 },
    );

    expect(mockAddToHistory).toHaveBeenCalledWith({
      sql: "SELECT 1",
      duration: 0.1,
      rowsReturned: 1,
      rowsRead: 1,
      bytesRead: 8,
      memoryUsage: 0,
      user: "test",
    });
  });

  it("handles no statement at position", async () => {
    currentTab = {
      id: "tab-1",
      type: "query",
      name: "Test Tab",
      sql: "",
      result: null,
      isRunning: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSqlCursor({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "test-db",
        user: { host: "localhost", username: "test", database: "test" },
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    // Set cursor position to a location with no statement
    act(() => {
      result.current.handleCursorChange(999);
    });

    await act(async () => {
      await result.current.executeAtCursor();
    });

    // Should not call updateTab or addToHistory when no statement found
    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(mockAddToHistory).not.toHaveBeenCalled();
  });

  it("handles execution cancellation", async () => {
    currentTab = {
      id: "tab-1",
      type: "query",
      name: "Test Tab",
      sql: "SELECT 1;",
      result: null,
      isRunning: false,
      error: null,
    };

    const abortController = new AbortController();
    cancellationManager.createController = mock(() => abortController);

    global.fetch = mock(async () => {
      abortController.abort();
      throw new Error("aborted");
    });

    const { result } = renderHook(() =>
      useSqlCursor({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "test-db",
        user: { host: "localhost", username: "test", database: "test" },
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.executeAtCursor();
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      result: null,
      error: expect.objectContaining({
        type: "ABORTED",
        userMessage: "Request was aborted",
      }),
      queryId: undefined,
    });
  });

  it("does not execute when tab is already running", async () => {
    currentTab = {
      id: "tab-1",
      type: "query",
      name: "Test Tab",
      sql: "SELECT 1;",
      result: null,
      isRunning: true,
      error: null,
    };

    const { result } = renderHook(() =>
      useSqlCursor({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "test-db",
        user: { host: "localhost", username: "test", database: "test" },
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.executeAtCursor();
    });

    // Should not call updateTab or addToHistory when tab is already running
    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(mockAddToHistory).not.toHaveBeenCalled();
  });

  it("does not execute when no active tab", async () => {
    mockGetActiveQueryTab.mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useSqlCursor({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "test-db",
        user: { host: "localhost", username: "test", database: "test" },
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.executeAtCursor();
    });

    // Should not call updateTab or addToHistory when no active tab
    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(mockAddToHistory).not.toHaveBeenCalled();
  });
});