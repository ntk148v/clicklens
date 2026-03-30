import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  CacheWarmer,
  createCacheWarmer,
  type CacheWarmingConfig,
  type WarmingStrategy,
  type WarmingSchedule,
  type WarmingPriority,
} from "../../src/lib/cache/warming";
import { createQueryCache } from "../../src/lib/cache/query-cache";

describe("CacheWarmer", () => {
  let cache: ReturnType<typeof createQueryCache>;
  let warmer: CacheWarmer;

  beforeEach(() => {
    cache = createQueryCache({ maxEntries: 50, ttl: 60000, name: "test-cache" });
  });

  afterEach(() => {
    warmer?.destroy();
  });

  describe("constructor", () => {
    it("should create with default config", () => {
      warmer = createCacheWarmer(cache);
      expect(warmer.isEnabled()).toBe(true);
      expect(warmer.getConfig().strategy).toBe("usage-based");
      expect(warmer.getConfig().schedule).toBe("startup");
    });

    it("should create with custom config", () => {
      const config: Partial<CacheWarmingConfig> = {
        enabled: false,
        strategy: "recent-based",
        schedule: "periodic",
        startupCount: 100,
      };
      warmer = createCacheWarmer(cache, config);
      expect(warmer.isEnabled()).toBe(false);
      expect(warmer.getConfig().strategy).toBe("recent-based");
      expect(warmer.getConfig().schedule).toBe("periodic");
      expect(warmer.getConfig().startupCount).toBe(100);
    });
  });

  describe("enable/disable", () => {
    it("should enable warming", () => {
      warmer = createCacheWarmer(cache, { enabled: false });
      expect(warmer.isEnabled()).toBe(false);
      warmer.enable();
      expect(warmer.isEnabled()).toBe(true);
    });

    it("should disable warming", () => {
      warmer = createCacheWarmer(cache, { enabled: true });
      expect(warmer.isEnabled()).toBe(true);
      warmer.disable();
      expect(warmer.isEnabled()).toBe(false);
    });
  });

  describe("access log", () => {
    it("should record access", () => {
      warmer = createCacheWarmer(cache);
      warmer.recordAccess("key1");
      warmer.recordAccess("key1");
      warmer.recordAccess("key2");

      const log = warmer.getAccessLog();
      expect(log.length).toBe(2);
      const key1Log = log.find((q) => q.key === "key1");
      expect(key1Log?.accessCount).toBe(2);
    });

    it("should add query to access log manually", () => {
      warmer = createCacheWarmer(cache);
      warmer.addQueryToAccessLog("key1", 5, 1000);

      const log = warmer.getAccessLog();
      expect(log.length).toBe(1);
      expect(log[0].key).toBe("key1");
      expect(log[0].accessCount).toBe(5);
      expect(log[0].lastAccessed).toBe(1000);
    });

    it("should clear access log", () => {
      warmer = createCacheWarmer(cache);
      warmer.addQueryToAccessLog("key1", 5);
      expect(warmer.getAccessLog().length).toBe(1);

      warmer.clearAccessLog();
      expect(warmer.getAccessLog().length).toBe(0);
    });
  });

  describe("priority calculation", () => {
    it("should sort by most-frequent priority", () => {
      warmer = createCacheWarmer(cache, { priority: "most-frequent" });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.addQueryToAccessLog("key2", 5);
      warmer.addQueryToAccessLog("key3", 20);

      const sorted = warmer.getSortedQueries(10);
      expect(sorted[0].key).toBe("key3");
      expect(sorted[1].key).toBe("key1");
      expect(sorted[2].key).toBe("key2");
    });

    it("should sort by most-recent priority", () => {
      warmer = createCacheWarmer(cache, { strategy: "recent-based" });
      const now = Date.now();
      warmer.addQueryToAccessLog("key1", 1, now - 1000);
      warmer.addQueryToAccessLog("key2", 1, now - 500);
      warmer.addQueryToAccessLog("key3", 1, now);

      const sorted = warmer.getSortedQueries(10);
      expect(sorted[0].key).toBe("key3");
      expect(sorted[1].key).toBe("key2");
      expect(sorted[2].key).toBe("key1");
    });

    it("should get priority queries with high-priority keys first", () => {
      warmer = createCacheWarmer(cache, {
        priority: "most-frequent",
        highPriorityKeys: ["key1", "key2"],
      });
      warmer.addQueryToAccessLog("key1", 1);
      warmer.addQueryToAccessLog("key2", 1);
      warmer.addQueryToAccessLog("key3", 100);
      warmer.addQueryToAccessLog("key4", 50);

      const queries = warmer.getPriorityQueries(4);
      expect(queries[0]).toBe("key1");
      expect(queries[1]).toBe("key2");
      expect(queries.slice(2)).toContain("key3");
      expect(queries.slice(2)).toContain("key4");
    });
  });

  describe("strategy sorting", () => {
    it("should sort by usage-based strategy", () => {
      warmer = createCacheWarmer(cache, { strategy: "usage-based" });
      warmer.addQueryToAccessLog("key1", 5);
      warmer.addQueryToAccessLog("key2", 10);
      warmer.addQueryToAccessLog("key3", 3);

      const sorted = warmer.getSortedQueries(3);
      expect(sorted[0].key).toBe("key2");
      expect(sorted[1].key).toBe("key1");
      expect(sorted[2].key).toBe("key3");
    });

    it("should sort by recent-based strategy", () => {
      warmer = createCacheWarmer(cache, { strategy: "recent-based" });
      const now = Date.now();
      warmer.addQueryToAccessLog("key1", 1, now - 3000);
      warmer.addQueryToAccessLog("key2", 1, now - 1000);
      warmer.addQueryToAccessLog("key3", 1, now - 2000);

      const sorted = warmer.getSortedQueries(3);
      expect(sorted[0].key).toBe("key2");
      expect(sorted[1].key).toBe("key3");
      expect(sorted[2].key).toBe("key1");
    });

    it("should sort by priority-based strategy", () => {
      warmer = createCacheWarmer(cache, { strategy: "priority-based" });
      warmer.addQueryToAccessLog("key1", 5);
      warmer.addQueryToAccessLog("key2", 10);
      warmer.addQueryToAccessLog("key3", 3);

      const sorted = warmer.getSortedQueries(3);
      expect(sorted[0].key).toBe("key2");
      expect(sorted[1].key).toBe("key1");
      expect(sorted[2].key).toBe("key3");
    });
  });

  describe("warmKey", () => {
    it("should skip if key already in cache", async () => {
      warmer = createCacheWarmer(cache);
      cache.setCachedQuery("existing-key", { data: "test" });

      const result = await warmer.warmKey("existing-key");
      expect(result).toBe(true);
    });

    it("should return false if no warming function", async () => {
      warmer = createCacheWarmer(cache);
      const result = await warmer.warmKey("new-key");
      expect(result).toBe(false);
    });

    it("should warm key with warming function", async () => {
      warmer = createCacheWarmer(cache, {}, async (key) => ({
        result: `warmed-${key}`,
      }));
      warmer.setWarmingFn(async (key) => ({ result: `warmed-${key}` }));

      const result = await warmer.warmKey("new-key");
      expect(result).toBe(true);

      const cached = cache.getCachedQuery("new-key");
      expect(cached?.data).toEqual({ result: "warmed-new-key" });
    });

    it("should handle warming errors gracefully", async () => {
      warmer = createCacheWarmer(cache);
      warmer.setWarmingFn(async () => {
        throw new Error("Query failed");
      });

      const result = await warmer.warmKey("error-key");
      expect(result).toBe(false);
    });
  });

  describe("warmKeys (batch)", () => {
    it("should warm multiple keys with progress tracking", async () => {
      warmer = createCacheWarmer(cache, { batchSize: 2 });
      warmer.setWarmingFn(async (key) => ({ result: key }));

      const keys = ["key1", "key2", "key3", "key4"];
      const result = await warmer.warmKeys(keys);

      expect(result.queriesWarmed).toBe(4);
      expect(result.queriesFailed).toBe(0);
      expect(result.success).toBe(true);
      expect(warmer.getProgress().total).toBe(4);
      expect(warmer.getProgress().completed).toBe(4);
      expect(warmer.getProgress().percentage).toBe(100);
    });

    it("should handle partial failures", async () => {
      let callCount = 0;
      warmer = createCacheWarmer(cache, { batchSize: 2 });
      warmer.setWarmingFn(async (key) => {
        callCount++;
        if (key === "key2") {
          throw new Error("Failed");
        }
        return { result: key };
      });

      const keys = ["key1", "key2", "key3"];
      const result = await warmer.warmKeys(keys);

      expect(result.queriesWarmed).toBe(2);
      expect(result.queriesFailed).toBe(1);
      expect(result.success).toBe(false);
    });

    it("should track progress correctly", async () => {
      warmer = createCacheWarmer(cache, { batchSize: 2 });
      warmer.setWarmingFn(async (key) => ({ result: key }));

      const keys = ["key1", "key2", "key3"];
      await warmer.warmKeys(keys);

      const progress = warmer.getProgress();
      expect(progress.isWarming).toBe(false);
      expect(progress.currentBatch).toBe(2);
      expect(progress.totalBatches).toBe(2);
    });
  });

  describe("warmStartup", () => {
    it("should skip when disabled", async () => {
      warmer = createCacheWarmer(cache, { enabled: false });
      const result = await warmer.warmStartup();
      expect(result.queriesWarmed).toBe(0);
    });

    it("should skip when schedule is not startup", async () => {
      warmer = createCacheWarmer(cache, { schedule: "periodic" });
      const result = await warmer.warmStartup();
      expect(result.queriesWarmed).toBe(0);
    });

    it("should warm startup queries", async () => {
      warmer = createCacheWarmer(cache, {
        schedule: "startup",
        startupCount: 3,
      });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.addQueryToAccessLog("key2", 5);
      warmer.addQueryToAccessLog("key3", 1);

      warmer.setWarmingFn(async (key) => ({ result: key }));

      const result = await warmer.warmStartup();
      expect(result.queriesWarmed).toBe(3);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("warmPeriodic", () => {
    it("should skip when disabled", async () => {
      warmer = createCacheWarmer(cache, { enabled: false });
      const result = await warmer.warmPeriodic();
      expect(result.queriesWarmed).toBe(0);
    });

    it("should skip when schedule is not periodic", async () => {
      warmer = createCacheWarmer(cache, { schedule: "startup" });
      const result = await warmer.warmPeriodic();
      expect(result.queriesWarmed).toBe(0);
    });

    it("should warm periodic queries", async () => {
      warmer = createCacheWarmer(cache, {
        schedule: "periodic",
        periodicCount: 2,
      });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.addQueryToAccessLog("key2", 5);
      warmer.addQueryToAccessLog("key3", 1);

      warmer.setWarmingFn(async (key) => ({ result: key }));

      const result = await warmer.warmPeriodic();
      expect(result.queriesWarmed).toBe(2);
    });
  });

  describe("warmOnDemand", () => {
    it("should skip when disabled", async () => {
      warmer = createCacheWarmer(cache, { enabled: false });
      const result = await warmer.warmOnDemand();
      expect(result.queriesWarmed).toBe(0);
    });

    it("should warm specified number of queries", async () => {
      warmer = createCacheWarmer(cache);
      warmer.addQueryToAccessLog("key1", 10);
      warmer.addQueryToAccessLog("key2", 5);
      warmer.addQueryToAccessLog("key3", 1);

      warmer.setWarmingFn(async (key) => ({ result: key }));

      const result = await warmer.warmOnDemand(2);
      expect(result.queriesWarmed).toBe(2);
    });

    it("should use default count when not specified", async () => {
      warmer = createCacheWarmer(cache, { startupCount: 3 });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.addQueryToAccessLog("key2", 5);
      warmer.addQueryToAccessLog("key3", 1);

      warmer.setWarmingFn(async (key) => ({ result: key }));

      const result = await warmer.warmOnDemand();
      expect(result.queriesWarmed).toBe(3);
    });
  });

  describe("periodic warming timer", () => {
    it("should start periodic warming", () => {
      warmer = createCacheWarmer(cache, {
        schedule: "periodic",
        periodicInterval: 100,
        periodicCount: 1,
      });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.setWarmingFn(async (key) => ({ result: key }));

      warmer.startPeriodicWarming();

      expect(warmer.getProgress().isWarming).toBe(true);

      warmer.stopPeriodicWarming();
    });

    it("should not start if already running", () => {
      warmer = createCacheWarmer(cache, {
        schedule: "periodic",
        periodicInterval: 100,
      });

      warmer.startPeriodicWarming();
      warmer.startPeriodicWarming();

      warmer.stopPeriodicWarming();
    });

    it("should stop periodic warming", () => {
      warmer = createCacheWarmer(cache, {
        schedule: "periodic",
        periodicInterval: 50,
      });

      warmer.startPeriodicWarming();
      warmer.stopPeriodicWarming();

      const stats = warmer.getStats();
      expect(stats.warmingCycles).toBeGreaterThan(0);
    });
  });

  describe("statistics", () => {
    it("should track warming stats", async () => {
      warmer = createCacheWarmer(cache, { schedule: "on-demand" });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.setWarmingFn(async (key) => ({ result: key }));

      await warmer.warmOnDemand(1);

      const stats = warmer.getStats();
      expect(stats.warmingCycles).toBe(1);
      expect(stats.queriesWarmed).toBe(1);
      expect(stats.warmingSuccesses).toBe(1);
      expect(stats.warmingFailures).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.lastWarmingTime).not.toBeNull();
    });

    it("should calculate success rate", async () => {
      warmer = createCacheWarmer(cache, { schedule: "on-demand" });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.addQueryToAccessLog("key2", 5);
      warmer.setWarmingFn((key) => {
        if (key === "key2") {
          return Promise.reject(new Error("Fail"));
        }
        return Promise.resolve({ result: key });
      });

      await warmer.warmOnDemand(2);

      const stats = warmer.getStats();
      expect(stats.warmingSuccesses).toBe(1);
      expect(stats.warmingFailures).toBe(1);
      expect(stats.successRate).toBe(0.5);
    });

    it("should track hit rate improvement", async () => {
      warmer = createCacheWarmer(cache, { schedule: "on-demand" });
      cache.setCachedQuery("key1", { data: "test" });
      cache.getCachedQuery("key1");

      const hitRateBefore = cache.getStats().hitRate;
      warmer.addQueryToAccessLog("key2", 10);
      warmer.setWarmingFn(async (key) => ({ result: key }));

      await warmer.warmOnDemand(1);

      const stats = warmer.getStats();
      expect(stats.hitRateBefore).toBe(hitRateBefore);
      expect(stats.hitRateAfter).toBeGreaterThanOrEqual(stats.hitRateBefore);
    });

    it("should clear stats", async () => {
      warmer = createCacheWarmer(cache, { schedule: "on-demand" });
      warmer.addQueryToAccessLog("key1", 10);
      warmer.setWarmingFn(async (key) => ({ result: key }));

      await warmer.warmOnDemand(1);
      expect(warmer.getStats().warmingCycles).toBe(1);

      warmer.clearStats();
      expect(warmer.getStats().warmingCycles).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should update config", () => {
      warmer = createCacheWarmer(cache, { startupCount: 10 });
      expect(warmer.getConfig().startupCount).toBe(10);

      warmer.updateConfig({ startupCount: 50 });
      expect(warmer.getConfig().startupCount).toBe(50);
    });

    it("should return config copy", () => {
      warmer = createCacheWarmer(cache);
      const config = warmer.getConfig();
      config.startupCount = 999;
      expect(warmer.getConfig().startupCount).not.toBe(999);
    });
  });

  describe("progress", () => {
    it("should return initial progress", () => {
      warmer = createCacheWarmer(cache);
      const progress = warmer.getProgress();
      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.isWarming).toBe(false);
    });

    it("should return progress copy", () => {
      warmer = createCacheWarmer(cache);
      const progress = warmer.getProgress();
      progress.completed = 100;
      expect(warmer.getProgress().completed).toBe(0);
    });
  });

  describe("destroy", () => {
    it("should cleanup on destroy", () => {
      warmer = createCacheWarmer(cache, { schedule: "periodic", periodicInterval: 50 });
      warmer.startPeriodicWarming();
      warmer.destroy();

      const progress = warmer.getProgress();
      const stats = warmer.getStats();
      const log = warmer.getAccessLog();
      expect(progress.total).toBe(0);
      expect(stats.warmingCycles).toBe(0);
      expect(log.length).toBe(0);
    });
  });
});

describe("createCacheWarmer", () => {
  it("should create warmer instance", () => {
    const cache = createQueryCache({ maxEntries: 10, ttl: 60000 });
    const warmer = createCacheWarmer(cache);
    expect(warmer).toBeInstanceOf(CacheWarmer);
    warmer.destroy();
  });

  it("should accept warming function", () => {
    const cache = createQueryCache({ maxEntries: 10, ttl: 60000 });
    const warmingFn = async (key: string) => ({ result: key });
    const warmer = createCacheWarmer(cache, {}, warmingFn);
    expect(warmer).toBeInstanceOf(CacheWarmer);
    warmer.destroy();
  });
});

describe("Type definitions", () => {
  it("should accept valid strategies", () => {
    const strategies: WarmingStrategy[] = ["time-based", "usage-based", "recent-based", "priority-based"];
    expect(strategies.length).toBe(4);
  });

  it("should accept valid schedules", () => {
    const schedules: WarmingSchedule[] = ["startup", "periodic", "on-demand"];
    expect(schedules.length).toBe(3);
  });

  it("should accept valid priorities", () => {
    const priorities: WarmingPriority[] = ["most-frequent", "most-recent", "high-priority"];
    expect(priorities.length).toBe(3);
  });
});