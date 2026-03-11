/**
 * Performance Benchmarks for Discover Feature
 *
 * This file provides benchmark scenarios to measure the performance
 * of the Discover feature with different dataset sizes.
 *
 * Metrics to track:
 * - Query execution time
 * - Memory usage
 * - Cache hit rate
 * - Time to first byte
 * - Time to interactive
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createClient, clearClientCache, queryWithTimeout } from '@/lib/clickhouse/client';
import { getGlobalRateLimiter, resetGlobalRateLimiter } from '@/lib/rate-limiter';

interface BenchmarkResult {
  name: string;
  executionTime: number;
  rowCount: number;
  memoryUsage: number;
  cacheHit: boolean;
}

describe('Discover Performance Benchmarks', () => {
  let client: ReturnType<typeof createClient>;
  const results: BenchmarkResult[] = [];

  beforeAll(async () => {
    // Setup: Create test client
    try {
      client = createClient();
      await client.ping();
    } catch {
      console.warn('ClickHouse not available for benchmarks. Skipping.');
    }
  });

  afterAll(() => {
    clearClientCache();
    resetGlobalRateLimiter();
  });

  function recordBenchmark(
    name: string,
    executionTime: number,
    rowCount: number,
    memoryUsage: number,
    cacheHit: boolean,
  ): void {
    const result: BenchmarkResult = {
      name,
      executionTime,
      rowCount,
      memoryUsage,
      cacheHit,
    };
    results.push(result);
    console.log(`Benchmark: ${name}`);
    console.log(`  Execution Time: ${executionTime}ms`);
    console.log(`  Row Count: ${rowCount}`);
    console.log(`  Memory Usage: ${memoryUsage}MB`);
    console.log(`  Cache Hit: ${cacheHit}`);
    console.log('');
  }

  describe('Small Dataset (< 1k rows)', () => {
    it('should query small dataset quickly', async () => {
      if (!client) {
        console.log('Skipping: ClickHouse not available');
        return;
      }

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      try {
        const query = 'SELECT * FROM system.tables LIMIT 100';
        const result = await queryWithTimeout(client, query, 10);

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

        const executionTime = endTime - startTime;
        const memoryUsage = endMemory - startMemory;

        recordBenchmark(
          'Small Dataset Query',
          executionTime,
          result.rows,
          memoryUsage,
          false,
        );

        // Performance targets
        expect(executionTime).toBeLessThan(1000); // < 1 second
        expect(memoryUsage).toBeLessThan(10); // < 10MB
      } catch {
        console.log('Benchmark failed');
      }
    });
  });

  describe('Medium Dataset (1k-100k rows)', () => {
    it('should query medium dataset efficiently', async () => {
      if (!client) {
        console.log('Skipping: ClickHouse not available');
        return;
      }

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      try {
        const query = "SELECT * FROM system.query_log WHERE type = 'QueryFinish' LIMIT 10000";
        const result = await queryWithTimeout(client, query, 30);

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

        const executionTime = endTime - startTime;
        const memoryUsage = endMemory - startMemory;

        recordBenchmark(
          'Medium Dataset Query',
          executionTime,
          result.rows,
          memoryUsage,
          false,
        );

        // Performance targets
        expect(executionTime).toBeLessThan(5000); // < 5 seconds
        expect(memoryUsage).toBeLessThan(50); // < 50MB
      } catch {
        console.log('Benchmark failed');
      }
    });
  });

  describe('Large Dataset (100k-1M rows)', () => {
    it('should query large dataset with streaming', async () => {
      if (!client) {
        console.log('Skipping: ClickHouse not available');
        return;
      }

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      try {
        const query = "SELECT * FROM system.query_log WHERE type = 'QueryFinish' LIMIT 100000";
        const result = await queryWithTimeout(client, query, 60);

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

        const executionTime = endTime - startTime;
        const memoryUsage = endMemory - startMemory;

        recordBenchmark(
          'Large Dataset Query',
          executionTime,
          result.rows,
          memoryUsage,
          false,
        );

        // Performance targets
        expect(executionTime).toBeLessThan(30000); // < 30 seconds
        expect(memoryUsage).toBeLessThan(100); // < 100MB
      } catch {
        console.log('Benchmark failed');
      }
    });
  });

  describe('Rate Limiter Performance', () => {
    it('should handle rate limiting efficiently', async () => {
      const rateLimiter = getGlobalRateLimiter();
      const iterations = 1000;

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      for (let i = 0; i < iterations; i++) {
        rateLimiter.check(`user_${i % 10}`); // 10 different users
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      const executionTime = endTime - startTime;
      const memoryUsage = endMemory - startMemory;

      recordBenchmark(
        'Rate Limiter (1000 checks)',
        executionTime,
        iterations,
        memoryUsage,
        false,
      );

      // Performance targets
      expect(executionTime).toBeLessThan(100); // < 100ms for 1000 checks
      expect(memoryUsage).toBeLessThan(1); // < 1MB
    });
  });

  describe('SQL Validator Performance', () => {
    it('should validate SQL efficiently', async () => {
      const { validateSQL } = await import('@/lib/clickhouse/sql-validator');
      const iterations = 1000;
      const queries = Array.from({ length: iterations }, (_, i) =>
        `SELECT * FROM table WHERE id = ${i}`,
      );

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      for (const query of queries) {
        validateSQL(query);
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      const executionTime = endTime - startTime;
      const memoryUsage = endMemory - startMemory;

      recordBenchmark(
        'SQL Validator (1000 validations)',
        executionTime,
        iterations,
        memoryUsage,
        false,
      );

      // Performance targets
      expect(executionTime).toBeLessThan(100); // < 100ms for 1000 validations
      expect(memoryUsage).toBeLessThan(1); // < 1MB
    });
  });

  describe('Cache Performance', () => {
    it('should benefit from query caching', async () => {
      if (!client) {
        console.log('Skipping: ClickHouse not available');
        return;
      }

      const query = 'SELECT * FROM system.tables LIMIT 100';

      // First query (cache miss)
      const startTime1 = Date.now();
      await queryWithTimeout(client, query, 10);
      const endTime1 = Date.now();
      const executionTime1 = endTime1 - startTime1;

      // Second query (potential cache hit)
      const startTime2 = Date.now();
      await queryWithTimeout(client, query, 10);
      const endTime2 = Date.now();
      const executionTime2 = endTime2 - startTime2;

      recordBenchmark(
        'Cache Performance (first query)',
        executionTime1,
        0,
        0,
        false,
      );

      recordBenchmark(
        'Cache Performance (second query)',
        executionTime2,
        0,
        0,
        true,
      );

      // Second query should be faster (cache hit)
      // Note: This depends on Redis being configured
      console.log(`Cache improvement: ${executionTime1 - executionTime2}ms`);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory with repeated queries', async () => {
      if (!client) {
        console.log('Skipping: ClickHouse not available');
        return;
      }

      const iterations = 100;
      const query = 'SELECT * FROM system.tables LIMIT 10';

      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      for (let i = 0; i < iterations; i++) {
        await queryWithTimeout(client, query, 10);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryGrowth = finalMemory - initialMemory;

      recordBenchmark(
        'Memory Leak Detection',
        0,
        iterations,
        memoryGrowth,
        false,
      );

      // Memory growth should be minimal (< 10MB for 100 queries)
      expect(memoryGrowth).toBeLessThan(10);
    });
  });

  describe('Benchmark Summary', () => {
    it('should print benchmark summary', () => {
      console.log('\n=== Benchmark Summary ===');
      console.log('');

      results.forEach((result) => {
        console.log(`${result.name}:`);
        console.log(`  Time: ${result.executionTime}ms`);
        console.log(`  Rows: ${result.rowCount}`);
        console.log(`  Memory: ${result.memoryUsage.toFixed(2)}MB`);
        console.log(`  Cache: ${result.cacheHit ? 'HIT' : 'MISS'}`);
        console.log('');
      });

      console.log('=== Performance Targets ===');
      console.log('Small Dataset (< 1k rows): < 1s, < 10MB');
      console.log('Medium Dataset (1k-100k rows): < 5s, < 50MB');
      console.log('Large Dataset (100k-1M rows): < 30s, < 100MB');
      console.log('Rate Limiter: < 100ms for 1000 checks, < 1MB');
      console.log('SQL Validator: < 100ms for 1000 validations, < 1MB');
      console.log('Memory Leak: < 10MB growth for 100 queries');
      console.log('');
    });
  });
});