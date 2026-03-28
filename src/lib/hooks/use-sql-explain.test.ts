import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useSqlExplain } from "./use-sql-explain";
import type { QueryTab } from "@/lib/store/tabs";

// Mock dependencies
const mockUpdateTab = mock();
const mockGetActiveQueryTab = mock();
const mockToast = mock();

mock.module("@/components/ui/use-toast", () => ({
  toast: mockToast,
}));



describe("useSqlExplain", () => {
  const mockTab: QueryTab = {
    id: "tab-1",
    type: "query",
    name: "Query 1",
    sql: "SELECT * FROM users",
    result: null,
    isRunning: false,
    error: null,
  };

  const options = {
    csrfToken: "test-token",
    selectedDatabase: "test_db",
    updateTab: mockUpdateTab,
    getActiveQueryTab: mockGetActiveQueryTab,
  };

  beforeEach(() => {
    mockUpdateTab.mockReset();
    mockGetActiveQueryTab.mockReset();
    mockToast.mockReset();
    mockGetActiveQueryTab.mockReturnValue(mockTab);
  });

  it("should execute EXPLAIN PLAN query", async () => {
    let readCount = 0;
    global.fetch = mock(async () => {
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode(
                    '{"type":"data","data":[{"explain":"Query plan"}]}\n',
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      } as Response;
    });

    const { result } = renderHook(() => useSqlExplain(options));

    expect(result.current.isExplaining).toBe(false);

    await result.current.explain("PLAN");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: true,
      error: null,
      result: null,
      explainResult: null,
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      explainResult: {
        type: "PLAN",
        data: "Query plan\n",
      },
    });
  });

  it("should execute EXPLAIN AST query", async () => {
    let readCount = 0;
    global.fetch = mock(async () => {
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode(
                    '{"type":"data","data":[{"ast":"AST tree"}]}\n',
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      } as Response;
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("AST");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      explainResult: {
        type: "AST",
        data: "AST tree\n",
      },
    });
  });

  it("should execute EXPLAIN SYNTAX query", async () => {
    let readCount = 0;
    global.fetch = mock(async () => {
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode(
                    '{"type":"data","data":[{"syntax":"Syntax info"}]}\n',
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      } as Response;
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("SYNTAX");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      explainResult: {
        type: "SYNTAX",
        data: "Syntax info\n",
      },
    });
  });

  it("should execute EXPLAIN PIPELINE query", async () => {
    let readCount = 0;
    global.fetch = mock(async () => {
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode(
                    '{"type":"data","data":[{"pipeline":"Pipeline info"}]}\n',
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      } as Response;
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PIPELINE");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      explainResult: {
        type: "PIPELINE",
        data: "Pipeline info\n",
      },
    });
  });

  it("should handle error responses", async () => {
    global.fetch = mock(async () => {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          error: {
            code: 500,
            message: "Query failed",
            type: "QUERY_ERROR",
            userMessage: "Failed to explain query",
          },
        }),
      } as Response;
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PLAN");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      error: {
        code: 500,
        message: "Query failed",
        type: "EXPLAIN_ERROR",
        userMessage: "Failed to explain query",
      },
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Failed to explain query",
      description: "Query failed",
    });
  });

  it("should handle no active tab", async () => {
    mockGetActiveQueryTab.mockReturnValue(undefined);

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PLAN");

    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(result.current.isExplaining).toBe(false);
  });

  it("should handle empty SQL", async () => {
    mockGetActiveQueryTab.mockReturnValue({
      ...mockTab,
      sql: "   ",
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PLAN");

    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(result.current.isExplaining).toBe(false);
  });

  it("should handle tab already running", async () => {
    mockGetActiveQueryTab.mockReturnValue({
      ...mockTab,
      isRunning: true,
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PLAN");

    expect(mockUpdateTab).not.toHaveBeenCalled();
    expect(result.current.isExplaining).toBe(false);
  });

  it("should strip existing EXPLAIN prefix from SQL", async () => {
    global.fetch = mock(async (url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.sql).toBe("EXPLAIN PLAN SELECT * FROM users");

      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              return {
                done: true,
                value: new TextEncoder().encode(
                  '{"type":"data","data":[{"explain":"Query plan"}]}\n',
                ),
              };
            },
          }),
        },
      } as Response;
    });

    mockGetActiveQueryTab.mockReturnValue({
      ...mockTab,
      sql: "EXPLAIN AST SELECT * FROM users",
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PLAN");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });
  });

  it("should handle NDJSON error events", async () => {
    let readCount = 0;
    global.fetch = mock(async () => {
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode(
                    '{"type":"error","error":{"message":"Parse error"}}\n',
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      } as Response;
    });

    const { result } = renderHook(() => useSqlExplain(options));

    await result.current.explain("PLAN");

    await waitFor(() => {
      expect(result.current.isExplaining).toBe(false);
    });

    expect(mockUpdateTab).toHaveBeenCalledWith("tab-1", {
      isRunning: false,
      error: expect.objectContaining({
        type: "EXPLAIN_ERROR",
        userMessage: "Failed to explain query",
      }),
    });
  });
});