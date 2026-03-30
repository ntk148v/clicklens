import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useSqlPagination } from "./use-sql-pagination";

describe("useSqlPagination", () => {
  const mockOnPageChange = mock(() => Promise.resolve());

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it("should initialize with empty pagination state", () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    expect(result.current.pagination).toEqual({});
  });

  it("should handle page change and call onPageChange with correct params", async () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    await act(async () => {
      result.current.handlePageChange(2);
    });

    expect(mockOnPageChange).toHaveBeenCalledWith(1, 100);
    expect(result.current.pagination["tab-1"]).toEqual({ page: 1, pageSize: 100 });
  });

  it("should handle page change with custom pageSize from pagination state", async () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    await act(async () => {
      result.current.handlePageSizeChange(50);
    });

    await act(async () => {
      result.current.handlePageChange(3);
    });

    expect(mockOnPageChange).toHaveBeenCalledWith(2, 50);
    expect(result.current.pagination["tab-1"]).toEqual({ page: 2, pageSize: 50 });
  });

  it("should handle page size change and reset to page 0", async () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    await act(async () => {
      result.current.handlePageSizeChange(50);
    });

    expect(mockOnPageChange).toHaveBeenCalledWith(0, 50);
    expect(result.current.pagination["tab-1"]).toEqual({ page: 0, pageSize: 50 });
  });

  it("should get current pagination for active tab", async () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    await act(async () => {
      result.current.handlePageChange(3);
    });

    const current = result.current.getCurrentPagination();
    expect(current).toEqual({ page: 2, pageSize: 100 });
  });

  it("should return default pagination when active tab has no pagination state", () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    const current = result.current.getCurrentPagination();
    expect(current).toEqual({ page: 0, pageSize: 100 });
  });

  it("should return default pagination when activeTabId is null", () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: null,
        onPageChange: mockOnPageChange,
      }),
    );

    const current = result.current.getCurrentPagination();
    expect(current).toEqual({ page: 0, pageSize: 100 });
  });

  it("should handle page change with null activeTabId using default pageSize", async () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: null,
        onPageChange: mockOnPageChange,
      }),
    );

    await act(async () => {
      result.current.handlePageChange(5);
    });

    expect(mockOnPageChange).toHaveBeenCalledWith(4, 100);
    expect(result.current.pagination[""]).toEqual({ page: 4, pageSize: 100 });
  });

  it("should track pagination state per tab", async () => {
    const { result, rerender } = renderHook(
      ({ activeTabId }) =>
        useSqlPagination({
          activeTabId,
          onPageChange: mockOnPageChange,
        }),
      { initialProps: { activeTabId: "tab-1" } },
    );

    await act(async () => {
      result.current.handlePageChange(2);
    });

    expect(result.current.pagination["tab-1"]).toEqual({ page: 1, pageSize: 100 });

    rerender({ activeTabId: "tab-2" });

    await act(async () => {
      result.current.handlePageSizeChange(50);
    });

    await act(async () => {
      result.current.handlePageChange(3);
    });

    expect(result.current.pagination).toEqual({
      "tab-1": { page: 1, pageSize: 100 },
      "tab-2": { page: 2, pageSize: 50 },
    });
  });

  it("should update pagination state when changing page size", async () => {
    const { result } = renderHook(() =>
      useSqlPagination({
        activeTabId: "tab-1",
        onPageChange: mockOnPageChange,
      }),
    );

    await act(async () => {
      result.current.handlePageChange(5);
    });

    expect(result.current.pagination["tab-1"]).toEqual({ page: 4, pageSize: 100 });

    await act(async () => {
      result.current.handlePageSizeChange(25);
    });

    expect(result.current.pagination["tab-1"]).toEqual({ page: 0, pageSize: 25 });
  });
});