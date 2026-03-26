import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { DiscoverRow } from "@/lib/types/discover";

export interface HistogramDataPoint {
  time: string;
  count: number;
}

export interface LoadingState {
  data: boolean;
  histogram: boolean;
}

export interface DiscoverDataState {
  rows: DiscoverRow[];
  columns: string[];
  totalCount: number;
  histogramData: HistogramDataPoint[];
  loading: LoadingState;
  error: string | null;
}

export interface DiscoverDataActions {
  setRows: (rows: DiscoverRow[]) => void;
  appendRows: (rows: DiscoverRow[]) => void;
  setColumns: (columns: string[]) => void;
  setTotalCount: (count: number) => void;
  setHistogramData: (data: HistogramDataPoint[]) => void;
  setDataLoading: (loading: boolean) => void;
  setHistogramLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearData: () => void;
  clearError: () => void;
  optimisticSetRows: (rows: DiscoverRow[]) => () => void;
  optimisticSetTotalCount: (count: number) => () => void;
}

export type DiscoverDataStore = DiscoverDataState & DiscoverDataActions;

const initialState: DiscoverDataState = {
  rows: [],
  columns: [],
  totalCount: 0,
  histogramData: [],
  loading: {
    data: false,
    histogram: false,
  },
  error: null,
};

export const createDiscoverDataStore = () =>
  create<DiscoverDataStore>()(
    devtools(
      (set, get) => ({
        ...initialState,

        setRows: (rows) =>
          set({ rows, error: null }, false, "setRows"),

        appendRows: (newRows) =>
          set(
            (state) => ({ rows: [...state.rows, ...newRows] }),
            false,
            "appendRows"
          ),

        setColumns: (columns) =>
          set({ columns }, false, "setColumns"),

        setTotalCount: (totalCount) =>
          set({ totalCount }, false, "setTotalCount"),

        setHistogramData: (histogramData) =>
          set({ histogramData }, false, "setHistogramData"),

        setDataLoading: (loading) =>
          set(
            (state) => ({
              loading: { ...state.loading, data: loading },
            }),
            false,
            "setDataLoading"
          ),

        setHistogramLoading: (loading) =>
          set(
            (state) => ({
              loading: { ...state.loading, histogram: loading },
            }),
            false,
            "setHistogramLoading"
          ),

        setError: (error) =>
          set({ error }, false, "setError"),

        clearData: () =>
          set(initialState, false, "clearData"),

        clearError: () =>
          set({ error: null }, false, "clearError"),

        optimisticSetRows: (rows) => {
          const previousRows = get().rows;
          set({ rows, error: null }, false, "optimisticSetRows");
          return () => set({ rows: previousRows }, false, "rollbackSetRows");
        },

        optimisticSetTotalCount: (count) => {
          const previousCount = get().totalCount;
          set({ totalCount: count }, false, "optimisticSetTotalCount");
          return () => set({ totalCount: previousCount }, false, "rollbackSetTotalCount");
        },
      }),
      {
        name: "discover-data-store",
        enabled: process.env.NODE_ENV !== "production",
      }
    )
  );

export type DiscoverDataStoreHook = ReturnType<typeof createDiscoverDataStore>;
