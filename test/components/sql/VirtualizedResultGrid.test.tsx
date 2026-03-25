import { describe, it, expect, vi, beforeEach } from "bun:test";
import { render, screen } from "@testing-library/react";
import { VirtualizedResultGrid } from "@/components/sql/VirtualizedResultGrid";

vi.mock("@tanstack/react-virtual", () => {
  const mockVirtualizer = {
    getVirtualItems: vi.fn(() => [
      { index: 0, start: 0, size: 34, key: "0" },
      { index: 1, start: 34, size: 34, key: "1" },
      { index: 2, start: 68, size: 34, key: "2" },
    ]),
    getTotalSize: vi.fn(() => 3400),
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
  };
  return {
    useVirtualizer: vi.fn(() => mockVirtualizer),
  };
});

vi.mock("@tanstack/react-table", () => {
  const createMockRow = (index: number) => ({
    id: String(index),
    getVisibleCells: vi.fn(() => [
      {
        id: `${index}_id_0`,
        column: {
          columnDef: {
            cell: vi.fn(() => String(index + 1)),
          },
        },
        getContext: vi.fn(),
      },
    ]),
  });

  return {
    useReactTable: vi.fn(() => ({
      getHeaderGroups: vi.fn(() => [
        {
          id: "header1",
          headers: [
            {
              id: "id_0",
              getSize: vi.fn(() => 150),
              getCanSort: vi.fn(() => true),
              getIsSorted: vi.fn(() => null),
              column: {
                getCanSort: vi.fn(() => true),
                getIsSorted: vi.fn(() => null),
                clearSorting: vi.fn(),
                toggleSorting: vi.fn(),
                columnDef: {
                  header: "id",
                  cell: vi.fn(),
                },
              },
              isPlaceholder: false,
              columnDef: {
                header: "id",
                cell: vi.fn(),
              },
              getContext: vi.fn(),
            },
          ],
        },
      ]),
      getRowModel: vi.fn(() => ({
        rows: Array.from({ length: 100 }, (_, i) => createMockRow(i)),
      })),
      getState: vi.fn(() => ({
        pagination: { pageIndex: 0, pageSize: 100 },
        sorting: [],
      })),
      getPageCount: vi.fn(() => 1),
      setPageIndex: vi.fn(),
      setPageSize: vi.fn(),
    })),
    getCoreRowModel: vi.fn(),
    getSortedRowModel: vi.fn(),
    getPaginationRowModel: vi.fn(),
    flexRender: vi.fn((component: unknown) => component),
  };
});

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

global.URL.createObjectURL = vi.fn(() => "blob:mock");
global.URL.revokeObjectURL = vi.fn();

describe("VirtualizedResultGrid", () => {
  const mockMeta = [
    { name: "id", type: "UInt64" },
    { name: "name", type: "String" },
    { name: "value", type: "Float64" },
  ];

  const mockData = Array.from({ length: 100 }, (_, i) => [
    i + 1,
    `Item ${i + 1}`,
    (i + 1) * 1.5,
  ]);

  const mockStatistics = {
    elapsed: 0.5,
    rows_read: 100,
    bytes_read: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render with empty data", () => {
      render(
        <VirtualizedResultGrid data={[]} meta={mockMeta} statistics={mockStatistics} />
      );
      expect(screen.getByText("No results")).toBeInTheDocument();
    });

    it("should render statistics bar when statistics provided", () => {
      render(
        <VirtualizedResultGrid
          data={mockData}
          meta={mockMeta}
          statistics={mockStatistics}
          totalRows={100}
        />
      );
      expect(screen.getByText("rows")).toBeInTheDocument();
      expect(screen.getByText("rows read")).toBeInTheDocument();
    });

    it("should render Copy and CSV buttons", () => {
      render(
        <VirtualizedResultGrid
          data={mockData}
          meta={mockMeta}
          statistics={mockStatistics}
        />
      );
      expect(screen.getByText("Copy")).toBeInTheDocument();
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <VirtualizedResultGrid
          data={mockData}
          meta={mockMeta}
          className="custom-class"
        />
      );
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("Virtualization", () => {
    it("should render virtualized rows with correct height", () => {
      render(
        <VirtualizedResultGrid data={mockData} meta={mockMeta} />
      );
      const rows = screen.getAllByRole("row");
      const dataRows = rows.filter(row => row.getAttribute("data-index"));
      expect(dataRows.length).toBeGreaterThan(0);
      expect(dataRows[0]).toHaveStyle({ height: "34px" });
    });

    it("should render only visible rows (virtualization working)", () => {
      render(
        <VirtualizedResultGrid data={mockData} meta={mockMeta} />
      );
      const rows = screen.getAllByRole("row");
      const dataRows = rows.filter(row => row.getAttribute("data-index"));
      expect(dataRows.length).toBeLessThan(mockData.length);
    });

    it("should set correct total height for virtual container", () => {
      const { container } = render(
        <VirtualizedResultGrid data={mockData} meta={mockMeta} />
      );
      const virtualContainer = container.querySelector('[style*="height: 3400px"]');
      expect(virtualContainer).toBeInTheDocument();
    });

    it("should position rows correctly with translateY", () => {
      const { container } = render(
        <VirtualizedResultGrid data={mockData} meta={mockMeta} />
      );
      const firstRow = container.querySelector('[data-index="0"]');
      expect(firstRow).toHaveStyle({ transform: "translateY(0px)" });
    });
  });

  describe("Statistics Formatting", () => {
    it("should format bytes correctly", () => {
      render(
        <VirtualizedResultGrid
          data={mockData}
          meta={mockMeta}
          statistics={{ ...mockStatistics, bytes_read: 1048576 }}
        />
      );
      expect(screen.getByText("1 MB")).toBeInTheDocument();
    });

    it("should format duration correctly", () => {
      render(
        <VirtualizedResultGrid
          data={mockData}
          meta={mockMeta}
          statistics={{ ...mockStatistics, elapsed: 0.0005 }}
        />
      );
      expect(screen.getByText("500µs")).toBeInTheDocument();
    });

    it("should format large numbers with locale", () => {
      render(
        <VirtualizedResultGrid
          data={mockData}
          meta={mockMeta}
          statistics={{ ...mockStatistics, rows_read: 1000000 }}
        />
      );
      expect(screen.getByText("1,000,000")).toBeInTheDocument();
    });
  });
});
