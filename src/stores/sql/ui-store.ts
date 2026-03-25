"use client";

import { create } from "zustand";
import { devtools } from "../../lib/state/zustand.config";

/**
 * SQL Console UI State
 * Manages UI-related state for the SQL Console feature:
 * - Selected tab ID
 * - Sidebar visibility
 * - Editor height
 * - Result height
 */
export interface SqlUIState {
  // Selected tab
  selectedTabId: string | null;

  // Sidebar visibility
  sidebarOpen: boolean;

  // Editor height in pixels
  editorHeight: number;

  // Result height in pixels
  resultHeight: number;
}

export interface SqlUIActions {
  // Tab selection
  setSelectedTab: (tabId: string | null) => void;

  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Editor height
  setEditorHeight: (height: number) => void;

  // Result height
  setResultHeight: (height: number) => void;

  // Reset
  reset: () => void;
}

export type SqlUIStore = SqlUIState & SqlUIActions;

const initialState: SqlUIState = {
  selectedTabId: null,
  sidebarOpen: true,
  editorHeight: 200,
  resultHeight: 400,
};

export const useSqlUIStore = create<SqlUIStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // Tab selection
      setSelectedTab: (tabId) => {
        set({ selectedTabId: tabId }, false, "setSelectedTab");
      },

      // Sidebar
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, "toggleSidebar");
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open }, false, "setSidebarOpen");
      },

      // Editor height
      setEditorHeight: (height) => {
        set({ editorHeight: height }, false, "setEditorHeight");
      },

      // Result height
      setResultHeight: (height) => {
        set({ resultHeight: height }, false, "setResultHeight");
      },

      // Reset
      reset: () => {
        set(initialState, false, "reset");
      },
    }),
    {
      name: "sql-ui-store",
    }
  )
);

// ====================
// Derived Selectors
// ====================

/**
 * Check if a tab is selected
 */
export const selectIsTabSelected = (
  state: SqlUIStore,
  tabId: string
): boolean => state.selectedTabId === tabId;

/**
 * Check if sidebar is open
 */
export const selectSidebarOpen = (state: SqlUIStore): boolean =>
  state.sidebarOpen;

/**
 * Get editor height
 */
export const selectEditorHeight = (state: SqlUIStore): number =>
  state.editorHeight;

/**
 * Get result height
 */
export const selectResultHeight = (state: SqlUIStore): number =>
  state.resultHeight;

/**
 * Get total content height (editor + result)
 */
export const selectTotalHeight = (state: SqlUIStore): number =>
  state.editorHeight + state.resultHeight;

/**
 * Get editor height as CSS value
 */
export const selectEditorHeightCss = (state: SqlUIStore): string =>
  `${state.editorHeight}px`;

/**
 * Get result height as CSS value
 */
export const selectResultHeightCss = (state: SqlUIStore): string =>
  `${state.resultHeight}px`;

/**
 * Get layout configuration
 */
export const selectLayoutConfig = (
  state: SqlUIStore
): { editorHeight: number; resultHeight: number; totalHeight: number } => ({
  editorHeight: state.editorHeight,
  resultHeight: state.resultHeight,
  totalHeight: state.editorHeight + state.resultHeight,
});
