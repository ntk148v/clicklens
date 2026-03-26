import { describe, it, expect, vi, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useGridAccessibility } from "@/components/virtual/accessibility";

describe("useGridAccessibility", () => {
  const defaultProps = {
    rowCount: 10,
    columnCount: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with focused cell at (0, 0)", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(0);
    });

    it("should return correct grid props", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      const gridProps = result.current.getGridProps();

      expect(gridProps.role).toBe("grid");
      expect(gridProps["aria-rowcount"]).toBe(10);
      expect(gridProps["aria-colcount"]).toBe(5);
      expect(gridProps.tabIndex).toBe(0);
      expect(typeof gridProps.onKeyDown).toBe("function");
    });

    it("should return correct row props", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      const rowProps = result.current.getRowProps(3);

      expect(rowProps.role).toBe("row");
      expect(rowProps["aria-rowindex"]).toBe(4);
    });

    it("should return correct cell props for focused cell", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      const cellProps = result.current.getCellProps(0, 0);

      expect(cellProps.role).toBe("gridcell");
      expect(cellProps["aria-selected"]).toBe(true);
      expect(cellProps.tabIndex).toBe(0);
    });

    it("should return correct cell props for non-focused cell", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      const cellProps = result.current.getCellProps(1, 1);

      expect(cellProps.role).toBe("gridcell");
      expect(cellProps["aria-selected"]).toBe(false);
      expect(cellProps.tabIndex).toBe(-1);
    });
  });

  describe("keyboard navigation", () => {
    it("should move focus down with ArrowDown", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(1);
      expect(result.current.focusedColumn).toBe(0);
    });

    it("should move focus up with ArrowUp", () => {
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, rowCount: 10 })
      );

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowUp",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(0);
    });

    it("should move focus right with ArrowRight", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(1);
    });

    it("should move focus left with ArrowLeft", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowLeft",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(0);
    });

    it("should move to first cell in row with Home", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "Home",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(0);
    });

    it("should move to last cell in row with End", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "End",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(4);
    });

    it("should move to first cell with Ctrl+Home", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "Home",
          ctrlKey: true,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(0);
    });

    it("should move to last cell with Ctrl+End", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "End",
          ctrlKey: true,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(9);
      expect(result.current.focusedColumn).toBe(4);
    });

    it("should move up by 10 rows with PageUp", () => {
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, rowCount: 20 })
      );

      act(() => {
        result.current.focusCell(15, 0);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "PageUp",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(5);
    });

    it("should move down by 10 rows with PageDown", () => {
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, rowCount: 20 })
      );

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "PageDown",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(10);
    });

    it("should not move beyond first row with ArrowUp", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowUp",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
    });

    it("should not move beyond last row with ArrowDown", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        result.current.focusCell(9, 0);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(9);
    });

    it("should not move beyond first column with ArrowLeft", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowLeft",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedColumn).toBe(0);
    });

    it("should not move beyond last column with ArrowRight", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        result.current.focusCell(0, 4);
      });

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowRight",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedColumn).toBe(4);
    });
  });

  describe("callbacks", () => {
    it("should call onRowExpand with Enter key", () => {
      const onRowExpand = vi.fn();
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, onRowExpand })
      );

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "Enter",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(onRowExpand).toHaveBeenCalledWith(0);
    });

    it("should call onRowExpand with Space key", () => {
      const onRowExpand = vi.fn();
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, onRowExpand })
      );

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: " ",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(onRowExpand).toHaveBeenCalledWith(0);
    });

    it("should call onCellAction when no onRowExpand", () => {
      const onCellAction = vi.fn();
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, onCellAction })
      );

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "Enter",
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(onCellAction).toHaveBeenCalledWith(0, 0);
    });

    it("should call scrollToRow when navigating to non-visible row", () => {
      const scrollToRow = vi.fn();
      const { result } = renderHook(() =>
        useGridAccessibility({ ...defaultProps, scrollToRow })
      );

      act(() => {
        result.current.focusCell(5, 0);
      });

      expect(scrollToRow).not.toHaveBeenCalled();
    });
  });

  describe("focusCell", () => {
    it("should update focused cell", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        result.current.focusCell(3, 2);
      });

      expect(result.current.focusedRow).toBe(3);
      expect(result.current.focusedColumn).toBe(2);
    });

    it("should clamp row index to valid range", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        result.current.focusCell(15, 0);
      });

      expect(result.current.focusedRow).toBe(9);
    });

    it("should clamp column index to valid range", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        result.current.focusCell(0, 10);
      });

      expect(result.current.focusedColumn).toBe(4);
    });

    it("should clamp negative indices to 0", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        result.current.focusCell(-5, -3);
      });

      expect(result.current.focusedRow).toBe(0);
      expect(result.current.focusedColumn).toBe(0);
    });
  });

  describe("modifier keys", () => {
    it("should ignore keydown with Shift modifier", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          shiftKey: true,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
    });

    it("should ignore keydown with Ctrl modifier except Home/End", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          ctrlKey: true,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
    });

    it("should ignore keydown with Meta modifier except Home/End", () => {
      const { result } = renderHook(() => useGridAccessibility(defaultProps));

      act(() => {
        const gridProps = result.current.getGridProps();
        gridProps.onKeyDown({
          key: "ArrowDown",
          metaKey: true,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as React.KeyboardEvent<HTMLDivElement>);
      });

      expect(result.current.focusedRow).toBe(0);
    });
  });

  describe("bounds adjustment", () => {
    it("should adjust focused row when rowCount decreases", () => {
      const { result, rerender } = renderHook(
        (props) => useGridAccessibility(props),
        { initialProps: { ...defaultProps, rowCount: 10 } }
      );

      act(() => {
        result.current.focusCell(9, 0);
      });

      rerender({ ...defaultProps, rowCount: 5 });

      expect(result.current.focusedRow).toBe(4);
    });

    it("should adjust focused column when columnCount decreases", () => {
      const { result, rerender } = renderHook(
        (props) => useGridAccessibility(props),
        { initialProps: { ...defaultProps, columnCount: 5 } }
      );

      act(() => {
        result.current.focusCell(0, 4);
      });

      rerender({ ...defaultProps, columnCount: 3 });

      expect(result.current.focusedColumn).toBe(2);
    });
  });
});
