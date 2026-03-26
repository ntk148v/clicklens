import { describe, expect, test, beforeEach } from "bun:test";
import {
  useDiscoverUIStore,
  selectSelectedRowsCount,
  selectExpandedRowsCount,
  selectVisibleColumns,
  selectHiddenColumns,
  selectIsRowSelected,
  selectIsRowExpanded,
  selectRowWindow,
  selectSidebarOpen,
  selectSelectedRowsArray,
  selectExpandedRowsArray,
} from "../../../src/stores/discover/ui-store";

describe("discover ui store", () => {
  beforeEach(() => {
    useDiscoverUIStore.getState().reset();
  });

  describe("initial state", () => {
    test("has empty selected rows", () => {
      const state = useDiscoverUIStore.getState();
      expect(state.selectedRows.size).toBe(0);
    });

    test("has empty expanded rows", () => {
      const state = useDiscoverUIStore.getState();
      expect(state.expandedRows.size).toBe(0);
    });

    test("has empty column visibility", () => {
      const state = useDiscoverUIStore.getState();
      expect(Object.keys(state.columnVisibility).length).toBe(0);
    });

    test("has empty column order", () => {
      const state = useDiscoverUIStore.getState();
      expect(state.columnOrder.length).toBe(0);
    });

    test("has default row window", () => {
      const state = useDiscoverUIStore.getState();
      expect(state.rowWindow).toEqual({ startIndex: 0, endIndex: 100 });
    });

    test("sidebar is open by default", () => {
      const state = useDiscoverUIStore.getState();
      expect(state.sidebarOpen).toBe(true);
    });
  });

  describe("row selection", () => {
    test("setSelectedRows updates selected rows", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1", "row-2"]));

      expect(useDiscoverUIStore.getState().selectedRows.size).toBe(2);
      expect(useDiscoverUIStore.getState().selectedRows.has("row-1")).toBe(true);
      expect(useDiscoverUIStore.getState().selectedRows.has("row-2")).toBe(true);
    });

    test("setSelectedRows with function updates selected rows", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1"]));
      store.setSelectedRows((prev) => new Set([...prev, "row-2"]));

      expect(useDiscoverUIStore.getState().selectedRows.size).toBe(2);
    });

    test("toggleRowSelected adds row if not selected", () => {
      const store = useDiscoverUIStore.getState();
      store.toggleRowSelected("row-1");

      expect(useDiscoverUIStore.getState().selectedRows.has("row-1")).toBe(true);
    });

    test("toggleRowSelected removes row if already selected", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1"]));
      store.toggleRowSelected("row-1");

      expect(useDiscoverUIStore.getState().selectedRows.has("row-1")).toBe(false);
    });

    test("clearSelectedRows removes all selections", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1", "row-2"]));
      store.clearSelectedRows();

      expect(useDiscoverUIStore.getState().selectedRows.size).toBe(0);
    });
  });

  describe("row expansion", () => {
    test("toggleRowExpanded adds row if not expanded", () => {
      const store = useDiscoverUIStore.getState();
      store.toggleRowExpanded("row-1");

      expect(useDiscoverUIStore.getState().expandedRows.has("row-1")).toBe(true);
    });

    test("toggleRowExpanded removes row if already expanded", () => {
      const store = useDiscoverUIStore.getState();
      store.toggleRowExpanded("row-1");
      store.toggleRowExpanded("row-1");

      expect(useDiscoverUIStore.getState().expandedRows.has("row-1")).toBe(false);
    });

    test("expandRow adds row to expanded", () => {
      const store = useDiscoverUIStore.getState();
      store.expandRow("row-1");

      expect(useDiscoverUIStore.getState().expandedRows.has("row-1")).toBe(true);
    });

    test("collapseRow removes row from expanded", () => {
      const store = useDiscoverUIStore.getState();
      store.expandRow("row-1");
      store.collapseRow("row-1");

      expect(useDiscoverUIStore.getState().expandedRows.has("row-1")).toBe(false);
    });

    test("collapseAllRows removes all expanded rows", () => {
      const store = useDiscoverUIStore.getState();
      store.expandRow("row-1");
      store.expandRow("row-2");
      store.collapseAllRows();

      expect(useDiscoverUIStore.getState().expandedRows.size).toBe(0);
    });
  });

  describe("column visibility", () => {
    test("setColumnVisibility updates visibility", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnVisibility({ col1: true, col2: false });

      expect(useDiscoverUIStore.getState().columnVisibility).toEqual({
        col1: true,
        col2: false,
      });
    });

    test("setColumnVisibility with function updates visibility", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnVisibility({ col1: true });
      store.setColumnVisibility((prev) => ({ ...prev, col2: false }));

      expect(useDiscoverUIStore.getState().columnVisibility.col1).toBe(true);
      expect(useDiscoverUIStore.getState().columnVisibility.col2).toBe(false);
    });

    test("toggleColumnVisibility toggles visibility", () => {
      const store = useDiscoverUIStore.getState();
      store.toggleColumnVisibility("col1");

      expect(useDiscoverUIStore.getState().columnVisibility.col1).toBe(false);

      store.toggleColumnVisibility("col1");
      expect(useDiscoverUIStore.getState().columnVisibility.col1).toBe(true);
    });

    test("setColumnVisible sets specific column visibility", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnVisible("col1", false);

      expect(useDiscoverUIStore.getState().columnVisibility.col1).toBe(false);
    });
  });

  describe("column order", () => {
    test("setColumnOrder updates order", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnOrder(["col1", "col2", "col3"]);

      expect(useDiscoverUIStore.getState().columnOrder).toEqual([
        "col1",
        "col2",
        "col3",
      ]);
    });

    test("moveColumn moves column to new position", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnOrder(["col1", "col2", "col3"]);
      store.moveColumn("col1", 2);

      expect(useDiscoverUIStore.getState().columnOrder).toEqual([
        "col2",
        "col1",
        "col3",
      ]);
    });

    test("moveColumn handles invalid column gracefully", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnOrder(["col1", "col2"]);
      store.moveColumn("nonexistent", 1);

      expect(useDiscoverUIStore.getState().columnOrder).toEqual(["col1", "col2"]);
    });
  });

  describe("row window", () => {
    test("setRowWindow updates window", () => {
      const store = useDiscoverUIStore.getState();
      store.setRowWindow({ startIndex: 50, endIndex: 150 });

      expect(useDiscoverUIStore.getState().rowWindow).toEqual({
        startIndex: 50,
        endIndex: 150,
      });
    });
  });

  describe("sidebar", () => {
    test("toggleSidebar toggles sidebar open state", () => {
      const store = useDiscoverUIStore.getState();
      const initialState = store.sidebarOpen;

      store.toggleSidebar();
      expect(useDiscoverUIStore.getState().sidebarOpen).toBe(!initialState);

      store.toggleSidebar();
      expect(useDiscoverUIStore.getState().sidebarOpen).toBe(initialState);
    });

    test("setSidebarOpen sets specific state", () => {
      const store = useDiscoverUIStore.getState();
      store.setSidebarOpen(false);

      expect(useDiscoverUIStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe("reset", () => {
    test("reset restores initial state", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1"]));
      store.expandRow("row-1");
      store.setColumnOrder(["col1"]);
      store.setRowWindow({ startIndex: 50, endIndex: 150 });
      store.setSidebarOpen(false);

      store.reset();

      const state = useDiscoverUIStore.getState();
      expect(state.selectedRows.size).toBe(0);
      expect(state.expandedRows.size).toBe(0);
      expect(state.columnOrder.length).toBe(0);
      expect(state.rowWindow).toEqual({ startIndex: 0, endIndex: 100 });
      expect(state.sidebarOpen).toBe(true);
    });
  });

  describe("selectors", () => {
    test("selectSelectedRowsCount returns correct count", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1", "row-2", "row-3"]));

      expect(selectSelectedRowsCount(useDiscoverUIStore.getState())).toBe(3);
    });

    test("selectExpandedRowsCount returns correct count", () => {
      const store = useDiscoverUIStore.getState();
      store.expandRow("row-1");
      store.expandRow("row-2");

      expect(selectExpandedRowsCount(useDiscoverUIStore.getState())).toBe(2);
    });

    test("selectVisibleColumns filters by visibility", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnOrder(["col1", "col2", "col3"]);
      store.setColumnVisibility({ col2: false });

      const allColumns = ["col1", "col2", "col3"];
      expect(selectVisibleColumns(useDiscoverUIStore.getState(), allColumns)).toEqual([
        "col1",
        "col3",
      ]);
    });

    test("selectVisibleColumns uses allColumns when no columnOrder", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnVisibility({ col2: false });

      const allColumns = ["col1", "col2", "col3"];
      expect(selectVisibleColumns(useDiscoverUIStore.getState(), allColumns)).toEqual([
        "col1",
        "col3",
      ]);
    });

    test("selectHiddenColumns returns hidden columns", () => {
      const store = useDiscoverUIStore.getState();
      store.setColumnOrder(["col1", "col2", "col3"]);
      store.setColumnVisibility({ col2: false, col3: false });

      const allColumns = ["col1", "col2", "col3"];
      expect(selectHiddenColumns(useDiscoverUIStore.getState(), allColumns)).toEqual([
        "col2",
        "col3",
      ]);
    });

    test("selectIsRowSelected returns correct state", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1"]));

      expect(selectIsRowSelected(useDiscoverUIStore.getState(), "row-1")).toBe(true);
      expect(selectIsRowSelected(useDiscoverUIStore.getState(), "row-2")).toBe(false);
    });

    test("selectIsRowExpanded returns correct state", () => {
      const store = useDiscoverUIStore.getState();
      store.expandRow("row-1");

      expect(selectIsRowExpanded(useDiscoverUIStore.getState(), "row-1")).toBe(true);
      expect(selectIsRowExpanded(useDiscoverUIStore.getState(), "row-2")).toBe(false);
    });

    test("selectRowWindow returns window", () => {
      const store = useDiscoverUIStore.getState();
      store.setRowWindow({ startIndex: 50, endIndex: 150 });

      expect(selectRowWindow(useDiscoverUIStore.getState())).toEqual({
        startIndex: 50,
        endIndex: 150,
      });
    });

    test("selectSidebarOpen returns sidebar state", () => {
      const store = useDiscoverUIStore.getState();
      store.setSidebarOpen(false);

      expect(selectSidebarOpen(useDiscoverUIStore.getState())).toBe(false);
    });

    test("selectSelectedRowsArray returns array", () => {
      const store = useDiscoverUIStore.getState();
      store.setSelectedRows(new Set(["row-1", "row-2"]));

      expect(selectSelectedRowsArray(useDiscoverUIStore.getState())).toEqual([
        "row-1",
        "row-2",
      ]);
    });

    test("selectExpandedRowsArray returns array", () => {
      const store = useDiscoverUIStore.getState();
      store.expandRow("row-1");
      store.expandRow("row-2");

      expect(selectExpandedRowsArray(useDiscoverUIStore.getState())).toEqual([
        "row-1",
        "row-2",
      ]);
    });
  });
});
