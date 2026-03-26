/**
 * Edge case handling utilities for virtualized tables
 *
 * Handles:
 * - Copy-paste with virtualization
 * - Long text content truncation
 * - Special character escaping
 * - Dynamic content formatting
 * - Null/undefined values
 */

/**
 * Maximum length for cell display before truncation
 */
export const MAX_CELL_DISPLAY_LENGTH = 1000;

/**
 * Maximum length for tooltip content
 */
export const MAX_TOOLTIP_LENGTH = 5000;

/**
 * Escape HTML entities in a string
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Escape special characters for CSV output
 */
export function escapeCsvValue(value: string): string {
  // Escape double quotes by doubling them
  const escaped = value.replace(/"/g, '""');
  // Wrap in quotes if it contains special characters
  if (/[",\n\r\t]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Handle newlines and tabs in cell values for copy-paste
 */
export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\t/g, " ") // Replace tabs with spaces
    .replace(/\n/g, " ") // Replace newlines with spaces
    .replace(/\r/g, "") // Remove carriage returns
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Truncate long text with ellipsis
 */
export function truncateText(
  text: string,
  maxLength: number = MAX_CELL_DISPLAY_LENGTH
): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format cell value for display, handling all edge cases
 */
export function formatCellValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    // Handle special number cases
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }

  const str = String(value);

  // Handle very long strings
  if (str.length > MAX_CELL_DISPLAY_LENGTH) {
    return truncateText(str);
  }

  return str;
}

/**
 * Format cell value for copy-paste (full value, no truncation)
 */
export function formatCellValueForCopy(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }

  return String(value);
}

/**
 * Cell selection range for copy-paste
 */
export interface CellSelection {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/**
 * Check if a cell is within a selection range
 */
export function isCellInSelection(
  rowIndex: number,
  colIndex: number,
  selection: CellSelection | null
): boolean {
  if (!selection) return false;

  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);
  const minCol = Math.min(selection.startCol, selection.endCol);
  const maxCol = Math.max(selection.startCol, selection.endCol);

  return (
    rowIndex >= minRow &&
    rowIndex <= maxRow &&
    colIndex >= minCol &&
    colIndex <= maxCol
  );
}

/**
 * Extract selected cells data for copy-paste
 */
export function extractSelectedCells<T>(
  data: T[],
  columns: string[],
  selection: CellSelection,
  getCellValue: (row: T, column: string, columnIndex: number) => unknown
): string[][] {
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.min(
    Math.max(selection.startRow, selection.endRow),
    data.length - 1
  );
  const minCol = Math.min(selection.startCol, selection.endCol);
  const maxCol = Math.min(
    Math.max(selection.startCol, selection.endCol),
    columns.length - 1
  );

  const result: string[][] = [];

  for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
    const row = data[rowIdx];
    if (!row) continue;

    const rowData: string[] = [];
    for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
      const column = columns[colIdx];
      if (!column) continue;

      const value = getCellValue(row, column, colIdx);
      rowData.push(formatCellValueForCopy(value));
    }
    result.push(rowData);
  }

  return result;
}

/**
 * Convert selected cells to TSV (tab-separated values) for clipboard
 */
export function selectionToTsv(selection: string[][]): string {
  return selection.map((row) => row.join("\t")).join("\n");
}

/**
 * Convert selected cells to CSV
 */
export function selectionToCsv(
  selection: string[][],
  headers?: string[]
): string {
  const rows: string[] = [];

  if (headers) {
    rows.push(headers.map(escapeCsvValue).join(","));
  }

  for (const row of selection) {
    rows.push(row.map(escapeCsvValue).join(","));
  }

  return rows.join("\n");
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Handle keyboard shortcut for copy (Ctrl+C / Cmd+C)
 */
export function isCopyShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key === "c";
}

/**
 * Validate cell selection range
 */
export function validateSelection(
  selection: CellSelection,
  rowCount: number,
  colCount: number
): CellSelection {
  return {
    startRow: Math.max(0, Math.min(selection.startRow, rowCount - 1)),
    endRow: Math.max(0, Math.min(selection.endRow, rowCount - 1)),
    startCol: Math.max(0, Math.min(selection.startCol, colCount - 1)),
    endCol: Math.max(0, Math.min(selection.endCol, colCount - 1)),
  };
}

/**
 * Get selection dimensions
 */
export function getSelectionSize(selection: CellSelection): {
  rows: number;
  cols: number;
} {
  return {
    rows: Math.abs(selection.endRow - selection.startRow) + 1,
    cols: Math.abs(selection.endCol - selection.startCol) + 1,
  };
}

/**
 * Check if selection is a single cell
 */
export function isSingleCellSelection(selection: CellSelection): boolean {
  return (
    selection.startRow === selection.endRow &&
    selection.startCol === selection.endCol
  );
}

/**
 * Format content type for display
 */
export function getContentType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Handle Unicode characters in cell values
 */
export function normalizeUnicode(str: string): string {
  // Normalize to NFC form (canonical decomposition + canonical composition)
  return str.normalize("NFC");
}

/**
 * Check if a string contains RTL (right-to-left) characters
 */
export function containsRtl(text: string): boolean {
  // RTL character ranges
  const rtlRegex = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlRegex.test(text);
}

/**
 * Get text direction for a string
 */
export function getTextDirection(text: string): "ltr" | "rtl" {
  return containsRtl(text) ? "rtl" : "ltr";
}

/**
 * Safely stringify any value, handling circular references
 */
export function safeStringify(value: unknown): string {
  const seen = new WeakSet();

  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) {
          return "[Circular]";
        }
        seen.add(val);
      }
      return val;
    });
  } catch {
    return "[Unstringifiable]";
  }
}

/**
 * Cell data for virtualized rendering
 */
export interface VirtualCellData {
  value: unknown;
  displayValue: string;
  copyValue: string;
  contentType: string;
  isNull: boolean;
  isTruncated: boolean;
  direction: "ltr" | "rtl";
}

/**
 * Prepare cell data for virtualized rendering
 */
export function prepareCellData(value: unknown): VirtualCellData {
  const displayValue = formatCellValueForDisplay(value);
  const copyValue = formatCellValueForCopy(value);
  const strValue = String(value ?? "");
  const isTruncated =
    typeof value === "string" && value.length > MAX_CELL_DISPLAY_LENGTH;

  return {
    value,
    displayValue,
    copyValue,
    contentType: getContentType(value),
    isNull: value === null || value === undefined,
    isTruncated,
    direction: getTextDirection(strValue),
  };
}
