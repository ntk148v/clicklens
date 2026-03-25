import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render } from "@testing-library/react";
import { VirtualizedDiscoverGrid } from "@/components/discover/VirtualizedDiscoverGrid";
import type { DiscoverRow } from "@/lib/types/discover";
import type { ColumnMetadata } from "@/lib/types/discover";
import type { SortingState } from "@tanstack/react-table";

function createMockRows(count: number): DiscoverRow[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: `2024-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    level: i % 5 === 0 ? "error" : i % 3 === 0 ? "warn" : "info",
    message: `Test message ${i + 1}`,
    host: `server-${(i % 3) + 1}`,
    count: i * 10,
  }));
}

function createMockColumns(): ColumnMetadata[] {
  return [
    { name: "timestamp", type: "DateTime" },
    { name: "level", type: "String" },
    { name: "message", type: "String" },
    { name: "host", type: "String" },
    { name: "count", type: "UInt64" },
  ];
}

function createDefaultProps(overrides = {}) {
  return {
    rows: createMockRows(100),
    columns: createMockColumns(),
    selectedColumns: ["timestamp", "level", "message", "host", "count"],
    isLoading: false,
    page: 1,
    pageSize: 50,
    totalHits: 100,
    onPageChange: mock(),
    onPageSizeChange: mock(),
    onFilterForValue: mock(),
    onFilterOutValue: mock(),
    sorting: [] as SortingState,
    onSortingChange: mock(),
    updateRowWindow: mock(),
    ...overrides,
  };
}

describe("VirtualizedDiscoverGrid", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("Rendering", () => {
    it("should render table with data", () => {
      const props = createDefaultProps({ rows: createMockRows(10) });
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      expect(container.querySelector("table")).toBeTruthy();
      expect(container.querySelector("thead")).toBeTruthy();
      expect(container.querySelector("tbody")).toBeTruthy();

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(10);
    });

    it("should render column headers", () => {
      const props = createDefaultProps();
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const headers = container.querySelectorAll("th");
      expect(headers.length).toBeGreaterThan(0);
    });

    it("should apply fixed row height of 34px", () => {
      const props = createDefaultProps({ rows: createMockRows(5) });
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const rows = container.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const style = row.getAttribute("style") || "";
        expect(style).toContain("height");
        expect(style).toContain("34px");
      });
    });

    it("should have scroll container with overflow-auto class", () => {
      const props = createDefaultProps();
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const scrollContainer = container.querySelector(".overflow-auto");
      expect(scrollContainer).toBeTruthy();
    });
  });

  describe("Loading States", () => {
    it("should show empty message when not loading with no data", () => {
      const props = createDefaultProps({
        rows: [],
        isLoading: false,
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      expect(container.textContent).toContain("No data found");
    });

    it("should show data when loading with existing data", () => {
      const props = createDefaultProps({
        rows: createMockRows(10),
        isLoading: true,
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(10);
    });
  });

  describe("Column Visibility", () => {
    it("should only show selected columns", () => {
      const props = createDefaultProps({
        selectedColumns: ["timestamp", "level"],
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const headers = Array.from(container.querySelectorAll("th"));
      const dataHeaders = headers.filter(
        (h) => h.textContent && !h.textContent.includes("Expand")
      );

      expect(dataHeaders.length).toBe(2);
    });

    it("should show all columns when selectedColumns is empty", () => {
      const props = createDefaultProps({
        selectedColumns: [],
        rows: [{ timestamp: "2024-01-01", level: "info", message: "Test", host: "server-1", count: 10 }],
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const headers = container.querySelectorAll("th");
      expect(headers.length).toBeGreaterThan(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data array", () => {
      const props = createDefaultProps({ rows: [] });
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      expect(container.textContent).toContain("No data found");
    });

    it("should handle single row", () => {
      const props = createDefaultProps({
        rows: createMockRows(1),
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(1);
    });

    it("should handle large datasets", () => {
      const props = createDefaultProps({
        rows: createMockRows(1000),
        totalHits: 1000,
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(1000);
    });

    it("should handle rows with missing fields", () => {
      const props = createDefaultProps({
        rows: [{ timestamp: "2024-01-01" }],
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(1);
    });
  });

  describe("Pagination", () => {
    it("should render pagination controls", () => {
      const props = createDefaultProps();
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      expect(container.textContent).toContain("100");
    });

    it("should display correct page info", () => {
      const props = createDefaultProps({
        page: 2,
        pageSize: 50,
        totalHits: 200,
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);
      expect(container.textContent).toContain("200");
    });
  });

  describe("Sorting", () => {
    it("should render column headers with sort buttons", () => {
      const props = createDefaultProps();
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      props.selectedColumns.forEach((colName) => {
        expect(container.textContent).toContain(colName);
      });
    });

    it("should display sort indicator when column is sorted", () => {
      const props = createDefaultProps({
        sorting: [{ id: "timestamp", desc: false }],
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const sortIcons = container.querySelectorAll("svg");
      expect(sortIcons.length).toBeGreaterThan(0);
    });
  });

  describe("Value Formatting", () => {
    it("should show null for null/undefined values", () => {
      const props = createDefaultProps({
        rows: [{ timestamp: null, level: "info", message: null }],
        selectedColumns: ["timestamp", "level", "message"],
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);
      const nullElements = container.querySelectorAll(".italic");
      expect(nullElements.length).toBeGreaterThan(0);
    });

    it("should format boolean values as badges", () => {
      const props = createDefaultProps({
        columns: [{ name: "active", type: "Bool" }],
        rows: [{ active: true, level: "info", message: "Test" }],
        selectedColumns: ["active", "level", "message"],
      });

      const { container } = render(<VirtualizedDiscoverGrid {...props} />);
      expect(container.textContent).toContain("true");
    });
  });

  describe("Accessibility", () => {
    it("should have proper table structure", () => {
      const props = createDefaultProps();
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      expect(container.querySelector("table")).toBeTruthy();
      expect(container.querySelector("thead")).toBeTruthy();
      expect(container.querySelector("tbody")).toBeTruthy();
    });

    it("should have clickable rows", () => {
      const props = createDefaultProps();
      const { container } = render(<VirtualizedDiscoverGrid {...props} />);

      const rows = container.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        expect(row.classList.toString()).toContain("cursor-pointer");
      });
    });
  });
});
