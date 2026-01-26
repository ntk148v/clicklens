import { describe, test, expect, beforeEach } from "bun:test";
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
    test("extracts IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(getClientIdentifier(request)).toBe("1.2.3.4");
    });

    test("extracts IP from x-real-ip header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "9.8.7.6" },
      });
      expect(getClientIdentifier(request)).toBe("9.8.7.6");
    });

    test("returns unknown when no IP headers present", () => {
      const request = new Request("http://localhost");
      expect(getClientIdentifier(request)).toBe("unknown");
    });

    test("prefers x-forwarded-for over x-real-ip", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.1.1.1",
          "x-real-ip": "2.2.2.2",
        },
      });
      expect(getClientIdentifier(request)).toBe("1.1.1.1");
    });
  });
});
