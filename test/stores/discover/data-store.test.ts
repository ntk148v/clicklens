import { describe, expect, test, beforeEach } from "bun:test";
import { createDiscoverDataStore } from "../../../src/stores/discover/data-store";

describe("Discover Data Store", () => {
  let store: ReturnType<typeof createDiscoverDataStore>;

  beforeEach(() => {
    store = createDiscoverDataStore();
  });

  describe("initial state", () => {
    test("has empty rows", () => {
      expect(store.getState().rows).toEqual([]);
    });

    test("has empty columns", () => {
      expect(store.getState().columns).toEqual([]);
    });

    test("has zero total count", () => {
      expect(store.getState().totalCount).toBe(0);
    });

    test("has empty histogram data", () => {
      expect(store.getState().histogramData).toEqual([]);
    });

    test("has loading state false", () => {
      expect(store.getState().loading).toEqual({
        data: false,
        histogram: false,
      });
    });

    test("has no error", () => {
      expect(store.getState().error).toBeNull();
    });
  });

  describe("setRows", () => {
    test("sets rows and clears error", () => {
      const rows = [
        { id: 1, name: "test" },
        { id: 2, name: "test2" },
      ];
      store.getState().setRows(rows);
      expect(store.getState().rows).toEqual(rows);
      expect(store.getState().error).toBeNull();
    });

    test("replaces existing rows", () => {
      store.getState().setRows([{ id: 1 }]);
      store.getState().setRows([{ id: 2 }]);
      expect(store.getState().rows).toEqual([{ id: 2 }]);
    });
  });

  describe("appendRows", () => {
    test("appends rows to existing rows", () => {
      store.getState().setRows([{ id: 1 }]);
      store.getState().appendRows([{ id: 2 }, { id: 3 }]);
      expect(store.getState().rows).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
    });

    test("appends to empty rows", () => {
      store.getState().appendRows([{ id: 1 }]);
      expect(store.getState().rows).toEqual([{ id: 1 }]);
    });
  });

  describe("setColumns", () => {
    test("sets columns", () => {
      const columns = ["id", "name", "timestamp"];
      store.getState().setColumns(columns);
      expect(store.getState().columns).toEqual(columns);
    });

    test("replaces existing columns", () => {
      store.getState().setColumns(["id"]);
      store.getState().setColumns(["name"]);
      expect(store.getState().columns).toEqual(["name"]);
    });
  });

  describe("setTotalCount", () => {
    test("sets total count", () => {
      store.getState().setTotalCount(100);
      expect(store.getState().totalCount).toBe(100);
    });

    test("updates total count", () => {
      store.getState().setTotalCount(100);
      store.getState().setTotalCount(200);
      expect(store.getState().totalCount).toBe(200);
    });
  });

  describe("setHistogramData", () => {
    test("sets histogram data", () => {
      const data = [
        { time: "2024-01-01T00:00:00Z", count: 10 },
        { time: "2024-01-01T01:00:00Z", count: 20 },
      ];
      store.getState().setHistogramData(data);
      expect(store.getState().histogramData).toEqual(data);
    });

    test("replaces existing histogram data", () => {
      store.getState().setHistogramData([{ time: "2024-01-01T00:00:00Z", count: 10 }]);
      store.getState().setHistogramData([{ time: "2024-01-01T01:00:00Z", count: 20 }]);
      expect(store.getState().histogramData).toEqual([
        { time: "2024-01-01T01:00:00Z", count: 20 },
      ]);
    });
  });

  describe("setDataLoading", () => {
    test("sets data loading to true", () => {
      store.getState().setDataLoading(true);
      expect(store.getState().loading.data).toBe(true);
      expect(store.getState().loading.histogram).toBe(false);
    });

    test("sets data loading to false", () => {
      store.getState().setDataLoading(true);
      store.getState().setDataLoading(false);
      expect(store.getState().loading.data).toBe(false);
    });
  });

  describe("setHistogramLoading", () => {
    test("sets histogram loading to true", () => {
      store.getState().setHistogramLoading(true);
      expect(store.getState().loading.histogram).toBe(true);
      expect(store.getState().loading.data).toBe(false);
    });

    test("sets histogram loading to false", () => {
      store.getState().setHistogramLoading(true);
      store.getState().setHistogramLoading(false);
      expect(store.getState().loading.histogram).toBe(false);
    });
  });

  describe("setError", () => {
    test("sets error message", () => {
      store.getState().setError("Test error");
      expect(store.getState().error).toBe("Test error");
    });

    test("clears error with null", () => {
      store.getState().setError("Test error");
      store.getState().setError(null);
      expect(store.getState().error).toBeNull();
    });
  });

  describe("clearData", () => {
    test("resets all data state to initial values", () => {
      store.getState().setRows([{ id: 1 }]);
      store.getState().setColumns(["id"]);
      store.getState().setTotalCount(100);
      store.getState().setHistogramData([{ time: "2024-01-01T00:00:00Z", count: 10 }]);
      store.getState().setDataLoading(true);
      store.getState().setHistogramLoading(true);
      store.getState().setError("Test error");

      store.getState().clearData();

      const state = store.getState();
      expect(state.rows).toEqual([]);
      expect(state.columns).toEqual([]);
      expect(state.totalCount).toBe(0);
      expect(state.histogramData).toEqual([]);
      expect(state.loading).toEqual({ data: false, histogram: false });
      expect(state.error).toBeNull();
    });
  });

  describe("clearError", () => {
    test("clears error state", () => {
      store.getState().setError("Test error");
      store.getState().clearError();
      expect(store.getState().error).toBeNull();
    });

    test("does not affect other state", () => {
      store.getState().setRows([{ id: 1 }]);
      store.getState().setError("Test error");
      store.getState().clearError();
      expect(store.getState().rows).toEqual([{ id: 1 }]);
      expect(store.getState().error).toBeNull();
    });
  });

  describe("optimisticSetRows", () => {
    test("sets rows optimistically", () => {
      const newRows = [{ id: 2 }];
      store.getState().optimisticSetRows(newRows);
      expect(store.getState().rows).toEqual(newRows);
    });

    test("returns rollback function", () => {
      const originalRows = [{ id: 1 }];
      store.getState().setRows(originalRows);
      const rollback = store.getState().optimisticSetRows([{ id: 2 }]);
      expect(store.getState().rows).toEqual([{ id: 2 }]);
      rollback();
      expect(store.getState().rows).toEqual(originalRows);
    });

    test("clears error on optimistic update", () => {
      store.getState().setError("Test error");
      store.getState().optimisticSetRows([{ id: 1 }]);
      expect(store.getState().error).toBeNull();
    });
  });

  describe("optimisticSetTotalCount", () => {
    test("sets total count optimistically", () => {
      store.getState().optimisticSetTotalCount(100);
      expect(store.getState().totalCount).toBe(100);
    });

    test("returns rollback function", () => {
      store.getState().setTotalCount(50);
      const rollback = store.getState().optimisticSetTotalCount(100);
      expect(store.getState().totalCount).toBe(100);
      rollback();
      expect(store.getState().totalCount).toBe(50);
    });
  });

  describe("loading and error states", () => {
    test("loading states work independently", () => {
      store.getState().setDataLoading(true);
      store.getState().setHistogramLoading(true);
      expect(store.getState().loading).toEqual({
        data: true,
        histogram: true,
      });
    });

    test("setting rows clears error", () => {
      store.getState().setError("Test error");
      store.getState().setRows([{ id: 1 }]);
      expect(store.getState().error).toBeNull();
    });

    test("error can be set independently of loading", () => {
      store.getState().setDataLoading(true);
      store.getState().setError("Test error");
      expect(store.getState().loading.data).toBe(true);
      expect(store.getState().error).toBe("Test error");
    });
  });
});
