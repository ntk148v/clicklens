"use client";

import { useCallback, useRef, useState, useEffect, type KeyboardEvent } from "react";

export interface GridAccessibilityOptions {
  rowCount: number;
  columnCount: number;
  onCellAction?: (rowIndex: number, columnIndex: number) => void;
  onRowExpand?: (rowIndex: number) => void;
  scrollToRow?: (rowIndex: number) => void;
}

export interface GridAccessibilityState {
  focusedRow: number;
  focusedColumn: number;
  getGridProps: () => {
    role: "grid";
    "aria-rowcount": number;
    "aria-colcount": number;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
    tabIndex: number;
  };
  getRowProps: (rowIndex: number) => {
    role: "row";
    "aria-rowindex": number;
  };
  getCellProps: (rowIndex: number, columnIndex: number) => {
    role: "gridcell";
    "aria-selected": boolean;
    tabIndex: number;
    ref: (el: HTMLTableCellElement | null) => void;
  };
  focusCell: (rowIndex: number, columnIndex: number) => void;
}

export function useGridAccessibility({
  rowCount,
  columnCount,
  onCellAction,
  onRowExpand,
  scrollToRow,
}: GridAccessibilityOptions): GridAccessibilityState {
  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedColumn, setFocusedColumn] = useState(0);
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const focusCell = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const clampedRow = Math.max(0, Math.min(rowIndex, rowCount - 1));
      const clampedCol = Math.max(0, Math.min(columnIndex, columnCount - 1));

      setFocusedRow(clampedRow);
      setFocusedColumn(clampedCol);

      if (scrollToRow && clampedRow !== rowIndex) {
        scrollToRow(clampedRow);
      }

      const cellKey = getCellKey(clampedRow, clampedCol);
      const cellElement = cellRefs.current.get(cellKey);
      if (cellElement) {
        cellElement.focus();
      }
    },
    [rowCount, columnCount, scrollToRow]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const { key, ctrlKey, metaKey, shiftKey } = e;

      if ((ctrlKey || metaKey) && !["Home", "End"].includes(key)) {
        return;
      }
      if (shiftKey) {
        return;
      }

      let newRow = focusedRow;
      let newCol = focusedColumn;
      let handled = false;

      switch (key) {
        case "ArrowUp":
          newRow = Math.max(0, focusedRow - 1);
          handled = true;
          break;

        case "ArrowDown":
          newRow = Math.min(rowCount - 1, focusedRow + 1);
          handled = true;
          break;

        case "ArrowLeft":
          newCol = Math.max(0, focusedColumn - 1);
          handled = true;
          break;

        case "ArrowRight":
          newCol = Math.min(columnCount - 1, focusedColumn + 1);
          handled = true;
          break;

        case "Home":
          if (ctrlKey || metaKey) {
            newRow = 0;
            newCol = 0;
          } else {
            newCol = 0;
          }
          handled = true;
          break;

        case "End":
          if (ctrlKey || metaKey) {
            newRow = rowCount - 1;
            newCol = columnCount - 1;
          } else {
            newCol = columnCount - 1;
          }
          handled = true;
          break;

        case "PageUp":
          newRow = Math.max(0, focusedRow - 10);
          handled = true;
          break;

        case "PageDown":
          newRow = Math.min(rowCount - 1, focusedRow + 10);
          handled = true;
          break;

        case "Enter":
        case " ":
          if (onRowExpand) {
            onRowExpand(focusedRow);
          } else if (onCellAction) {
            onCellAction(focusedRow, focusedColumn);
          }
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();

        if (newRow !== focusedRow || newCol !== focusedColumn) {
          focusCell(newRow, newCol);
        }
      }
    },
    [
      focusedRow,
      focusedColumn,
      rowCount,
      columnCount,
      focusCell,
      onCellAction,
      onRowExpand,
    ]
  );

  const getGridProps = useCallback(
    () => ({
      role: "grid" as const,
      "aria-rowcount": rowCount,
      "aria-colcount": columnCount,
      onKeyDown: handleKeyDown,
      tabIndex: 0,
    }),
    [rowCount, columnCount, handleKeyDown]
  );

  const getRowProps = useCallback(
    (rowIndex: number) => ({
      role: "row" as const,
      "aria-rowindex": rowIndex + 1,
    }),
    []
  );

  const getCellProps = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const cellKey = getCellKey(rowIndex, columnIndex);
      const isFocused = rowIndex === focusedRow && columnIndex === focusedColumn;

      return {
        role: "gridcell" as const,
        "aria-selected": isFocused,
        tabIndex: isFocused ? 0 : -1,
        ref: (el: HTMLTableCellElement | null) => {
          if (el) {
            cellRefs.current.set(cellKey, el);
          } else {
            cellRefs.current.delete(cellKey);
          }
        },
      };
    },
    [focusedRow, focusedColumn]
  );

  useEffect(() => {
    if (focusedRow >= rowCount) {
      setFocusedRow(Math.max(0, rowCount - 1));
    }
    if (focusedColumn >= columnCount) {
      setFocusedColumn(Math.max(0, columnCount - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowCount, columnCount]);

  return {
    focusedRow,
    focusedColumn,
    getGridProps,
    getRowProps,
    getCellProps,
    focusCell,
  };
}

export function mergeAriaProps<T extends Record<string, unknown>>(
  existing: T,
  aria: Record<string, unknown>
): T & Record<string, unknown> {
  return { ...existing, ...aria };
}
