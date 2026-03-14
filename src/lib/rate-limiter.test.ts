import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  RateLimiter,
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
} from './rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000, // 1 second for faster tests
    });
  });

  afterEach(() => {
    resetGlobalRateLimiter();
  });

  describe('check', () => {
    it('should allow requests within limit', async () => {
      const result = await rateLimiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should track multiple requests', async () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await rateLimiter.check('user1'));
      }

      expect(results[0].remaining).toBe(4);
      expect(results[1].remaining).toBe(3);
      expect(results[2].remaining).toBe(2);
      expect(results[3].remaining).toBe(1);
      expect(results[4].remaining).toBe(0);
    });

    it('should deny requests exceeding limit', async () => {
      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
      }

      // Next request should be denied
      const result = await rateLimiter.check('user1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow requests after window expires', async () => {
      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
      }

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should allow new requests
      const result = await rateLimiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    }, 2000);

    it('should handle different users independently', async () => {
      // User 1 uses all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
      }

      // User 2 should still be allowed
      const result = await rateLimiter.check('user2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should use custom limit when provided', async () => {
      const result = await rateLimiter.check('user1', 2);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);

      // Second request
      const result2 = await rateLimiter.check('user1', 2);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(0);

      // Third request should be denied
      const result3 = await rateLimiter.check('user1', 2);
      expect(result3.allowed).toBe(false);
    });

    it('should provide correct reset time', async () => {
      const result1 = await rateLimiter.check('user1');
      const resetTime1 = result1.resetTime;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result2 = await rateLimiter.check('user1');
      const resetTime2 = result2.resetTime;

      // Reset time should be based on the first request
      expect(resetTime2).toBe(resetTime1);
    });

    it('should handle empty identifier', async () => {
      const result = await rateLimiter.check('');
      expect(result.allowed).toBe(true);
    });

    it('should handle special characters in identifier', async () => {
      const result = await rateLimiter.check('user@example.com');
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for specific user', async () => {
      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
      }

      // Reset
      rateLimiter.reset('user1');

      // Should allow new requests
      const result = await rateLimiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should not affect other users', async () => {
      // User 1 uses all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
      }

      // Reset user 1
      rateLimiter.reset('user1');

      // User 2 should still have their own limit
      const result = await rateLimiter.check('user2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should handle resetting non-existent user', () => {
      expect(() => rateLimiter.reset('nonexistent')).not.toThrow();
    });
  });

  describe('getUsage', () => {
    it('should return current usage count', async () => {
      expect(rateLimiter.getUsage('user1')).toBe(0);

      await rateLimiter.check('user1');
      expect(rateLimiter.getUsage('user1')).toBe(1);

      await rateLimiter.check('user1');
      expect(rateLimiter.getUsage('user1')).toBe(2);
    });

    it('should only count requests within time window', async () => {
      await rateLimiter.check('user1');
      await rateLimiter.check('user1');

      expect(rateLimiter.getUsage('user1')).toBe(2);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(rateLimiter.getUsage('user1')).toBe(0);
    });

    it('should return 0 for non-existent user', () => {
      expect(rateLimiter.getUsage('nonexistent')).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all rate limit data', async () => {
      // Use up requests for multiple users
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
        await rateLimiter.check('user2');
      }

      // Clear all
      rateLimiter.clear();

      // All users should be reset
      expect(rateLimiter.getUsage('user1')).toBe(0);
      expect(rateLimiter.getUsage('user2')).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await rateLimiter.check('user1');
      await rateLimiter.check('user2');

      const stats = rateLimiter.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(1000);
      expect(stats.calculatedSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sliding window behavior', () => {
    it('should implement sliding window correctly', async () => {
      // Make 3 requests
      await rateLimiter.check('user1');
      await rateLimiter.check('user1');
      await rateLimiter.check('user1');

      expect(rateLimiter.getUsage('user1')).toBe(3);

      // Wait for half the window
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Make 2 more requests
      await rateLimiter.check('user1');
      await rateLimiter.check('user1');

      // Should still be within limit (5 total)
      expect(rateLimiter.getUsage('user1')).toBe(5);

      // Next request should be denied
      const result = await rateLimiter.check('user1');
      expect(result.allowed).toBe(false);

      // Wait for the first 3 requests to expire
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should allow new requests now
      const result2 = await rateLimiter.check('user1');
      expect(result2.allowed).toBe(true);
    });
  });
});

describe('Global Rate Limiter', () => {
  afterEach(() => {
    resetGlobalRateLimiter();
  });

  it('should return singleton instance', () => {
    const limiter1 = getGlobalRateLimiter();
    const limiter2 = getGlobalRateLimiter();

    expect(limiter1).toBe(limiter2);
  });

  it('should persist state across calls', async () => {
    const limiter = getGlobalRateLimiter();

    await limiter.check('user1');
    expect(limiter.getUsage('user1')).toBe(1);

    const limiter2 = getGlobalRateLimiter();
    expect(limiter2.getUsage('user1')).toBe(1);
  });

  it('should reset when resetGlobalRateLimiter is called', async () => {
    const limiter = getGlobalRateLimiter();

    await limiter.check('user1');
    expect(limiter.getUsage('user1')).toBe(1);

    resetGlobalRateLimiter();

    const limiter2 = getGlobalRateLimiter();
    expect(limiter2.getUsage('user1')).toBe(0);
  });
});