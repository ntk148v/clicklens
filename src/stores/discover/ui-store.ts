"use client";

import { create } from "zustand";
import { devtools } from "../../lib/state/zustand.config";

/**
 * Discover UI State
 * Manages UI-related state for the Discover feature:
 * - Row selection and expansion
 * - Column visibility and order
 * - Row windowing for virtual scrolling
 * - Sidebar visibility
 */
export interface DiscoverUIState {
  // Row selection
  selectedRows: Set<string>;

  // Row expansion (for expandable rows)
  expandedRows: Set<string>;

  // Column visibility (column name -> visible)
  columnVisibility: Record<string, boolean>;

  // Column order (ordered list of column names)
  columnOrder: string[];

  // Row window for virtual scrolling
  rowWindow: {
    startIndex: number;
    endIndex: number;
  };

  // Sidebar visibility
  sidebarOpen: boolean;
}

export interface DiscoverUIActions {
  // Row selection
  setSelectedRows: (rows: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  toggleRowSelected: (rowId: string) => void;
  clearSelectedRows: () => void;

  // Row expansion
  toggleRowExpanded: (rowId: string) => void;
  expandRow: (rowId: string) => void;
  collapseRow: (rowId: string) => void;
  collapseAllRows: () => void;

  // Column visibility
  setColumnVisibility: (
    visibility: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  toggleColumnVisibility: (columnName: string) => void;
  setColumnVisible: (columnName: string, visible: boolean) => void;

  // Column order
  setColumnOrder: (order: string[]) => void;
  moveColumn: (columnName: string, newIndex: number) => void;

  // Row window
  setRowWindow: (window: { startIndex: number; endIndex: number }) => void;

  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Reset
  reset: () => void;
}

export type DiscoverUIStore = DiscoverUIState & DiscoverUIActions;

const initialState: DiscoverUIState = {
  selectedRows: new Set<string>(),
  expandedRows: new Set<string>(),
  columnVisibility: {},
  columnOrder: [],
  rowWindow: {
    startIndex: 0,
    endIndex: 100,
  },
  sidebarOpen: true,
};

export const useDiscoverUIStore = create<DiscoverUIStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Row selection
      setSelectedRows: (rows) => {
        const newRows = typeof rows === "function" ? rows(get().selectedRows) : rows;
        set({ selectedRows: newRows }, false, "setSelectedRows");
      },

      toggleRowSelected: (rowId) => {
        set((state) => {
          const newSelected = new Set(state.selectedRows);
          if (newSelected.has(rowId)) {
            newSelected.delete(rowId);
          } else {
            newSelected.add(rowId);
          }
          return { selectedRows: newSelected };
        }, false, "toggleRowSelected");
      },

      clearSelectedRows: () => {
        set({ selectedRows: new Set<string>() }, false, "clearSelectedRows");
      },

      // Row expansion
      toggleRowExpanded: (rowId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedRows);
          if (newExpanded.has(rowId)) {
            newExpanded.delete(rowId);
          } else {
            newExpanded.add(rowId);
          }
          return { expandedRows: newExpanded };
        }, false, "toggleRowExpanded");
      },

      expandRow: (rowId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedRows);
          newExpanded.add(rowId);
          return { expandedRows: newExpanded };
        }, false, "expandRow");
      },

      collapseRow: (rowId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedRows);
          newExpanded.delete(rowId);
          return { expandedRows: newExpanded };
        }, false, "collapseRow");
      },

      collapseAllRows: () => {
        set({ expandedRows: new Set<string>() }, false, "collapseAllRows");
      },

      // Column visibility
      setColumnVisibility: (visibility) => {
        const newVisibility =
          typeof visibility === "function"
            ? visibility(get().columnVisibility)
            : visibility;
        set({ columnVisibility: newVisibility }, false, "setColumnVisibility");
      },

      toggleColumnVisibility: (columnName) => {
        set((state) => {
          const currentVisibility = state.columnVisibility[columnName];
          const newVisibility = {
            ...state.columnVisibility,
            [columnName]: currentVisibility === false ? true : false,
          };
          return { columnVisibility: newVisibility };
        }, false, "toggleColumnVisibility");
      },

      setColumnVisible: (columnName, visible) => {
        set((state) => {
          const newVisibility = {
            ...state.columnVisibility,
            [columnName]: visible,
          };
          return { columnVisibility: newVisibility };
        }, false, "setColumnVisible");
      },

      // Column order
      setColumnOrder: (order) => {
        set({ columnOrder: order }, false, "setColumnOrder");
      },

      moveColumn: (columnName, newIndex) => {
        set((state) => {
          const order = [...state.columnOrder];
          const currentIndex = order.indexOf(columnName);
          if (currentIndex === -1) return state;

          const adjustedIndex = newIndex > currentIndex ? newIndex - 1 : newIndex;
          order.splice(currentIndex, 1);
          order.splice(adjustedIndex, 0, columnName);
          return { columnOrder: order };
        }, false, "moveColumn");
      },

      // Row window
      setRowWindow: (window) => {
        set({ rowWindow: window }, false, "setRowWindow");
      },

      // Sidebar
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, "toggleSidebar");
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open }, false, "setSidebarOpen");
      },

      // Reset
      reset: () => {
        set(initialState, false, "reset");
      },
    }),
    {
      name: "discover-ui-store",
    }
  )
);

// ====================
// Derived Selectors
// ====================

/**
 * Get the count of selected rows
 */
export const selectSelectedRowsCount = (state: DiscoverUIStore): number =>
  state.selectedRows.size;

/**
 * Get the count of expanded rows
 */
export const selectExpandedRowsCount = (state: DiscoverUIStore): number =>
  state.expandedRows.size;

/**
 * Get visible columns based on column order and visibility
 */
export const selectVisibleColumns = (
  state: DiscoverUIStore,
  allColumns: string[]
): string[] => {
  const { columnOrder, columnVisibility } = state;

  // If columnOrder is set, use it; otherwise use allColumns
  const columns = columnOrder.length > 0 ? columnOrder : allColumns;

  // Filter by visibility (default to visible if not set)
  return columns.filter((col) => columnVisibility[col] !== false);
};

/**
 * Get hidden columns
 */
export const selectHiddenColumns = (
  state: DiscoverUIStore,
  allColumns: string[]
): string[] => {
  const { columnOrder, columnVisibility } = state;
  const columns = columnOrder.length > 0 ? columnOrder : allColumns;

  return columns.filter((col) => columnVisibility[col] === false);
};

/**
 * Check if a specific row is selected
 */
export const selectIsRowSelected = (
  state: DiscoverUIStore,
  rowId: string
): boolean => state.selectedRows.has(rowId);

/**
 * Check if a specific row is expanded
 */
export const selectIsRowExpanded = (
  state: DiscoverUIStore,
  rowId: string
): boolean => state.expandedRows.has(rowId);

/**
 * Get row window info
 */
export const selectRowWindow = (
  state: DiscoverUIStore
): { startIndex: number; endIndex: number } => state.rowWindow;

/**
 * Check if sidebar is open
 */
export const selectSidebarOpen = (state: DiscoverUIStore): boolean =>
  state.sidebarOpen;

/**
 * Get selected row IDs as array
 */
export const selectSelectedRowsArray = (
  state: DiscoverUIStore
): string[] => Array.from(state.selectedRows);

/**
 * Get expanded row IDs as array
 */
export const selectExpandedRowsArray = (
  state: DiscoverUIStore
): string[] => Array.from(state.expandedRows);
