import { describe, expect, test, beforeEach } from "bun:test";
import {
  useSqlUIStore,
  selectIsTabSelected,
  selectSidebarOpen,
  selectEditorHeight,
  selectResultHeight,
  selectTotalHeight,
  selectEditorHeightCss,
  selectResultHeightCss,
  selectLayoutConfig,
} from "../../../src/stores/sql/ui-store";

describe("sql ui store", () => {
  beforeEach(() => {
    useSqlUIStore.getState().reset();
  });

  describe("initial state", () => {
    test("has no selected tab", () => {
      const state = useSqlUIStore.getState();
      expect(state.selectedTabId).toBeNull();
    });

    test("sidebar is open by default", () => {
      const state = useSqlUIStore.getState();
      expect(state.sidebarOpen).toBe(true);
    });

    test("has default editor height", () => {
      const state = useSqlUIStore.getState();
      expect(state.editorHeight).toBe(200);
    });

    test("has default result height", () => {
      const state = useSqlUIStore.getState();
      expect(state.resultHeight).toBe(400);
    });
  });

  describe("tab selection", () => {
    test("setSelectedTab updates selected tab", () => {
      const store = useSqlUIStore.getState();
      store.setSelectedTab("tab-1");

      expect(useSqlUIStore.getState().selectedTabId).toBe("tab-1");
    });

    test("setSelectedTab with null clears selection", () => {
      const store = useSqlUIStore.getState();
      store.setSelectedTab("tab-1");
      store.setSelectedTab(null);

      expect(useSqlUIStore.getState().selectedTabId).toBeNull();
    });

    test("setSelectedTab overwrites previous selection", () => {
      const store = useSqlUIStore.getState();
      store.setSelectedTab("tab-1");
      store.setSelectedTab("tab-2");

      expect(useSqlUIStore.getState().selectedTabId).toBe("tab-2");
    });
  });

  describe("sidebar", () => {
    test("toggleSidebar toggles sidebar open state", () => {
      const store = useSqlUIStore.getState();
      const initialState = store.sidebarOpen;

      store.toggleSidebar();
      expect(useSqlUIStore.getState().sidebarOpen).toBe(!initialState);

      store.toggleSidebar();
      expect(useSqlUIStore.getState().sidebarOpen).toBe(initialState);
    });

    test("setSidebarOpen sets specific state", () => {
      const store = useSqlUIStore.getState();
      store.setSidebarOpen(false);

      expect(useSqlUIStore.getState().sidebarOpen).toBe(false);
    });

    test("setSidebarOpen can reopen sidebar", () => {
      const store = useSqlUIStore.getState();
      store.setSidebarOpen(false);
      store.setSidebarOpen(true);

      expect(useSqlUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe("editor height", () => {
    test("setEditorHeight updates height", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(300);

      expect(useSqlUIStore.getState().editorHeight).toBe(300);
    });

    test("setEditorHeight accepts zero", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(0);

      expect(useSqlUIStore.getState().editorHeight).toBe(0);
    });

    test("setEditorHeight accepts large values", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(1000);

      expect(useSqlUIStore.getState().editorHeight).toBe(1000);
    });
  });

  describe("result height", () => {
    test("setResultHeight updates height", () => {
      const store = useSqlUIStore.getState();
      store.setResultHeight(500);

      expect(useSqlUIStore.getState().resultHeight).toBe(500);
    });

    test("setResultHeight accepts zero", () => {
      const store = useSqlUIStore.getState();
      store.setResultHeight(0);

      expect(useSqlUIStore.getState().resultHeight).toBe(0);
    });

    test("setResultHeight accepts large values", () => {
      const store = useSqlUIStore.getState();
      store.setResultHeight(2000);

      expect(useSqlUIStore.getState().resultHeight).toBe(2000);
    });
  });

  describe("reset", () => {
    test("reset restores initial state", () => {
      const store = useSqlUIStore.getState();
      store.setSelectedTab("tab-1");
      store.setSidebarOpen(false);
      store.setEditorHeight(300);
      store.setResultHeight(500);

      store.reset();

      const state = useSqlUIStore.getState();
      expect(state.selectedTabId).toBeNull();
      expect(state.sidebarOpen).toBe(true);
      expect(state.editorHeight).toBe(200);
      expect(state.resultHeight).toBe(400);
    });
  });

  describe("selectors", () => {
    test("selectIsTabSelected returns true for selected tab", () => {
      const store = useSqlUIStore.getState();
      store.setSelectedTab("tab-1");

      expect(selectIsTabSelected(useSqlUIStore.getState(), "tab-1")).toBe(true);
    });

    test("selectIsTabSelected returns false for non-selected tab", () => {
      const store = useSqlUIStore.getState();
      store.setSelectedTab("tab-1");

      expect(selectIsTabSelected(useSqlUIStore.getState(), "tab-2")).toBe(false);
    });

    test("selectIsTabSelected returns false when no tab selected", () => {
      expect(selectIsTabSelected(useSqlUIStore.getState(), "tab-1")).toBe(false);
    });

    test("selectSidebarOpen returns sidebar state", () => {
      const store = useSqlUIStore.getState();
      store.setSidebarOpen(false);

      expect(selectSidebarOpen(useSqlUIStore.getState())).toBe(false);
    });

    test("selectEditorHeight returns editor height", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(300);

      expect(selectEditorHeight(useSqlUIStore.getState())).toBe(300);
    });

    test("selectResultHeight returns result height", () => {
      const store = useSqlUIStore.getState();
      store.setResultHeight(500);

      expect(selectResultHeight(useSqlUIStore.getState())).toBe(500);
    });

    test("selectTotalHeight returns sum of editor and result height", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(300);
      store.setResultHeight(500);

      expect(selectTotalHeight(useSqlUIStore.getState())).toBe(800);
    });

    test("selectEditorHeightCss returns CSS value", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(300);

      expect(selectEditorHeightCss(useSqlUIStore.getState())).toBe("300px");
    });

    test("selectResultHeightCss returns CSS value", () => {
      const store = useSqlUIStore.getState();
      store.setResultHeight(500);

      expect(selectResultHeightCss(useSqlUIStore.getState())).toBe("500px");
    });

    test("selectLayoutConfig returns layout configuration", () => {
      const store = useSqlUIStore.getState();
      store.setEditorHeight(300);
      store.setResultHeight(500);

      expect(selectLayoutConfig(useSqlUIStore.getState())).toEqual({
        editorHeight: 300,
        resultHeight: 500,
        totalHeight: 800,
      });
    });
  });
});
