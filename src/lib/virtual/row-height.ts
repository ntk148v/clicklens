/**
 * Row height measurement utilities for virtualization.
 *
 * Based on analysis of ResultGrid and DiscoverGrid components:
 * - TableCell uses `p-2` (8px padding on each side)
 * - Content typically single line with ~1.5rem line-height
 * - ch-ui reference uses 34px as baseline
 *
 * @see https://github.com/caioricciuti/ch-ui/blob/main/ui/src/lib/components/table/VirtualTable.svelte
 */

import { DEFAULT_ROW_HEIGHT } from "./virtual.config";

/**
 * CSS pixel values for common height utilities in Tailwind
 */
export const TAILWIND_ROW_HEIGHTS = {
  /** h-8 = 32px */
  H8: 32,
  /** h-9 = 36px */
  H9: 36,
  /** h-10 = 40px */
  H10: 40,
} as const;

/**
 * Row height sources for documentation
 */
export const ROW_HEIGHT_SOURCES = {
  /** ch-ui library baseline */
  CH_UI: 34,
  /** Current default in virtual.config.ts */
  DEFAULT: DEFAULT_ROW_HEIGHT,
  /** ResultGrid cell padding (p-2 = 8px × 2 = 16px) + content ≈ 34px */
  RESULT_GRID: 34,
  /** DiscoverGrid cell padding (p-2 = 8px × 2 = 16px) + content ≈ 34px */
  DISCOVER_GRID: 34,
} as const;

/**
 * Measure actual row height from a DOM element
 * Useful for runtime measurement and validation
 */
export function measureRowHeight(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return Math.round(rect.height);
}

/**
 * Measure row height from table rows in a container
 * Returns array of measured heights
 */
export function measureTableRows(
  container: HTMLElement
): number[] {
  const rows = container.querySelectorAll("tbody tr");
  return Array.from(rows).map((row) => measureRowHeight(row as HTMLElement));
}

/**
 * Calculate average row height from measurements
 */
export function calculateAverageRowHeight(heights: number[]): number {
  if (heights.length === 0) return DEFAULT_ROW_HEIGHT;
  const sum = heights.reduce((acc, h) => acc + h, 0);
  return Math.round(sum / heights.length);
}

/**
 * Validate that row heights are consistent (fixed height)
 * Returns true if all heights are within tolerance of target
 */
export function validateFixedRowHeight(
  heights: number[],
  target: number,
  tolerance: number = 2
): boolean {
  if (heights.length === 0) return false;
  return heights.every((h) => Math.abs(h - target) <= tolerance);
}

/**
 * Get recommended row height based on component analysis
 * Currently returns DEFAULT_ROW_HEIGHT (34px) as optimal
 */
export function getRecommendedRowHeight(): number {
  return DEFAULT_ROW_HEIGHT;
}

/**
 * Row height configuration for virtualization
 * Using fixed height for performance (no variable row heights)
 */
export interface RowHeightConfig {
  /** Fixed row height in pixels */
  height: number;
  /** Whether variable height is supported */
  variableHeight: false;
  /** Source of the height value */
  source: "ch-ui" | "measured" | "config";
}

/**
 * Get current row height configuration
 */
export function getRowHeightConfig(): RowHeightConfig {
  return {
    height: DEFAULT_ROW_HEIGHT,
    variableHeight: false,
    source: "config",
  };
}
