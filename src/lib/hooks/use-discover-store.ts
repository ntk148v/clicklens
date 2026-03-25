import { useMemo } from "react";
import { useQueryStore } from "@/stores/discover/query-store";
import { useDiscoverUIStore } from "@/stores/discover/ui-store";
import type { FlexibleTimeRange } from "@/lib/types/discover";
import type { SortingState } from "@tanstack/react-table";

export interface DiscoverStoreState {
  customFilter: string;
  appliedFilter: string;
  flexibleRange: FlexibleTimeRange;
  sorting: SortingState;
  groupBy: string[];
  selectedColumns: string[];
  selectedTimeColumn: string;
  isQueryDirty: boolean;
  selectedRows: Set<string>;
  expandedRows: Set<string>;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  rowWindow: { startIndex: number; endIndex: number };
  sidebarOpen: boolean;
}

export interface DiscoverStoreActions {
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
  setSelectedRows: (rows: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  toggleRowSelected: (rowId: string) => void;
  clearSelectedRows: () => void;
  toggleRowExpanded: (rowId: string) => void;
  expandRow: (rowId: string) => void;
  collapseRow: (rowId: string) => void;
  collapseAllRows: () => void;
  setColumnVisibility: (visibility: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  toggleColumnVisibility: (columnName: string) => void;
  setColumnVisible: (columnName: string, visible: boolean) => void;
  setColumnOrder: (order: string[]) => void;
  moveColumn: (columnName: string, newIndex: number) => void;
  setRowWindow: (window: { startIndex: number; endIndex: number }) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  reset: () => void;
}

export function useDiscoverStore(): DiscoverStoreState & DiscoverStoreActions {
  const queryStore = useQueryStore();
  const uiStore = useDiscoverUIStore();

  return useMemo(
    () => ({
      customFilter: queryStore.customFilter,
      appliedFilter: queryStore.appliedFilter,
      flexibleRange: queryStore.flexibleRange,
      sorting: queryStore.sorting,
      groupBy: queryStore.groupBy,
      selectedColumns: queryStore.selectedColumns,
      selectedTimeColumn: queryStore.selectedTimeColumn,
      isQueryDirty: queryStore.isQueryDirty,
      selectedRows: uiStore.selectedRows,
      expandedRows: uiStore.expandedRows,
      columnVisibility: uiStore.columnVisibility,
      columnOrder: uiStore.columnOrder,
      rowWindow: uiStore.rowWindow,
      sidebarOpen: uiStore.sidebarOpen,
      setQuery: queryStore.setQuery,
      setAppliedFilter: queryStore.setAppliedFilter,
      setFilters: queryStore.setFilters,
      setTimeRange: queryStore.setTimeRange,
      setSort: queryStore.setSort,
      setGroupBy: queryStore.setGroupBy,
      setSelectedColumns: queryStore.setSelectedColumns,
      setSelectedTimeColumn: queryStore.setSelectedTimeColumn,
      markClean: queryStore.markClean,
      markDirty: queryStore.markDirty,
      resetQuery: queryStore.resetQuery,
      setSelectedRows: uiStore.setSelectedRows,
      toggleRowSelected: uiStore.toggleRowSelected,
      clearSelectedRows: uiStore.clearSelectedRows,
      toggleRowExpanded: uiStore.toggleRowExpanded,
      expandRow: uiStore.expandRow,
      collapseRow: uiStore.collapseRow,
      collapseAllRows: uiStore.collapseAllRows,
      setColumnVisibility: uiStore.setColumnVisibility,
      toggleColumnVisibility: uiStore.toggleColumnVisibility,
      setColumnVisible: uiStore.setColumnVisible,
      setColumnOrder: uiStore.setColumnOrder,
      moveColumn: uiStore.moveColumn,
      setRowWindow: uiStore.setRowWindow,
      toggleSidebar: uiStore.toggleSidebar,
      setSidebarOpen: uiStore.setSidebarOpen,
      reset: uiStore.reset,
    }),
    [queryStore, uiStore],
  );
}

export function useDiscoverQueryState() {
  return useQueryStore();
}

export function useDiscoverUIState() {
  return useDiscoverUIStore();
}
