export const DEFAULT_ROW_HEIGHT = 34;
export const DEFAULT_OVERSCAN = 5;

export interface VirtualConfig {
  rowHeight: number;
  overscan: number;
}

export function createVirtualConfig(
  options?: Partial<VirtualConfig>
): VirtualConfig {
  return {
    rowHeight: options?.rowHeight ?? DEFAULT_ROW_HEIGHT,
    overscan: options?.overscan ?? DEFAULT_OVERSCAN,
  };
}

export function buildVirtualizerOptions(
  count: number,
  config: VirtualConfig
) {
  return {
    count,
    estimateSize: () => config.rowHeight,
    overscan: config.overscan,
  };
}

export const defaultVirtualConfig: VirtualConfig = createVirtualConfig();