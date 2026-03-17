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
    test("allows requests within limit", () => {
      const result1 = checkRateLimit("test-ip-1", 5, 60000);
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = checkRateLimit("test-ip-1", 5, 60000);
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    test("blocks requests after limit exceeded", () => {
      const ip = "test-ip-2";

      // Use up all allowed requests
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(ip, 5, 60000);
        expect(result.success).toBe(true);
      }

      // Next request should be blocked
      const blockedResult = checkRateLimit(ip, 5, 60000);
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.resetIn).toBeGreaterThan(0);
    });

    test("different IPs have separate limits", () => {
      // Exhaust limit for IP 1
      for (let i = 0; i < 5; i++) {
        checkRateLimit("ip-a", 5, 60000);
      }

      // IP 2 should still be allowed
      const result = checkRateLimit("ip-b", 5, 60000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test("respects custom limits", () => {
      const result1 = checkRateLimit("custom-ip", 2, 60000);
      expect(result1.success).toBe(true);

      const result2 = checkRateLimit("custom-ip", 2, 60000);
      expect(result2.success).toBe(true);

      const result3 = checkRateLimit("custom-ip", 2, 60000);
      expect(result3.success).toBe(false);
    });

    test("returns correct resetIn time", () => {
      const windowMs = 60000;
      const result = checkRateLimit("reset-test", 5, windowMs);

      expect(result.resetIn).toBeGreaterThan(0);
      expect(result.resetIn).toBeLessThanOrEqual(windowMs);
    });
  });

  describe("resetRateLimit", () => {
    test("clears rate limit for specific identifier", () => {
      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit("reset-ip", 5, 60000);
      }

      // Should be blocked
      expect(checkRateLimit("reset-ip", 5, 60000).success).toBe(false);

      // Reset
      resetRateLimit("reset-ip");

      // Should be allowed again
      expect(checkRateLimit("reset-ip", 5, 60000).success).toBe(true);
    });
  });

  describe("clearAllRateLimits", () => {
    test("clears all entries", () => {
      checkRateLimit("ip-1", 5, 60000);
      checkRateLimit("ip-2", 5, 60000);

      expect(getRateLimitStoreSize()).toBe(2);

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
      // Connection IP is in trusted proxy list
      expect(getClientIdentifier(request, "10.0.0.1")).toBe("1.2.3.4");
    });

    test("extracts IP from x-real-ip header when connection is from trusted proxy", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1";
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "9.8.7.6" },
      });
      // Connection IP is in trusted proxy list
      expect(getClientIdentifier(request, "10.0.0.1")).toBe("9.8.7.6");
    });

    test("returns connection IP when not from trusted proxy even with headers", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1";
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.1.1.1" },
      });
      // Connection IP is NOT in trusted proxy list - should use connection IP
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
      // Connection from untrusted IP - should not trust headers
      expect(getClientIdentifier(request, "192.168.1.1")).toBe("192.168.1.1");
    });

    test("supports multiple trusted proxies", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.1,10.0.0.2,10.0.0.3";
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      // Connection from second trusted proxy
      expect(getClientIdentifier(request, "10.0.0.2")).toBe("1.2.3.4");
    });
  });
});
