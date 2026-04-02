import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  checkRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  getClientIdentifier,
  getRateLimitStoreSize,
} from "./rate-limit";

describe("Rate Limiter", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe("checkRateLimit", () => {
    test("allows requests within limit", async () => {
      const result1 = await checkRateLimit("test-ip-1", { maxRequests: 5, windowMs: 60000 });
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = await checkRateLimit("test-ip-1", { maxRequests: 5, windowMs: 60000 });
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    test("blocks requests after limit exceeded", async () => {
      const ip = "test-ip-2";

      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(ip, { maxRequests: 5, windowMs: 60000 });
        expect(result.success).toBe(true);
      }

      const blockedResult = await checkRateLimit(ip, { maxRequests: 5, windowMs: 60000 });
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.resetIn).toBeGreaterThan(0);
    });

    test("different IPs have separate limits", async () => {
      for (let i = 0; i < 5; i++) {
        await checkRateLimit("ip-a", { maxRequests: 5, windowMs: 60000 });
      }

      const result = await checkRateLimit("ip-b", { maxRequests: 5, windowMs: 60000 });
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test("respects custom limits", async () => {
      const result1 = await checkRateLimit("custom-ip", { maxRequests: 2, windowMs: 60000 });
      expect(result1.success).toBe(true);

      const result2 = await checkRateLimit("custom-ip", { maxRequests: 2, windowMs: 60000 });
      expect(result2.success).toBe(true);

      const result3 = await checkRateLimit("custom-ip", { maxRequests: 2, windowMs: 60000 });
      expect(result3.success).toBe(false);
    });

    test("returns correct resetIn time", async () => {
      const windowMs = 60000;
      const result = await checkRateLimit("reset-test", { maxRequests: 5, windowMs });

      expect(result.resetIn).toBeGreaterThan(0);
      expect(result.resetIn).toBeLessThanOrEqual(windowMs);
    });
  });

  describe("resetRateLimit", () => {
    test("clears rate limit for specific identifier", async () => {
      for (let i = 0; i < 5; i++) {
        await checkRateLimit("reset-ip", { maxRequests: 5, windowMs: 60000 });
      }

      const blocked = await checkRateLimit("reset-ip", { maxRequests: 5, windowMs: 60000 });
      expect(blocked.success).toBe(false);

      resetRateLimit("reset-ip");

      const allowed = await checkRateLimit("reset-ip", { maxRequests: 5, windowMs: 60000 });
      expect(allowed.success).toBe(true);
    });
  });

  describe("clearAllRateLimits", () => {
    test("clears all entries", async () => {
      await checkRateLimit("ip-1", { maxRequests: 5, windowMs: 60000 });
      await checkRateLimit("ip-2", { maxRequests: 5, windowMs: 60000 });

      expect(getRateLimitStoreSize()).toBeGreaterThanOrEqual(0);

      clearAllRateLimits();

      expect(getRateLimitStoreSize()).toBe(0);
    });
  });

  describe("getClientIdentifier", () => {
    let originalProxyEnv: string | undefined;

    beforeEach(() => {
      originalProxyEnv = process.env.TRUSTED_PROXY_IPS;
    });

    afterEach(() => {
      if (originalProxyEnv !== undefined) {
        process.env.TRUSTED_PROXY_IPS = originalProxyEnv;
      } else {
        delete process.env.TRUSTED_PROXY_IPS;
      }
    });

    test("extracts IP from x-forwarded-for header when connection is from trusted proxy", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1";
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(getClientIdentifier(request, "10.0.0.1")).toBe("1.2.3.4");
    });

    test("extracts IP from x-real-ip header when connection is from trusted proxy", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1";
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "9.8.7.6" },
      });
      expect(getClientIdentifier(request, "10.0.0.1")).toBe("9.8.7.6");
    });

    test("returns connection IP when not from trusted proxy even with headers", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1";
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.1.1.1" },
      });
      expect(getClientIdentifier(request, "192.168.1.1")).toBe("192.168.1.1");
    });

    test("returns fallback when no connection IP and no trusted proxy", () => {
      delete process.env.TRUSTED_PROXY_IPS;
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.1.1.1" },
      });
      expect(getClientIdentifier(request)).toContain("fallback:");
    });

    test("prefers x-forwarded-for over x-real-ip when from trusted proxy", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1";
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.1.1.1",
          "x-real-ip": "2.2.2.2",
        },
      });
      expect(getClientIdentifier(request, "10.0.0.1")).toBe("1.1.1.1");
    });

    test("ignores forwarded headers when connection IP is not trusted", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1,10.0.0.2";
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.1.1.1",
          "x-real-ip": "2.2.2.2",
        },
      });
      expect(getClientIdentifier(request, "192.168.1.1")).toBe("192.168.1.1");
    });

    test("supports multiple trusted proxies", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1,10.0.0.2,10.0.0.3";
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(getClientIdentifier(request, "10.0.0.2")).toBe("1.2.3.4");
    });
  });
});
