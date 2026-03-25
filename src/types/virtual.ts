/**
 * Virtualization Configuration
 */
export interface VirtualConfig {
  rowHeight: number;
  overscan: number;
}

export type VirtualConfigOptions = Partial<VirtualConfig>;

/**
 * Virtualizer options from @tanstack/react-virtual
 */
export interface VirtualizerOptions<T> {
  count: number;
  getScrollElement: () => HTMLElement | null;
  estimateSize: (index: number) => number;
  overscan?: number;
  gap?: number;
  scrollToFn?: (
    offset: number,
    options: ScrollOptions,
    instance: Virtualizer<T>
  ) => void;
  onChange?: (instance: Virtualizer<T>) => void;
  debug?: boolean;
}

export interface ScrollOptions {
  behavior?: ScrollBehavior;
  cancelable?: boolean;
}

export interface Virtualizer<T> {
  getVirtualItems: () => VirtualItem<T>[];
  scrollToOffset: (offset: number, options?: ScrollOptions) => void;
  scrollToIndex: (index: number, options?: ScrollOptions) => void;
  measure: () => void;
  _willUpdate: () => void;
}

/**
 * Single virtualized row
 */
export interface VirtualItem<T> {
  index: number;
  start: number;
  size: number;
  data: T;
  key: string | number;
}

/**
 * Virtual range for windowed data
 */
export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  overscanStartIndex: number;
  overscanEndIndex: number;
}

/**
 * Row metrics for performance tracking
 */
export interface RowMetrics {
  totalRows: number;
  renderedRows: number;
  averageRowHeight: number;
  totalHeight: number;
  scrollPosition: number;
  visibleRange: VirtualRange;
}

/**
 * Dynamic row height configuration
 */
export interface DynamicRowHeightConfig {
  enabled: boolean;
  estimateHeight: (index: number, data: unknown) => number;
  measureRow: (element: HTMLElement, index: number) => number;
  bufferSize: number;
}

/**
 * Scroll state for virtualization
 */
export interface ScrollState {
  scrollOffset: number;
  scrollDirection: "forward" | "backward" | null;
  scrollVelocity: number;
  isScrolling: boolean;
}

/**
 * Virtual grid configuration
 */
export interface VirtualGridConfig {
  columns: number;
  columnWidth: number;
  rowHeight: number;
  overscan: number;
}

export type VirtualizerOptionsOmitCount<T> = Omit<VirtualizerOptions<T>, "count">;