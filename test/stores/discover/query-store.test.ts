import { describe, expect, test, beforeEach } from "bun:test";
import { useQueryStore, querySelectors } from "../../../src/stores/discover/query-store";
import { getFlexibleRangeFromEnum } from "../../../src/lib/types/discover";

describe("query-store", () => {
  beforeEach(() => {
    useQueryStore.getState().resetQuery();
  });

  describe("initial state", () => {
    test("has correct default values", () => {
      const state = useQueryStore.getState();
      expect(state.customFilter).toBe("");
      expect(state.appliedFilter).toBe("");
      expect(state.flexibleRange).toEqual(getFlexibleRangeFromEnum("1h"));
      expect(state.sorting).toEqual([]);
      expect(state.groupBy).toEqual([]);
      expect(state.selectedColumns).toEqual([]);
      expect(state.selectedTimeColumn).toBe("");
      expect(state.isQueryDirty).toBe(false);
      expect(state.lastExecutedParams).toBeNull();
    });
  });

  describe("setQuery", () => {
    test("updates customFilter", () => {
      const { setQuery } = useQueryStore.getState();
      setQuery("status = 200");
      expect(useQueryStore.getState().customFilter).toBe("status = 200");
    });

    test("marks dirty when query differs from last executed", () => {
      const { setQuery, markClean } = useQueryStore.getState();
      markClean();
      setQuery("status = 200");
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });

    test("does not mark dirty when query matches last executed", () => {
      const { setQuery, setAppliedFilter, markClean } = useQueryStore.getState();
      setAppliedFilter("status = 200");
      markClean();
      setQuery("status = 200");
      expect(useQueryStore.getState().isQueryDirty).toBe(false);
    });
  });

  describe("setAppliedFilter", () => {
    test("updates appliedFilter", () => {
      const { setAppliedFilter } = useQueryStore.getState();
      setAppliedFilter("method = 'GET'");
      expect(useQueryStore.getState().appliedFilter).toBe("method = 'GET'");
    });
  });

  describe("setFilters", () => {
    test("updates both customFilter and appliedFilter", () => {
      const { setFilters } = useQueryStore.getState();
      setFilters("status = 404");
      const state = useQueryStore.getState();
      expect(state.customFilter).toBe("status = 404");
      expect(state.appliedFilter).toBe("status = 404");
    });

    test("marks dirty when filter differs from last executed", () => {
      const { setFilters, markClean } = useQueryStore.getState();
      markClean();
      setFilters("status = 404");
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("setTimeRange", () => {
    test("updates flexibleRange", () => {
      const { setTimeRange } = useQueryStore.getState();
      const newRange = getFlexibleRangeFromEnum("24h");
      setTimeRange(newRange);
      expect(useQueryStore.getState().flexibleRange).toEqual(newRange);
    });

    test("marks dirty when time range differs from last executed", () => {
      const { setTimeRange, markClean } = useQueryStore.getState();
      markClean();
      const newRange = getFlexibleRangeFromEnum("24h");
      setTimeRange(newRange);
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("setSort", () => {
    test("updates sorting", () => {
      const { setSort } = useQueryStore.getState();
      const sorting = [{ id: "timestamp", desc: true }];
      setSort(sorting);
      expect(useQueryStore.getState().sorting).toEqual(sorting);
    });

    test("marks dirty when sorting differs from last executed", () => {
      const { setSort, markClean } = useQueryStore.getState();
      markClean();
      setSort([{ id: "timestamp", desc: true }]);
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("setGroupBy", () => {
    test("updates groupBy", () => {
      const { setGroupBy } = useQueryStore.getState();
      setGroupBy(["status", "method"]);
      expect(useQueryStore.getState().groupBy).toEqual(["status", "method"]);
    });

    test("marks dirty when groupBy differs from last executed", () => {
      const { setGroupBy, markClean } = useQueryStore.getState();
      markClean();
      setGroupBy(["status"]);
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("setSelectedColumns", () => {
    test("updates selectedColumns", () => {
      const { setSelectedColumns } = useQueryStore.getState();
      setSelectedColumns(["timestamp", "status", "method"]);
      expect(useQueryStore.getState().selectedColumns).toEqual([
        "timestamp",
        "status",
        "method",
      ]);
    });

    test("marks dirty when columns differ from last executed", () => {
      const { setSelectedColumns, markClean } = useQueryStore.getState();
      markClean();
      setSelectedColumns(["timestamp"]);
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("setSelectedTimeColumn", () => {
    test("updates selectedTimeColumn", () => {
      const { setSelectedTimeColumn } = useQueryStore.getState();
      setSelectedTimeColumn("event_time");
      expect(useQueryStore.getState().selectedTimeColumn).toBe("event_time");
    });

    test("marks dirty when time column differs from last executed", () => {
      const { setSelectedTimeColumn, markClean } = useQueryStore.getState();
      markClean();
      setSelectedTimeColumn("event_time");
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("markClean", () => {
    test("sets isQueryDirty to false", () => {
      const { markDirty, markClean } = useQueryStore.getState();
      markDirty();
      markClean();
      expect(useQueryStore.getState().isQueryDirty).toBe(false);
    });

    test("saves current state as lastExecutedParams", () => {
      const {
        setAppliedFilter,
        setTimeRange,
        setSelectedColumns,
        setSelectedTimeColumn,
        setSort,
        setGroupBy,
        markClean,
      } = useQueryStore.getState();

      setAppliedFilter("status = 200");
      const range = getFlexibleRangeFromEnum("6h");
      setTimeRange(range);
      setSelectedColumns(["timestamp", "status"]);
      setSelectedTimeColumn("event_time");
      setSort([{ id: "timestamp", desc: true }]);
      setGroupBy(["status"]);
      markClean();

      const state = useQueryStore.getState();
      expect(state.lastExecutedParams).toEqual({
        filter: "status = 200",
        flexibleRange: range,
        columns: ["timestamp", "status"],
        timeColumn: "event_time",
        sorting: [{ id: "timestamp", desc: true }],
        groupBy: ["status"],
      });
    });
  });

  describe("markDirty", () => {
    test("sets isQueryDirty to true", () => {
      const { markDirty } = useQueryStore.getState();
      markDirty();
      expect(useQueryStore.getState().isQueryDirty).toBe(true);
    });
  });

  describe("resetQuery", () => {
    test("resets all state to initial values", () => {
      const {
        setQuery,
        setAppliedFilter,
        setTimeRange,
        setSort,
        setGroupBy,
        setSelectedColumns,
        setSelectedTimeColumn,
        markDirty,
        resetQuery,
      } = useQueryStore.getState();

      setQuery("status = 200");
      setAppliedFilter("status = 200");
      setTimeRange(getFlexibleRangeFromEnum("24h"));
      setSort([{ id: "timestamp", desc: true }]);
      setGroupBy(["status"]);
      setSelectedColumns(["timestamp", "status"]);
      setSelectedTimeColumn("event_time");
      markDirty();

      resetQuery();

      const state = useQueryStore.getState();
      expect(state.customFilter).toBe("");
      expect(state.appliedFilter).toBe("");
      expect(state.flexibleRange).toEqual(getFlexibleRangeFromEnum("1h"));
      expect(state.sorting).toEqual([]);
      expect(state.groupBy).toEqual([]);
      expect(state.selectedColumns).toEqual([]);
      expect(state.selectedTimeColumn).toBe("");
      expect(state.isQueryDirty).toBe(false);
      expect(state.lastExecutedParams).toBeNull();
    });
  });

  describe("querySelectors", () => {
    test("currentFilter returns appliedFilter when set", () => {
      const { setAppliedFilter } = useQueryStore.getState();
      setAppliedFilter("status = 200");
      const filter = querySelectors.currentFilter(useQueryStore.getState());
      expect(filter).toBe("status = 200");
    });

    test("currentFilter returns customFilter when appliedFilter is empty", () => {
      const { setQuery } = useQueryStore.getState();
      setQuery("method = 'GET'");
      const filter = querySelectors.currentFilter(useQueryStore.getState());
      expect(filter).toBe("method = 'GET'");
    });

    test("hasUnsavedChanges returns isQueryDirty", () => {
      const { markDirty } = useQueryStore.getState();
      markDirty();
      expect(querySelectors.hasUnsavedChanges(useQueryStore.getState())).toBe(
        true
      );
    });

    test("timeRangeBounds returns correct values for absolute range", () => {
      const { setTimeRange } = useQueryStore.getState();
      setTimeRange({
        type: "absolute",
        from: "2024-01-01T00:00:00Z",
        to: "2024-01-02T00:00:00Z",
        label: "Custom range",
      });
      const bounds = querySelectors.timeRangeBounds(useQueryStore.getState());
      expect(bounds.minTime).toBe("2024-01-01T00:00:00Z");
      expect(bounds.maxTime).toBe("2024-01-02T00:00:00Z");
    });

    test("timeRangeBounds returns undefined for relative range", () => {
      const bounds = querySelectors.timeRangeBounds(useQueryStore.getState());
      expect(bounds.minTime).toBeUndefined();
      expect(bounds.maxTime).toBeUndefined();
    });

    test("sortConfig returns formatted sort string", () => {
      const { setSort } = useQueryStore.getState();
      setSort([
        { id: "timestamp", desc: true },
        { id: "status", desc: false },
      ]);
      const config = querySelectors.sortConfig(useQueryStore.getState());
      expect(config).toBe("timestamp:desc,status:asc");
    });

    test("sortConfig returns undefined when no sorting", () => {
      const config = querySelectors.sortConfig(useQueryStore.getState());
      expect(config).toBeUndefined();
    });

    test("groupByConfig returns formatted group by string", () => {
      const { setGroupBy } = useQueryStore.getState();
      setGroupBy(["status", "method"]);
      const config = querySelectors.groupByConfig(useQueryStore.getState());
      expect(config).toBe("status,method");
    });

    test("groupByConfig returns undefined when no group by", () => {
      const config = querySelectors.groupByConfig(useQueryStore.getState());
      expect(config).toBeUndefined();
    });
  });
});
