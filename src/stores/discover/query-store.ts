import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { SortingState } from "@tanstack/react-table";
import type { FlexibleTimeRange } from "@/lib/types/discover";
import { getFlexibleRangeFromEnum } from "@/lib/types/discover";

export interface QueryState {
  customFilter: string;
  appliedFilter: string;
  flexibleRange: FlexibleTimeRange;
  sorting: SortingState;
  groupBy: string[];
  selectedColumns: string[];
  selectedTimeColumn: string;
  isQueryDirty: boolean;
  lastExecutedParams: {
    filter: string;
    flexibleRange: FlexibleTimeRange;
    columns: string[];
    timeColumn: string;
    sorting: SortingState;
    groupBy: string[];
  } | null;
}

export interface QueryActions {
  setQuery: (query: string) => void;
  setAppliedFilter: (filter: string) => void;
  setFilters: (filter: string) => void;
  setTimeRange: (range: FlexibleTimeRange) => void;
  setSort: (sorting: SortingState) => void;
  setGroupBy: (groupBy: string[]) => void;
  setSelectedColumns: (columns: string[]) => void;
  setSelectedTimeColumn: (column: string) => void;
  markClean: () => void;
  markDirty: () => void;
  resetQuery: () => void;
}

export type QueryStore = QueryState & QueryActions;

const DEFAULT_TIME_RANGE = getFlexibleRangeFromEnum("1h");

const initialState: QueryState = {
  customFilter: "",
  appliedFilter: "",
  flexibleRange: DEFAULT_TIME_RANGE,
  sorting: [],
  groupBy: [],
  selectedColumns: [],
  selectedTimeColumn: "",
  isQueryDirty: false,
  lastExecutedParams: null,
};

export const useQueryStore = create<QueryStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setQuery: (query: string) => {
          set({ customFilter: query }, false, "setQuery");
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty = query !== state.lastExecutedParams.filter;
            set({ isQueryDirty: isDirty }, false, "setQuery/dirty");
          }
        },

        setAppliedFilter: (filter: string) => {
          set({ appliedFilter: filter }, false, "setAppliedFilter");
        },

        setFilters: (filter: string) => {
          set(
            { customFilter: filter, appliedFilter: filter },
            false,
            "setFilters"
          );
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty = filter !== state.lastExecutedParams.filter;
            set({ isQueryDirty: isDirty }, false, "setFilters/dirty");
          }
        },

        setTimeRange: (range: FlexibleTimeRange) => {
          set({ flexibleRange: range }, false, "setTimeRange");
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty =
              JSON.stringify(range) !==
              JSON.stringify(state.lastExecutedParams.flexibleRange);
            set({ isQueryDirty: isDirty }, false, "setTimeRange/dirty");
          }
        },

        setSort: (sorting: SortingState) => {
          set({ sorting }, false, "setSort");
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty =
              JSON.stringify(sorting) !==
              JSON.stringify(state.lastExecutedParams.sorting);
            set({ isQueryDirty: isDirty }, false, "setSort/dirty");
          }
        },

        setGroupBy: (groupBy: string[]) => {
          set({ groupBy }, false, "setGroupBy");
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty =
              JSON.stringify(groupBy) !==
              JSON.stringify(state.lastExecutedParams.groupBy);
            set({ isQueryDirty: isDirty }, false, "setGroupBy/dirty");
          }
        },

        setSelectedColumns: (columns: string[]) => {
          set({ selectedColumns: columns }, false, "setSelectedColumns");
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty =
              JSON.stringify(columns) !==
              JSON.stringify(state.lastExecutedParams.columns);
            set({ isQueryDirty: isDirty }, false, "setSelectedColumns/dirty");
          }
        },

        setSelectedTimeColumn: (column: string) => {
          set({ selectedTimeColumn: column }, false, "setSelectedTimeColumn");
          const state = get();
          if (state.lastExecutedParams) {
            const isDirty = column !== state.lastExecutedParams.timeColumn;
            set(
              { isQueryDirty: isDirty },
              false,
              "setSelectedTimeColumn/dirty"
            );
          }
        },

        markClean: () => {
          const state = get();
          set(
            {
              isQueryDirty: false,
              lastExecutedParams: {
                filter: state.appliedFilter,
                flexibleRange: state.flexibleRange,
                columns: [...state.selectedColumns],
                timeColumn: state.selectedTimeColumn,
                sorting: [...state.sorting],
                groupBy: [...state.groupBy],
              },
            },
            false,
            "markClean"
          );
        },

        markDirty: () => {
          set({ isQueryDirty: true }, false, "markDirty");
        },

        resetQuery: () => {
          set(
            {
              ...initialState,
              lastExecutedParams: null,
            },
            false,
            "resetQuery"
          );
        },
      }),
      {
        name: "clicklens-discover-query",
        partialize: (state) => ({
          customFilter: state.customFilter,
          appliedFilter: state.appliedFilter,
          flexibleRange: state.flexibleRange,
          sorting: state.sorting,
          groupBy: state.groupBy,
          selectedColumns: state.selectedColumns,
          selectedTimeColumn: state.selectedTimeColumn,
        }),
      }
    ),
    {
      name: "clicklens-discover-query",
      enabled: process.env.NODE_ENV !== "production",
    }
  )
);

export const querySelectors = {
  currentFilter: (state: QueryStore) =>
    state.appliedFilter || state.customFilter,

  hasUnsavedChanges: (state: QueryStore) => state.isQueryDirty,

  timeRangeBounds: (state: QueryStore) => {
    const { flexibleRange } = state;
    if (flexibleRange.type === "absolute") {
      return {
        minTime: flexibleRange.from,
        maxTime: flexibleRange.to === "now" ? undefined : flexibleRange.to,
      };
    }
    return {
      minTime: undefined,
      maxTime: undefined,
    };
  },

  sortConfig: (state: QueryStore) => {
    if (state.sorting.length === 0) return undefined;
    return state.sorting
      .map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`)
      .join(",");
  },

  groupByConfig: (state: QueryStore) => {
    if (state.groupBy.length === 0) return undefined;
    return state.groupBy.join(",");
  },
};
