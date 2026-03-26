/**
 * Cache Warming Module
 *
 * Provides automatic cache warming for frequently accessed queries
 * to improve cache hit rates and reduce query latency.
 */

import type { QueryCache, CachedQueryResult } from "./query-cache";

export type WarmingStrategy = "time-based" | "usage-based" | "recent-based" | "priority-based";
export type WarmingSchedule = "startup" | "periodic" | "on-demand";
export type WarmingPriority = "most-frequent" | "most-recent" | "high-priority";

export interface CacheWarmingConfig {
  /** Enable/disable cache warming */
  enabled: boolean;
  /** Warming strategy */
  strategy: WarmingStrategy;
  /** Warming schedule */
  schedule: WarmingSchedule;
  /** Number of queries to warm on startup */
  startupCount: number;
  /** Periodic warming interval in milliseconds (default: 5 minutes) */
  periodicInterval: number;
  /** Number of queries to warm per periodic cycle */
  periodicCount: number;
  /** Batch size for warming (queries per batch) */
  batchSize: number;
  /** Priority mode */
  priority: WarmingPriority;
  /** High priority query keys (always warm first) */
  highPriorityKeys: string[];
}

export interface WarmingProgress {
  /** Total number of queries to warm */
  total: number;
  /** Number of queries warmed so far */
  completed: number;
  /** Current percentage complete */
  percentage: number;
  /** Whether warming is in progress */
  isWarming: boolean;
  /** Current batch index */
  currentBatch: number;
  /** Total batches */
  totalBatches: number;
}

export interface WarmingStats {
  /** Total number of warming cycles completed */
  warmingCycles: number;
  /** Total number of queries warmed */
  queriesWarmed: number;
  /** Number of successful warm operations */
  warmingSuccesses: number;
  /** Number of failed warm operations */
  warmingFailures: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total time spent warming (ms) */
  totalWarmingTime: number;
  /** Average warming time per cycle (ms) */
  averageWarmingTime: number;
  /** Cache hit rate before warming */
  hitRateBefore: number;
  /** Cache hit rate after warming */
  hitRateAfter: number;
  /** Hit rate improvement (0-1) */
  hitRateImprovement: number;
  /** Last warming timestamp */
  lastWarmingTime: number | null;
}

export interface WarmableQuery {
  key: string;
  priority: number;
  lastAccessed: number;
  accessCount: number;
}

export interface WarmingResult {
  success: boolean;
  queriesWarmed: number;
  queriesFailed: number;
  duration: number;
  error?: string;
}

const DEFAULT_CONFIG: CacheWarmingConfig = {
  enabled: true,
  strategy: "usage-based",
  schedule: "startup",
  startupCount: 50,
  periodicInterval: 300_000, // 5 minutes
  periodicCount: 20,
  batchSize: 10,
  priority: "most-frequent",
  highPriorityKeys: [],
};

/**
 * Cache Warming Manager
 */
export class CacheWarmer {
  private cache: QueryCache;
  private config: CacheWarmingConfig;
  private progress: WarmingProgress;
  private stats: WarmingStats;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;
  private warmingFn: ((key: string) => Promise<unknown>) | null = null;
  private accessLog: Map<string, WarmableQuery> = new Map();

  constructor(
    cache: QueryCache,
    config: Partial<CacheWarmingConfig> = {},
    warmingFn?: (key: string) => Promise<unknown>
  ) {
    this.cache = cache;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.warmingFn = warmingFn ?? null;

    this.progress = {
      total: 0,
      completed: 0,
      percentage: 0,
      isWarming: false,
      currentBatch: 0,
      totalBatches: 0,
    };

    this.stats = {
      warmingCycles: 0,
      queriesWarmed: 0,
      warmingSuccesses: 0,
      warmingFailures: 0,
      successRate: 0,
      totalWarmingTime: 0,
      averageWarmingTime: 0,
      hitRateBefore: 0,
      hitRateAfter: 0,
      hitRateImprovement: 0,
      lastWarmingTime: null,
    };
  }

  /**
   * Set the warming function (for actually executing queries)
   */
  setWarmingFn(fn: (key: string) => Promise<unknown>): void {
    this.warmingFn = fn;
  }

  /**
   * Record query access for tracking
   */
  recordAccess(key: string): void {
    const existing = this.accessLog.get(key);
    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = Date.now();
      existing.priority = this.calculatePriority(existing);
    } else {
      this.accessLog.set(key, {
        key,
        priority: 1,
        lastAccessed: Date.now(),
        accessCount: 1,
      });
    }
  }

  /**
   * Calculate priority based on config
   */
  private calculatePriority(query: WarmableQuery): number {
    switch (this.config.priority) {
      case "most-frequent":
        return query.accessCount;
      case "most-recent":
        return query.lastAccessed;
      case "high-priority":
        return query.accessCount * 2;
      default:
        return query.accessCount;
    }
  }

  /**
   * Get sorted queries based on strategy and priority
   */
  getSortedQueries(limit: number): WarmableQuery[] {
    const queries = Array.from(this.accessLog.values());

    switch (this.config.strategy) {
      case "usage-based":
        return queries.sort((a, b) => b.accessCount - a.accessCount).slice(0, limit);
      case "recent-based":
        return queries.sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, limit);
      case "priority-based":
        return queries.sort((a, b) => b.priority - a.priority).slice(0, limit);
      case "time-based":
      default:
        return queries.sort((a, b) => b.priority - a.priority).slice(0, limit);
    }
  }

  /**
   * Get queries sorted by priority with high-priority keys first
   */
  getPriorityQueries(limit: number): string[] {
    const highPriority = this.config.highPriorityKeys.filter((key) =>
      this.accessLog.has(key)
    );
    const remainingCount = Math.max(0, limit - highPriority.length);
    const sortedQueries = this.getSortedQueries(remainingCount);
    const regularKeys = sortedQueries.map((q) => q.key);

    return [...highPriority, ...regularKeys].slice(0, limit);
  }

  /**
   * Warm cache for a specific key
   */
  async warmKey(key: string): Promise<boolean> {
    // Skip if already in cache
    if (this.cache.hasQuery(key)) {
      return true;
    }

    // Skip if no warming function
    if (!this.warmingFn) {
      console.warn(`[CacheWarmer] No warming function set, skipping key: ${key}`);
      return false;
    }

    try {
      const result = await this.warmingFn(key);
      this.cache.setCachedQuery(key, result as object);
      return true;
    } catch (error) {
      console.error(`[CacheWarmer] Failed to warm key ${key}:`, error);
      return false;
    }
  }

  /**
   * Warm multiple keys with progress tracking
   */
  async warmKeys(keys: string[]): Promise<WarmingResult> {
    const startTime = Date.now();
    let queriesWarmed = 0;
    let queriesFailed = 0;

    this.progress.total = keys.length;
    this.progress.completed = 0;
    this.progress.isWarming = true;
    this.progress.currentBatch = 0;
    this.progress.totalBatches = Math.ceil(keys.length / this.config.batchSize);

    for (let i = 0; i < keys.length; i += this.config.batchSize) {
      const batch = keys.slice(i, i + this.config.batchSize);
      this.progress.currentBatch = Math.floor(i / this.config.batchSize) + 1;

      const batchResults = await Promise.all(
        batch.map(async (key) => {
          const success = await this.warmKey(key);
          if (success) {
            queriesWarmed++;
          } else {
            queriesFailed++;
          }
          this.progress.completed++;
          this.progress.percentage = Math.round(
            (this.progress.completed / this.progress.total) * 100
          );
          return success;
        })
      );

      // Log progress
      console.log(
        `[CacheWarmer] Batch ${this.progress.currentBatch}/${this.progress.totalBatches} complete: ${batchResults.filter(Boolean).length}/${batch.length} succeeded`
      );
    }

    this.progress.isWarming = false;
    const duration = Date.now() - startTime;

    const totalOps = queriesWarmed + queriesFailed;
    const cycleSuccessRate = totalOps > 0 ? queriesWarmed / totalOps : 0;

    // Update stats
    this.stats.warmingCycles++;
    this.stats.queriesWarmed += queriesWarmed;
    this.stats.warmingSuccesses += queriesWarmed;
    this.stats.warmingFailures += queriesFailed;
    this.stats.successRate = cycleSuccessRate;
    this.stats.totalWarmingTime += duration;
    this.stats.averageWarmingTime =
      this.stats.totalWarmingTime / this.stats.warmingCycles;
    this.stats.lastWarmingTime = Date.now();

    return {
      success: queriesFailed === 0,
      queriesWarmed,
      queriesFailed,
      duration,
    };
  }

  /**
   * Perform startup warming
   */
  async warmStartup(): Promise<WarmingResult> {
    if (!this.config.enabled || this.config.schedule !== "startup") {
      return { success: true, queriesWarmed: 0, queriesFailed: 0, duration: 0 };
    }

    console.log(`[CacheWarmer] Starting startup warming for ${this.config.startupCount} queries...`);
    const hitRateBefore = this.cache.getStats().hitRate;
    this.stats.hitRateBefore = hitRateBefore;

    const queries = this.getPriorityQueries(this.config.startupCount);
    const result = await this.warmKeys(queries);

    const hitRateAfter = this.cache.getStats().hitRate;
    this.stats.hitRateAfter = hitRateAfter;
    this.stats.hitRateImprovement = hitRateAfter - hitRateBefore;

    console.log(
      `[CacheWarmer] Startup warming complete: ${result.queriesWarmed} queries warmed in ${result.duration}ms`
    );

    return result;
  }

  /**
   * Start periodic warming
   */
  startPeriodicWarming(): void {
    if (!this.config.enabled || this.config.schedule !== "periodic") {
      return;
    }

    if (this.periodicTimer) {
      console.warn(`[CacheWarmer] Periodic warming already running`);
      return;
    }

    console.log(
      `[CacheWarmer] Starting periodic warming every ${this.config.periodicInterval}ms`
    );

    // Run immediately
    this.warmPeriodic();

    // Then schedule
    this.periodicTimer = setInterval(() => {
      this.warmPeriodic();
    }, this.config.periodicInterval);
  }

  /**
   * Stop periodic warming
   */
  stopPeriodicWarming(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
      console.log(`[CacheWarmer] Periodic warming stopped`);
    }
  }

  /**
   * Perform periodic warming
   */
  async warmPeriodic(): Promise<WarmingResult> {
    if (!this.config.enabled || this.config.schedule !== "periodic") {
      return { success: true, queriesWarmed: 0, queriesFailed: 0, duration: 0 };
    }

    console.log(
      `[CacheWarmer] Starting periodic warming for ${this.config.periodicCount} queries...`
    );
    const hitRateBefore = this.cache.getStats().hitRate;
    this.stats.hitRateBefore = hitRateBefore;

    const queries = this.getPriorityQueries(this.config.periodicCount);
    const result = await this.warmKeys(queries);

    const hitRateAfter = this.cache.getStats().hitRate;
    this.stats.hitRateAfter = hitRateAfter;
    this.stats.hitRateImprovement = hitRateAfter - hitRateBefore;

    console.log(
      `[CacheWarmer] Periodic warming complete: ${result.queriesWarmed} queries warmed in ${result.duration}ms`
    );

    return result;
  }

  /**
   * Trigger on-demand warming
   */
  async warmOnDemand(count?: number): Promise<WarmingResult> {
    if (!this.config.enabled) {
      return { success: true, queriesWarmed: 0, queriesFailed: 0, duration: 0 };
    }

    const warmCount = count ?? this.config.startupCount;
    console.log(`[CacheWarmer] Starting on-demand warming for ${warmCount} queries...`);

    const hitRateBefore = this.cache.getStats().hitRate;
    this.stats.hitRateBefore = hitRateBefore;

    const queries = this.getPriorityQueries(warmCount);
    const result = await this.warmKeys(queries);

    const hitRateAfter = this.cache.getStats().hitRate;
    this.stats.hitRateAfter = hitRateAfter;
    this.stats.hitRateImprovement = hitRateAfter - hitRateBefore;

    console.log(
      `[CacheWarmer] On-demand warming complete: ${result.queriesWarmed} queries warmed in ${result.duration}ms`
    );

    return result;
  }

  /**
   * Get current warming progress
   */
  getProgress(): WarmingProgress {
    return { ...this.progress };
  }

  /**
   * Get warming statistics
   */
  getStats(): WarmingStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheWarmingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheWarmingConfig {
    return { ...this.config };
  }

  /**
   * Check if warming is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable warming
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable warming
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Clear warming stats
   */
  clearStats(): void {
    this.stats = {
      warmingCycles: 0,
      queriesWarmed: 0,
      warmingSuccesses: 0,
      warmingFailures: 0,
      successRate: 0,
      totalWarmingTime: 0,
      averageWarmingTime: 0,
      hitRateBefore: 0,
      hitRateAfter: 0,
      hitRateImprovement: 0,
      lastWarmingTime: null,
    };
  }

  /**
   * Clear access log
   */
  clearAccessLog(): void {
    this.accessLog.clear();
  }

  /**
   * Add query to access log (for external tracking)
   */
  addQueryToAccessLog(key: string, accessCount: number = 1, lastAccessed?: number): void {
    const now = Date.now();
    const existing = this.accessLog.get(key);

    if (existing) {
      existing.accessCount += accessCount;
      existing.lastAccessed = lastAccessed ?? now;
      existing.priority = this.calculatePriority(existing);
    } else {
      this.accessLog.set(key, {
        key,
        priority: accessCount,
        lastAccessed: lastAccessed ?? now,
        accessCount,
      });
    }
  }

  /**
   * Get access log entries
   */
  getAccessLog(): WarmableQuery[] {
    return Array.from(this.accessLog.values());
  }

  /**
   * Destroy the warmer (cleanup)
   */
  destroy(): void {
    this.stopPeriodicWarming();
    this.clearStats();
    this.clearAccessLog();
  }
}

/**
 * Create a cache warmer with default configuration
 */
export function createCacheWarmer(
  cache: QueryCache,
  config?: Partial<CacheWarmingConfig>,
  warmingFn?: (key: string) => Promise<unknown>
): CacheWarmer {
  return new CacheWarmer(cache, config, warmingFn);
}