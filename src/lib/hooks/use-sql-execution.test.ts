import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useSqlExecution } from "./use-sql-execution";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import type { QueryTab } from "@/lib/store/tabs";

describe("useSqlExecution", () => {
  const mockUpdateTab = mock(() => {});
  const mockGetActiveQueryTab = mock(() => undefined);
  const mockAddToHistory = mock(() => {});
  const mockToast = mock(() => {});

  const mockTab: QueryTab = {
    id: "tab-1",
    type: "query",
    name: "Query 1",
    sql: "SELECT 1",
    result: null,
    isRunning: false,
    error: null,
  };

  const mockUser = {
    host: "localhost",
    username: "testuser",
    database: "testdb",
  };

  const cancellationManager = new QueryCancellationManager();

  beforeEach(() => {
    mockUpdateTab.mockClear();
    mockGetActiveQueryTab.mockClear();
    mockAddToHistory.mockClear();
    mockToast.mockClear();
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      } as Response),
    );
  });

  it("should initialize with isExecuting false", () => {
    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    expect(result.current.isExecuting).toBe(false);
  });

  it("should not execute if no active tab", async () => {
    mockGetActiveQueryTab.mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1");
    });

    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(result.current.isExecuting).toBe(false);
  });

  it("should not execute if tab is already running", async () => {
    const runningTab = { ...mockTab, isRunning: true };
    mockGetActiveQueryTab.mockReturnValue(runningTab);

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1");
    });

    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(result.current.isExecuting).toBe(false);
  });

  it("should not execute if SQL is empty", async () => {
    mockGetActiveQueryTab.mockReturnValue(mockTab);

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: mockUpdateTab,
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("   ");
    });

    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(result.current.isExecuting).toBe(false);
  });

  it("should execute single SELECT query successfully", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    const mockReader = {
      read: mock()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({ type: "meta", data: [{ name: "col1", type: "String" }] }) +
              "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({ type: "data", data: [{ col1: "value1" }], rows_count: 1 }) +
              "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              type: "done",
              limit_reached: false,
              statistics: { elapsed: 100, rows_read: 1, bytes_read: 10 },
            }) + "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: true,
          value: new Uint8Array(),
        }),
    };

    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as Response),
    );

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1");
    });

    expect(mockUpdateTab).toHaveBeenCalled();

    const lastUpdateCall = mockUpdateTab.mock.calls[mockUpdateTab.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toBe("tab-1");
    expect(lastUpdateCall[1].isRunning).toBe(false);
    expect(lastUpdateCall[1].result).not.toBeNull();
    expect(lastUpdateCall[1].error).toBeNull();

    expect(mockAddToHistory).toHaveBeenCalledWith({
      sql: "SELECT 1",
      duration: 100,
      rowsReturned: 1,
      rowsRead: 1,
      bytesRead: 10,
      memoryUsage: undefined,
      user: "testuser",
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it("should handle multiple statements", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      const mockReader = {
        read: mock()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              JSON.stringify({ type: "meta", data: [{ name: "col1", type: "String" }] }) +
                "\n",
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              JSON.stringify({ type: "data", data: [{ col1: `value${callCount}` }], rows_count: 1 }) +
                "\n",
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              JSON.stringify({
                type: "done",
                limit_reached: false,
                statistics: { elapsed: 50, rows_read: 1, bytes_read: 10 },
              }) + "\n",
            ),
          })
          .mockResolvedValueOnce({
            done: true,
            value: new Uint8Array(),
          }),
      };
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as Response);
    });

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1; SELECT 2;");
    });

    const lastHistoryCall = mockAddToHistory.mock.calls[mockAddToHistory.mock.calls.length - 1];
    expect(lastHistoryCall[0]).toMatchObject({
      sql: "SELECT 1; SELECT 2;",
      duration: 100,
      rowsReturned: 1,
      rowsRead: 1,
      bytesRead: 10,
      memoryUsage: undefined,
      user: "testuser",
    });
  });

  it("should handle error responses", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    const errorResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: mock(() =>
        Promise.resolve({
          error: {
            code: 500,
            message: "Query failed",
            type: "QUERY_ERROR",
            userMessage: "Query execution failed",
          },
        }),
      ),
    };

    global.fetch = mock(() => Promise.resolve(errorResponse as Response));

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT invalid");
    });

    const lastUpdateCall = mockUpdateTab.mock.calls[mockUpdateTab.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toBe("tab-1");
    expect(lastUpdateCall[1].isRunning).toBe(false);
    expect(lastUpdateCall[1].result).toBeNull();
    expect(lastUpdateCall[1].error).toMatchObject({
      code: 500,
      message: "Query failed",
      type: "QUERY_ERROR",
      userMessage: "Query execution failed",
    });

    expect(mockAddToHistory).toHaveBeenCalledWith({
      sql: "SELECT invalid",
      error: "Query execution failed",
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it("should handle network errors", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    global.fetch = mock(() => Promise.reject(new TypeError("Failed to fetch")));

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1");
    });

    const lastUpdateCall = mockUpdateTab.mock.calls[mockUpdateTab.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toBe("tab-1");
    expect(lastUpdateCall[1].isRunning).toBe(false);
    expect(lastUpdateCall[1].result).toBeNull();
    expect(lastUpdateCall[1].error).toMatchObject({
      code: 0,
      message: "Failed to fetch",
      type: "NETWORK_ERROR",
      category: "NETWORK",
      userMessage: "Network error",
      hint: "Unable to connect to the server. Please check your connection.",
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it("should handle query cancellation", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    global.fetch = mock(() => Promise.reject(abortError));

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1");
    });

    const lastUpdateCall = mockUpdateTab.mock.calls[mockUpdateTab.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toBe("tab-1");
    expect(lastUpdateCall[1].isRunning).toBe(false);
    expect(lastUpdateCall[1].result).toBeNull();
    expect(lastUpdateCall[1].error).toMatchObject({
      code: 0,
      type: "ABORTED",
      category: "NETWORK",
      userMessage: "Request was aborted",
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it("should handle non-SELECT statements", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    const mockReader = {
      read: mock()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              type: "done",
              limit_reached: false,
              statistics: { elapsed: 50, rows_read: 0, bytes_read: 0 },
            }) + "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: true,
          value: new Uint8Array(),
        }),
    };

    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as Response),
    );

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("CREATE TABLE test (id Int32)");
    });

    const lastUpdateCall = mockUpdateTab.mock.calls[mockUpdateTab.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toBe("tab-1");
    expect(lastUpdateCall[1].isRunning).toBe(false);
    expect(lastUpdateCall[1].result).toMatchObject({
      data: [{ message: "1 statement(s) executed successfully" }],
      meta: [{ name: "message", type: "String" }],
      rows: 1,
      statistics: {
        elapsed: 50,
        rows_read: 0,
        bytes_read: 0,
      },
    });
    expect(lastUpdateCall[1].error).toBeNull();

    expect(mockAddToHistory).toHaveBeenCalledWith({
      sql: "CREATE TABLE test (id Int32)",
      duration: 50,
      rowsReturned: 0,
      rowsRead: 0,
      bytesRead: 0,
      user: "testuser",
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it("should handle streaming error events", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    const mockReader = {
      read: mock()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              type: "error",
              error: {
                code: 1,
                message: "Syntax error",
                type: "SYNTAX_ERROR",
                userMessage: "Invalid SQL syntax",
              },
            }) + "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: true,
          value: new Uint8Array(),
        }),
    };

    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as Response),
    );

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT invalid");
    });

    const lastUpdateCall = mockUpdateTab.mock.calls[mockUpdateTab.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toBe("tab-1");
    expect(lastUpdateCall[1].isRunning).toBe(false);
    expect(lastUpdateCall[1].result).toBeNull();
    expect(lastUpdateCall[1].error).toMatchObject({
      code: 1,
      message: "Syntax error",
      type: "SYNTAX_ERROR",
      userMessage: "Invalid SQL syntax",
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it("should handle progress events", async () => {
    let currentTab = { ...mockTab, isRunning: false };
    mockGetActiveQueryTab.mockImplementation(() => currentTab);

    const mockReader = {
      read: mock()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({ type: "meta", data: [{ name: "col1", type: "String" }] }) +
              "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({ type: "progress", rows_read: 100 }) + "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({ type: "data", data: [{ col1: "value1" }], rows_count: 1 }) +
              "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              type: "done",
              limit_reached: false,
              statistics: { elapsed: 100, rows_read: 100, bytes_read: 10 },
            }) + "\n",
          ),
        })
        .mockResolvedValueOnce({
          done: true,
          value: new Uint8Array(),
        }),
    };

    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as Response),
    );

    const { result } = renderHook(() =>
      useSqlExecution({
        cancellationManager,
        csrfToken: "test-token",
        selectedDatabase: "testdb",
        user: mockUser,
        updateTab: (id, updates) => {
          mockUpdateTab(id, updates);
          if (id === "tab-1" && updates.isRunning !== undefined) {
            currentTab = { ...currentTab, ...updates };
          }
        },
        getActiveQueryTab: mockGetActiveQueryTab,
        addToHistory: mockAddToHistory,
      }),
    );

    await act(async () => {
      await result.current.execute("SELECT 1");
    });

    const progressCalls = mockUpdateTab.mock.calls.filter(call =>
      call[1].result?.statistics?.rows_read === 100
    );
    expect(progressCalls.length).toBeGreaterThan(0);
    const progressCall = progressCalls[0];
    expect(progressCall[0]).toBe("tab-1");
    expect(progressCall[1].result).toMatchObject({
      meta: [{ name: "col1", type: "String" }],
      statistics: {
        rows_read: 100,
      },
    });

    expect(result.current.isExecuting).toBe(false);
  });
});