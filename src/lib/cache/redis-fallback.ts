/**
 * Redis Fallback Manager
 *
 * Provides comprehensive Redis fallback mechanism with:
 * - Health checks for Redis connection monitoring
 * - Circuit breaker pattern to prevent cascading failures
 * - Retry logic with exponential backoff
 * - Automatic fallback to LRU cache when Redis is unavailable
 * - Fallback status monitoring and logging
 */

import { LRUCacheImpl } from "./lru-cache";
import { getRedisClient, isRedisAvailable, closeRedisClient } from "./redis-client";

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, reject requests
  HALF_OPEN = "half-open", // Testing if recovery is possible
}

export interface FallbackOptions {
  /** Maximum number of cache entries in fallback LRU cache */
  maxEntries?: number;
  /** TTL in milliseconds for fallback cache entries */
  ttl?: number;
  /** Enable/disable fallback mechanism (default: true) */
  enabled?: boolean;
  /** Health check interval in milliseconds (default: 30000 = 30s) */
  healthCheckInterval?: number;
  /** Number of consecutive failures to open circuit (default: 5) */
  failureThreshold?: number;
  /** Cooldown period before trying half-open state (default: 60000 = 60s) */
  cooldownPeriod?: number;
  /** Max retry attempts for Redis connection (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseRetryDelay?: number;
}

export interface FallbackStatus {
  isUsingFallback: boolean;
  redisAvailable: boolean;
  circuitBreakerState: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastHealthCheck: number | null;
  lastHealthCheckStatus: boolean | null;
  fallbackEventCount: number;
  totalRequests: number;
  fallbackRequests: number;
  fallbackRequestPercentage: number;
}

interface CacheData<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Redis Fallback Manager class
 * Manages automatic fallback to LRU cache when Redis is unavailable
 */
export class RedisFallbackManager {
  private fallbackCache: LRUCacheImpl;
  private enabled: boolean;
  private healthCheckInterval: number;
  private failureThreshold: number;
  private cooldownPeriod: number;
  private maxRetries: number;
  private baseRetryDelay: number;

  // Circuit breaker state
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private lastCircuitStateChange: number = 0;

  // Health check state
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private lastHealthCheck: number | null = null;
  private lastHealthCheckStatus: boolean | null = null;

  // Monitoring state
  private totalRequests: number = 0;
  private fallbackRequests: number = 0;
  private fallbackEventCount: number = 0;

  constructor(options: FallbackOptions = {}) {
    this.fallbackCache = new LRUCacheImpl({
      max: options.maxEntries ?? 500,
      ttl: options.ttl ?? 300_000, // 5 minutes default
      name: "redis-fallback",
    });

    this.enabled = options.enabled ?? true;
    this.healthCheckInterval = options.healthCheckInterval ?? 30_000; // 30 seconds
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownPeriod = options.cooldownPeriod ?? 60_000; // 60 seconds
    this.maxRetries = options.maxRetries ?? 3;
    this.baseRetryDelay = options.baseRetryDelay ?? 1000; // 1 second base

    // Start periodic health check
    this.startHealthCheck();
  }

  /**
   * Start periodic Redis health check
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckInterval);

    // Don't prevent process from exiting
    this.healthCheckTimer.unref();
  }

  /**
   * Perform a Redis health check using ping
   */
  private async performHealthCheck(): Promise<boolean> {
    const startTime = Date.now();

    try {
      const redis = await getRedisClient();
      await redis.ping();

      const healthy = true;
      this.lastHealthCheck = Date.now();
      this.lastHealthCheckStatus = healthy;

      // If we were in half-open state and health check passed, close the circuit
      if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
        this.closeCircuit();
        console.log("[RedisFallback] Circuit breaker closed after successful health check");
      }

      return healthy;
    } catch (error) {
      this.lastHealthCheck = Date.now();
      this.lastHealthCheckStatus = false;

      // Record failure for circuit breaker
      this.recordFailure();

      return false;
    }
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(): void {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    // Check if we should open the circuit
    if (
      this.circuitBreakerState === CircuitBreakerState.CLOSED &&
      this.consecutiveFailures >= this.failureThreshold
    ) {
      this.openCircuit();
    }
  }

  /**
   * Record a success for circuit breaker
   */
  private recordSuccess(): void {
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    // If in half-open state and getting successes, close the circuit
    if (
      this.circuitBreakerState === CircuitBreakerState.HALF_OPEN &&
      this.consecutiveSuccesses >= 2
    ) {
      this.closeCircuit();
    }
  }

  /**
   * Open the circuit breaker (reject Redis requests)
   */
  private openCircuit(): void {
    if (this.circuitBreakerState !== CircuitBreakerState.OPEN) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.lastCircuitStateChange = Date.now();
      console.warn(
        `[RedisFallback] Circuit breaker OPEN after ${this.consecutiveFailures} consecutive failures`
      );
    }
  }

  /**
   * Close the circuit breaker (allow Redis requests)
   */
  private closeCircuit(): void {
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastCircuitStateChange = Date.now();
    console.log("[RedisFallback] Circuit breaker CLOSED");
  }

  /**
   * Try to transition to half-open state
   */
  private tryHalfOpen(): void {
    if (
      this.circuitBreakerState === CircuitBreakerState.OPEN &&
      Date.now() - this.lastCircuitStateChange >= this.cooldownPeriod
    ) {
      this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
      this.consecutiveSuccesses = 0;
      console.log("[RedisFallback] Circuit breaker HALF-OPEN (testing recovery)");
    }
  }

  /**
   * Check if Redis should be used based on circuit breaker state
   */
  private shouldUseRedis(): boolean {
    if (!this.enabled) {
      return false;
    }

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return isRedisAvailable();

      case CircuitBreakerState.OPEN:
        // Check if cooldown period has passed to try half-open
        this.tryHalfOpen();
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // In half-open state, try Redis but expect possible failure
        return isRedisAvailable();

      default:
        return false;
    }
  }

  /**
   * Execute a Redis operation with retry logic and fallback
   *
   * @param operation - The Redis operation to execute
   * @param operationName - Name of operation for logging
   * @returns Result from Redis or fallback cache
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ data: T | undefined; isFromFallback: boolean }> {
    this.totalRequests++;

    // Check if we should use Redis
    if (this.shouldUseRedis()) {
      try {
        const result = await this.executeWithRetry(operation, operationName);
        this.recordSuccess();
        return { data: result, isFromFallback: false };
      } catch (error) {
        console.error(
          `[RedisFallback] Redis operation "${operationName}" failed:`,
          error
        );
        this.recordFailure();
        // Fall through to fallback
      }
    }

    // Use fallback
    this.fallbackRequests++;
    this.fallbackEventCount++;
    return { data: undefined, isFromFallback: true };
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[RedisFallback] Retry ${attempt + 1}/${this.maxRetries} for "${operationName}" failed:`,
          lastError.message
        );

        // Don't wait after last attempt
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseRetryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`All retries exhausted for "${operationName}"`);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get value from fallback cache
   */
  getFromFallback<T>(key: string): T | undefined {
    const data = this.fallbackCache.get<CacheData<T>>(key);
    if (!data) {
      return undefined;
    }

    // Check if expired
    const age = Date.now() - data.timestamp;
    if (age > data.ttl) {
      this.fallbackCache.delete(key);
      return undefined;
    }

    return data.value;
  }

  /**
   * Set value in fallback cache
   */
  setFallback<T>(key: string, value: T, ttl?: number): void {
    const cacheData: CacheData<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? 300_000,
    };
    this.fallbackCache.set(key, cacheData);
  }

  /**
   * Delete value from fallback cache
   */
  deleteFallback(key: string): boolean {
    return this.fallbackCache.delete(key);
  }

  /**
   * Check if key exists in fallback cache
   */
  hasFallback(key: string): boolean {
    return this.fallbackCache.has(key);
  }

  /**
   * Clear fallback cache
   */
  clearFallback(): void {
    this.fallbackCache.clear();
  }

  /**
   * Get current fallback status
   */
  getStatus(): FallbackStatus {
    const isUsingFallback =
      !this.shouldUseRedis() || this.circuitBreakerState !== CircuitBreakerState.CLOSED;

    return {
      isUsingFallback,
      redisAvailable: isRedisAvailable(),
      circuitBreakerState: this.circuitBreakerState,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastHealthCheck: this.lastHealthCheck,
      lastHealthCheckStatus: this.lastHealthCheckStatus,
      fallbackEventCount: this.fallbackEventCount,
      totalRequests: this.totalRequests,
      fallbackRequests: this.fallbackRequests,
      fallbackRequestPercentage:
        this.totalRequests > 0
          ? (this.fallbackRequests / this.totalRequests) * 100
          : 0,
    };
  }

  /**
   * Get fallback cache size
   */
  getFallbackSize(): number {
    return this.fallbackCache.size;
  }

  /**
   * Get fallback cache stats
   */
  getFallbackStats() {
    return this.fallbackCache.getStats();
  }

  /**
   * Manually trigger a health check
   */
  async checkHealth(): Promise<boolean> {
    return this.performHealthCheck();
  }

  /**
   * Reset the fallback manager (useful for testing)
   */
  reset(): void {
    this.clearFallback();
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.totalRequests = 0;
    this.fallbackRequests = 0;
    this.fallbackEventCount = 0;
    this.lastHealthCheck = null;
    this.lastHealthCheckStatus = null;
  }

  /**
   * Stop the fallback manager and cleanup
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.clearFallback();
  }
}

// Default instance
let defaultFallbackManager: RedisFallbackManager | null = null;

/**
 * Get the default fallback manager instance
 */
export function getFallbackManager(): RedisFallbackManager {
  if (!defaultFallbackManager) {
    defaultFallbackManager = new RedisFallbackManager();
  }
  return defaultFallbackManager;
}

/**
 * Create a new fallback manager instance
 */
export function createFallbackManager(options: FallbackOptions = {}): RedisFallbackManager {
  return new RedisFallbackManager(options);
}

/**
 * Reset the default fallback manager
 */
export function resetFallbackManager(): void {
  if (defaultFallbackManager) {
    defaultFallbackManager.destroy();
    defaultFallbackManager = null;
  }
}
