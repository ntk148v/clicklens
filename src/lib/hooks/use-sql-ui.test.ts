import { describe, it, expect } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useSqlUI, type UseSqlUIReturn } from "./use-sql-ui";

describe("useSqlUI", () => {
  it("should initialize with all UI states closed (false)", () => {
    const { result } = renderHook(() => useSqlUI());

    expect(result.current.historyOpen).toBe(false);
    expect(result.current.savedQueriesOpen).toBe(false);
    expect(result.current.saveDialogOpen).toBe(false);
  });

  it("should open and close history panel", () => {
    const { result } = renderHook(() => useSqlUI());

    act(() => {
      result.current.setHistoryOpen(true);
    });
    expect(result.current.historyOpen).toBe(true);

    act(() => {
      result.current.setHistoryOpen(false);
    });
    expect(result.current.historyOpen).toBe(false);
  });

  it("should open and close saved queries dialog", () => {
    const { result } = renderHook(() => useSqlUI());

    act(() => {
      result.current.setSavedQueriesOpen(true);
    });
    expect(result.current.savedQueriesOpen).toBe(true);

    act(() => {
      result.current.setSavedQueriesOpen(false);
    });
    expect(result.current.savedQueriesOpen).toBe(false);
  });

  it("should open and close save dialog", () => {
    const { result } = renderHook(() => useSqlUI());

    act(() => {
      result.current.setSaveDialogOpen(true);
    });
    expect(result.current.saveDialogOpen).toBe(true);

    act(() => {
      result.current.setSaveDialogOpen(false);
    });
    expect(result.current.saveDialogOpen).toBe(false);
  });

  it("should return correct type structure", () => {
    const { result } = renderHook(() => useSqlUI());

    const returnValue: UseSqlUIReturn = result.current;

    expect(typeof returnValue.historyOpen).toBe("boolean");
    expect(typeof returnValue.savedQueriesOpen).toBe("boolean");
    expect(typeof returnValue.saveDialogOpen).toBe("boolean");
    expect(typeof returnValue.setHistoryOpen).toBe("function");
    expect(typeof returnValue.setSavedQueriesOpen).toBe("function");
    expect(typeof returnValue.setSaveDialogOpen).toBe("function");
  });

  it("should manage multiple UI states independently", () => {
    const { result } = renderHook(() => useSqlUI());

    act(() => {
      result.current.setHistoryOpen(true);
    });

    act(() => {
      result.current.setSavedQueriesOpen(true);
    });

    act(() => {
      result.current.setSaveDialogOpen(true);
    });

    expect(result.current.historyOpen).toBe(true);
    expect(result.current.savedQueriesOpen).toBe(true);
    expect(result.current.saveDialogOpen).toBe(true);

    act(() => {
      result.current.setHistoryOpen(false);
    });

    expect(result.current.historyOpen).toBe(false);
    expect(result.current.savedQueriesOpen).toBe(true);
    expect(result.current.saveDialogOpen).toBe(true);
  });
});