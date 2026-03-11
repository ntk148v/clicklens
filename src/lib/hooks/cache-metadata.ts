export interface CacheMetadata {
  isCached: boolean;
  cacheAge: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}

export interface CacheTrackingState {
  totalHits: number;
  totalMisses: number;
  lastQueryKey: string | null;
  lastCacheTimestamp: number | null;
}

export function calculateHitRate(
  totalHits: number,
  totalMisses: number,
): number {
  const total = totalHits + totalMisses;
  if (total === 0) return 0;
  return Math.round((totalHits / total) * 100);
}

export function updateCacheMetadata(
  state: CacheTrackingState,
  queryKey: string,
  isFromCache: boolean,
): CacheMetadata {
  const now = Date.now();

  if (state.lastQueryKey !== queryKey) {
    state.lastQueryKey = queryKey;
    state.totalHits = 0;
    state.totalMisses = 0;
    state.lastCacheTimestamp = null;
  }

  if (isFromCache) {
    state.totalHits++;
  } else {
    state.totalMisses++;
    state.lastCacheTimestamp = now;
  }

  const cacheAge = state.lastCacheTimestamp ? now - state.lastCacheTimestamp : 0;

  return {
    isCached: isFromCache,
    cacheAge,
    hitRate: calculateHitRate(state.totalHits, state.totalMisses),
    totalHits: state.totalHits,
    totalMisses: state.totalMisses,
  };
}