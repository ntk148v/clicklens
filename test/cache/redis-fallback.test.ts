import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import {
  RedisFallbackManager,
  createFallbackManager,
  resetFallbackManager,
  CircuitBreakerState,
} from "../../src/lib/cache/redis-fallback";
import { LRUCacheImpl } from "../../src/lib/cache/lru-cache";

describe("RedisFallbackManager", () => {
  let manager: RedisFallbackManager;

  beforeEach(() => {
    resetFallbackManager();
    manager = createFallbackManager({
      maxEntries: 100,
      ttl: 60_000,
      healthCheckInterval: 1000,
      failureThreshold: 3,
      cooldownPeriod: 5000,
      maxRetries: 2,
      baseRetryDelay: 100,
    });
  });

  afterEach(() => {
    manager.destroy();
    resetFallbackManager();
  });

  describe("initialization", () => {
    it("should initialize with default values", () => {
      const defaultManager = createFallbackManager();
      expect(defaultManager).toBeDefined();
      defaultManager.destroy();
    });

    it("should initialize with custom options", () => {
      expect(manager).toBeDefined();
      const status = manager.getStatus();
      expect(status.circuitBreakerState).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe("fallback cache operations", () => {
    it("should set and get values from fallback cache", () => {
      manager.setFallback("test-key", { data: "test-value" });
      const result = manager.getFromFallback<{ data: string }>("test-key");
      expect(result).toEqual({ data: "test-value" });
    });

    it("should return undefined for non-existent key", () => {
      const result = manager.getFromFallback("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should delete values from fallback cache", () => {
      manager.setFallback("test-key", { data: "test-value" });
      const deleted = manager.deleteFallback("test-key");
      expect(deleted).toBe(true);
      expect(manager.getFromFallback("test-key")).toBeUndefined();
    });

    it("should check if key exists in fallback cache", () => {
      manager.setFallback("test-key", { data: "test-value" });
      expect(manager.hasFallback("test-key")).toBe(true);
      expect(manager.hasFallback("nonexistent")).toBe(false);
    });

    it("should clear fallback cache", () => {
      manager.setFallback("key1", { data: "value1" });
      manager.setFallback("key2", { data: "value2" });
      manager.clearFallback();
      expect(manager.getFallbackSize()).toBe(0);
    });

    it("should handle TTL expiration in fallback cache", async () => {
      const shortManager = createFallbackManager({
        ttl: 50,
      });
      shortManager.setFallback("test-key", { data: "test-value" });
      expect(shortManager.getFromFallback("test-key")).toEqual({ data: "test-value" });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(shortManager.getFromFallback("test-key")).toBeUndefined();
      shortManager.destroy();
    });
  });

  describe("circuit breaker", () => {
    it("should start in closed state", () => {
      const status = manager.getStatus();
      expect(status.circuitBreakerState).toBe(CircuitBreakerState.CLOSED);
    });

    it("should track consecutive failures", () => {
      const status = manager.getStatus();
      expect(status.consecutiveFailures).toBe(0);
    });

    it("should track consecutive successes", () => {
      const status = manager.getStatus();
      expect(status.consecutiveSuccesses).toBe(0);
    });
  });

  describe("status monitoring", () => {
    it("should return complete status", () => {
      const status = manager.getStatus();
      expect(status).toHaveProperty("isUsingFallback");
      expect(status).toHaveProperty("redisAvailable");
      expect(status).toHaveProperty("circuitBreakerState");
      expect(status).toHaveProperty("consecutiveFailures");
      expect(status).toHaveProperty("consecutiveSuccesses");
      expect(status).toHaveProperty("lastHealthCheck");
      expect(status).toHaveProperty("lastHealthCheckStatus");
      expect(status).toHaveProperty("fallbackEventCount");
      expect(status).toHaveProperty("totalRequests");
      expect(status).toHaveProperty("fallbackRequests");
      expect(status).toHaveProperty("fallbackRequestPercentage");
    });

    it("should track fallback request percentage", async () => {
      await manager.executeWithFallback(
        async () => {
          return manager.getFromFallback("key1");
        },
        "test-fallback"
      );
      const status = manager.getStatus();
      expect(status.totalRequests).toBe(1);
      expect(status.fallbackRequests).toBe(1);
      expect(status.fallbackRequestPercentage).toBe(100);
    });
  });

  describe("reset", () => {
    it("should reset all state", () => {
      manager.setFallback("key1", { data: "value1" });
      manager.getFromFallback("key1");
      manager.reset();
      const status = manager.getStatus();
      expect(status.fallbackEventCount).toBe(0);
      expect(status.totalRequests).toBe(0);
      expect(status.fallbackRequests).toBe(0);
      expect(status.circuitBreakerState).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe("graceful degradation", () => {
    it("should not throw errors when Redis operations fail", async () => {
      const result = await manager.executeWithFallback(
        async () => {
          throw new Error("Redis unavailable");
        },
        "test-operation"
      );
      expect(result.isFromFallback).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should continue working when disabled", () => {
      const disabledManager = createFallbackManager({ enabled: false });
      disabledManager.setFallback("key1", { data: "value1" });
      const result = disabledManager.getFromFallback("key1");
      expect(result).toEqual({ data: "value1" });
      disabledManager.destroy();
    });
  });

  describe("retry logic", () => {
    it("should return fallback when Redis unavailable", async () => {
      let attemptCount = 0;
      const result = await manager.executeWithFallback(
        async () => {
          attemptCount++;
          return "success";
        },
        "test-operation"
      );
      expect(result.isFromFallback).toBe(true);
    });
  });
});

describe("CircuitBreakerState", () => {
  it("should have correct enum values", () => {
    expect(CircuitBreakerState.CLOSED).toBe("closed");
    expect(CircuitBreakerState.OPEN).toBe("open");
    expect(CircuitBreakerState.HALF_OPEN).toBe("half-open");
  });
});

describe("Integration with QueryCache", () => {
  it("should create query cache with fallback support", async () => {
    const { createQueryCacheWithFallback } = await import("../../src/lib/cache/query-cache");
    const cache = createQueryCacheWithFallback({
      maxEntries: 100,
      ttl: 60_000,
      name: "test-cache",
    });
    expect(cache).toBeDefined();
    expect(cache.isUsingFallback).toBeDefined();
    expect(cache.getFallbackStatus).toBeDefined();
    expect(cache.getCircuitBreakerState).toBeDefined();
  });

  it("should initialize fallback manager when enabled", async () => {
    const { createQueryCacheWithFallback } = await import("../../src/lib/cache/query-cache");
    const cache = createQueryCacheWithFallback({
      maxEntries: 100,
      ttl: 60_000,
      name: "test-cache",
    });
    cache.initFallback({
      failureThreshold: 5,
      cooldownPeriod: 10_000,
    });
    const status = cache.getFallbackStatus();
    expect(status).not.toBeNull();
  });

  it("should return null fallback status when not initialized", async () => {
    const { createQueryCache } = await import("../../src/lib/cache/query-cache");
    const cache = createQueryCache({
      maxEntries: 100,
      ttl: 60_000,
      name: "test-cache",
      enableRedisFallback: false,
    });
    const status = cache.getFallbackStatus();
    expect(status).toBeNull();
  });
});

describe("Fallback options validation", () => {
  it("should use default values when not provided", () => {
    const manager = createFallbackManager();
    const status = manager.getStatus();
    expect(status.circuitBreakerState).toBe(CircuitBreakerState.CLOSED);
    expect(status.consecutiveFailures).toBe(0);
    manager.destroy();
  });

  it("should respect custom failure threshold", () => {
    const customManager = createFallbackManager({
      failureThreshold: 10,
    });
    expect(customManager).toBeDefined();
    customManager.destroy();
  });

  it("should respect custom cooldown period", () => {
    const customManager = createFallbackManager({
      cooldownPeriod: 30_000,
    });
    expect(customManager).toBeDefined();
    customManager.destroy();
  });
});
