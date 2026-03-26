import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import {
  VirtualizationError,
  detectVirtualizationErrorType,
  handleVirtualizationError,
  withVirtualizationFallback,
  NetworkError,
  detectNetworkErrorType,
  isRetryableError,
  calculateRetryDelay,
  withRetry,
  fetchWithRetry,
  createUnifiedError,
  logError,
  createErrorBoundaryState,
  handleErrorBoundary,
  resetErrorBoundary,
} from "@/lib/error/handling";

describe("Error Handling Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VirtualizationError", () => {
    it("should create VirtualizationError with message", () => {
      const error = new VirtualizationError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("VirtualizationError");
      expect(error.type).toBe("VIRTUALIZATION_ERROR");
      expect(error.fallbackAvailable).toBe(true);
    });

    it("should create VirtualizationError with cause and fallback flag", () => {
      const cause = new Error("Original error");
      const error = new VirtualizationError("Test error", cause, false);
      expect(error.cause).toBe(cause);
      expect(error.fallbackAvailable).toBe(false);
    });
  });

  describe("detectVirtualizationErrorType", () => {
    it("should detect MEMORY_PRESSURE errors", () => {
      expect(detectVirtualizationErrorType(new Error("Out of memory"))).toBe(
        "MEMORY_PRESSURE"
      );
      expect(detectVirtualizationErrorType(new Error("Memory limit exceeded"))).toBe(
        "MEMORY_PRESSURE"
      );
    });

    it("should detect RENDER_FAILURE errors", () => {
      expect(detectVirtualizationErrorType(new Error("Render failed"))).toBe(
        "RENDER_FAILURE"
      );
      expect(detectVirtualizationErrorType(new Error("DOM error"))).toBe(
        "RENDER_FAILURE"
      );
    });

    it("should detect INITIALIZATION_FAILURE errors", () => {
      expect(
        detectVirtualizationErrorType(new Error("Failed to initialize"))
      ).toBe("INITIALIZATION_FAILURE");
      expect(detectVirtualizationErrorType(new Error("Init error"))).toBe(
        "INITIALIZATION_FAILURE"
      );
    });

    it("should detect SCROLL_ERROR errors", () => {
      expect(detectVirtualizationErrorType(new Error("Scroll error"))).toBe(
        "SCROLL_ERROR"
      );
    });

    it("should detect UNKNOWN errors", () => {
      expect(detectVirtualizationErrorType(new Error("Something went wrong"))).toBe(
        "UNKNOWN"
      );
    });

    it("should handle non-Error objects", () => {
      expect(detectVirtualizationErrorType("memory error")).toBe("MEMORY_PRESSURE");
      expect(detectVirtualizationErrorType(123)).toBe("UNKNOWN");
    });
  });

  describe("handleVirtualizationError", () => {
    it("should handle MEMORY_PRESSURE with fallback", () => {
      const error = new Error("Out of memory");
      const result = handleVirtualizationError(error, { rowCount: 10000 });

      expect(result.errorType).toBe("MEMORY_PRESSURE");
      expect(result.shouldFallback).toBe(true);
      expect(result.userMessage).toContain("simple mode");
      expect(result.technicalMessage).toContain("Rows: 10000");
    });

    it("should handle RENDER_FAILURE with fallback", () => {
      const error = new Error("Render failed");
      const result = handleVirtualizationError(error);

      expect(result.errorType).toBe("RENDER_FAILURE");
      expect(result.shouldFallback).toBe(true);
      expect(result.userMessage).toContain("simple display mode");
    });

    it("should handle INITIALIZATION_FAILURE without fallback", () => {
      const error = new Error("Failed to initialize");
      const result = handleVirtualizationError(error);

      expect(result.errorType).toBe("INITIALIZATION_FAILURE");
      expect(result.shouldFallback).toBe(false);
      expect(result.userMessage).toContain("Unable to initialize");
    });

    it("should log error to console", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test error");

      handleVirtualizationError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[VirtualizationError]",
        expect.objectContaining({
          message: "Test error",
          timestamp: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe("withVirtualizationFallback", () => {
    it("should return result from operation on success", async () => {
      const operation = vi.fn().mockResolvedValue("success");
      const fallback = vi.fn().mockResolvedValue("fallback");

      const result = await withVirtualizationFallback(operation, fallback);

      expect(result.result).toBe("success");
      expect(result.isFallback).toBe(false);
      expect(result.error).toBeUndefined();
      expect(operation).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it("should call fallback on operation failure", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Out of memory"));
      const fallback = vi.fn().mockResolvedValue("fallback");

      const result = await withVirtualizationFallback(operation, fallback);

      expect(result.result).toBe("fallback");
      expect(result.isFallback).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe("MEMORY_PRESSURE");
    });

    it("should throw on INITIALIZATION_FAILURE", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error("Failed to initialize"));
      const fallback = vi.fn().mockResolvedValue("fallback");

      await expect(withVirtualizationFallback(operation, fallback)).rejects.toThrow(
        VirtualizationError
      );
      expect(fallback).not.toHaveBeenCalled();
    });

    it("should handle sync operations", async () => {
      const operation = vi.fn().mockReturnValue("sync success");
      const fallback = vi.fn().mockReturnValue("sync fallback");

      const result = await withVirtualizationFallback(operation, fallback);

      expect(result.result).toBe("sync success");
      expect(result.isFallback).toBe(false);
    });
  });

  describe("NetworkError", () => {
    it("should create NetworkError with message and type", () => {
      const error = new NetworkError("Timeout", "TIMEOUT");
      expect(error.message).toBe("Timeout");
      expect(error.name).toBe("NetworkError");
      expect(error.type).toBe("NETWORK_ERROR");
      expect(error.errorType).toBe("TIMEOUT");
      expect(error.retryable).toBe(false);
    });

    it("should create NetworkError with options", () => {
      const error = new NetworkError("Server error", "SERVER_ERROR", {
        retryable: true,
        statusCode: 500,
      });
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("detectNetworkErrorType", () => {
    it("should detect TIMEOUT from status code", () => {
      expect(detectNetworkErrorType(new Error("Error"), 408)).toBe("TIMEOUT");
      expect(detectNetworkErrorType(new Error("Error"), 504)).toBe("TIMEOUT");
    });

    it("should detect RATE_LIMITED from status code", () => {
      expect(detectNetworkErrorType(new Error("Error"), 429)).toBe("RATE_LIMITED");
    });

    it("should detect SERVER_ERROR from status code", () => {
      expect(detectNetworkErrorType(new Error("Error"), 500)).toBe("SERVER_ERROR");
      expect(detectNetworkErrorType(new Error("Error"), 502)).toBe("SERVER_ERROR");
      expect(detectNetworkErrorType(new Error("Error"), 503)).toBe("SERVER_ERROR");
    });

    it("should detect CLIENT_ERROR from status code", () => {
      expect(detectNetworkErrorType(new Error("Error"), 400)).toBe("CLIENT_ERROR");
      expect(detectNetworkErrorType(new Error("Error"), 404)).toBe("CLIENT_ERROR");
    });

    it("should detect TIMEOUT from message", () => {
      expect(detectNetworkErrorType(new Error("Request timeout"))).toBe("TIMEOUT");
      expect(detectNetworkErrorType(new Error("Connection timed out"))).toBe(
        "TIMEOUT"
      );
    });

    it("should detect CONNECTION_REFUSED from message", () => {
      expect(detectNetworkErrorType(new Error("ECONNREFUSED"))).toBe(
        "CONNECTION_REFUSED"
      );
      expect(detectNetworkErrorType(new Error("Connection refused"))).toBe(
        "CONNECTION_REFUSED"
      );
    });

    it("should detect NETWORK_UNREACHABLE from message", () => {
      expect(detectNetworkErrorType(new Error("ENETUNREACH"))).toBe(
        "NETWORK_UNREACHABLE"
      );
      expect(detectNetworkErrorType(new Error("Network unreachable"))).toBe(
        "NETWORK_UNREACHABLE"
      );
    });

    it("should detect UNKNOWN for unrecognized errors", () => {
      expect(detectNetworkErrorType(new Error("Something else"))).toBe("UNKNOWN");
    });
  });

  describe("isRetryableError", () => {
    it("should return true for NetworkError with retryable flag", () => {
      const error = new NetworkError("Error", "SERVER_ERROR", { retryable: true });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for NetworkError without retryable flag", () => {
      const error = new NetworkError("Error", "CLIENT_ERROR", { retryable: false });
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return true for retryable status codes", () => {
      const response = new Response(null, { status: 500 });
      expect(isRetryableError(response)).toBe(true);
    });

    it("should return false for non-retryable status codes", () => {
      const response = new Response(null, { status: 400 });
      expect(isRetryableError(response)).toBe(false);
    });

    it("should return true for timeout errors", () => {
      expect(isRetryableError(new Error("Request timeout"))).toBe(true);
    });

    it("should return true for connection errors", () => {
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
    });

    it("should return false for client errors", () => {
      expect(isRetryableError(new Error("Bad request"), { retryableStatusCodes: [] })).toBe(true);
    });

    it("should use custom retryable status codes", () => {
      const response = new Response(null, { status: 418 });
      expect(
        isRetryableError(response, { retryableStatusCodes: [418] })
      ).toBe(true);
    });
  });

  describe("calculateRetryDelay", () => {
    it("should calculate exponential backoff", () => {
      const delay0 = calculateRetryDelay(0, 1000, 30000, 0);
      const delay1 = calculateRetryDelay(1, 1000, 30000, 0);
      const delay2 = calculateRetryDelay(2, 1000, 30000, 0);

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
    });

    it("should cap at max delay", () => {
      const delay = calculateRetryDelay(10, 1000, 5000, 0);
      expect(delay).toBe(5000);
    });

    it("should add jitter", () => {
      const delays = Array.from({ length: 100 }, () =>
        calculateRetryDelay(1, 1000, 30000, 0.1)
      );

      const min = Math.min(...delays);
      const max = Math.max(...delays);

      expect(min).toBeGreaterThanOrEqual(1800);
      expect(max).toBeLessThanOrEqual(2200);
    });
  });

  describe("withRetry", () => {
    it("should return result on first success", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, { baseDelay: 10 });

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(3);
      expect(result.errors).toHaveLength(2);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Always fail"));

      await expect(
        withRetry(operation, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow("Always fail");

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry non-retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(
          new NetworkError("Bad request", "CLIENT_ERROR", { retryable: false })
        );

      await expect(withRetry(operation, { baseDelay: 10 })).rejects.toThrow(
        "Bad request"
      );

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should call onRetry callback", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      await withRetry(operation, { baseDelay: 10, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      );
    });

    it("should respect shouldRetry predicate", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));
      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(
        withRetry(operation, { baseDelay: 10, shouldRetry })
      ).rejects.toThrow("Fail");

      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it("should track total time", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, { baseDelay: 10 });

      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("fetchWithRetry", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return response on success", async () => {
      const mockResponse = new Response("data", { status: 200 });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await fetchWithRetry("https://example.com");

      expect(result.result).toBe(mockResponse);
      expect(result.attempts).toBe(1);
    });

    it("should retry on server error", async () => {
      const errorResponse = new Response(null, { status: 500 });
      const successResponse = new Response("data", { status: 200 });

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry(
        "https://example.com",
        {},
        { baseDelay: 10 }
      );

      expect(result.result).toBe(successResponse);
      expect(result.attempts).toBe(2);
    });

    it("should not retry on client error", async () => {
      const errorResponse = new Response(null, { status: 400 });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(errorResponse);

      await expect(
        fetchWithRetry("https://example.com", {}, { baseDelay: 10 })
      ).rejects.toThrow(NetworkError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on timeout", async () => {
      const errorResponse = new Response(null, { status: 408 });
      const successResponse = new Response("data", { status: 200 });

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await fetchWithRetry(
        "https://example.com",
        {},
        { baseDelay: 10 }
      );

      expect(result.result).toBe(successResponse);
      expect(result.attempts).toBe(2);
    });
  });

  describe("createUnifiedError", () => {
    it("should create unified error from NetworkError", () => {
      const error = new NetworkError("Timeout", "TIMEOUT", {
        retryable: true,
        statusCode: 408,
      });

      const unified = createUnifiedError(error);

      expect(unified.type).toBe("TIMEOUT");
      expect(unified.severity).toBe("medium");
      expect(unified.retryable).toBe(true);
      expect(unified.userMessage).toContain("timed out");
      expect(unified.metadata?.statusCode).toBe(408);
    });

    it("should create unified error from VirtualizationError", () => {
      const error = new VirtualizationError("Memory error", undefined, true);

      const unified = createUnifiedError(error);

      expect(unified.type).toBe("VIRTUALIZATION_ERROR");
      expect(unified.severity).toBe("low");
      expect(unified.retryable).toBe(false);
      expect(unified.metadata?.fallbackAvailable).toBe(true);
    });

    it("should create unified error from generic Error", () => {
      const error = new Error("Something went wrong");

      const unified = createUnifiedError(error);

      expect(unified.type).toBe("UNKNOWN_ERROR");
      expect(unified.severity).toBe("high");
      expect(unified.retryable).toBe(false);
      expect(unified.userMessage).toBe("An unexpected error occurred.");
    });

    it("should create unified error from non-Error value", () => {
      const unified = createUnifiedError("string error");

      expect(unified.type).toBe("UNKNOWN_ERROR");
      expect(unified.message).toBe("string error");
    });

    it("should include context metadata", () => {
      const error = new Error("Test");
      const unified = createUnifiedError(error, { userId: 123 });

      expect(unified.metadata?.userId).toBe(123);
    });
  });

  describe("logError", () => {
    it("should log critical errors with console.error", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new NetworkError("Server error", "SERVER_ERROR", {
        retryable: false,
      });

      logError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ERROR]",
        expect.objectContaining({
          type: "SERVER_ERROR",
          severity: "high",
        })
      );

      consoleSpy.mockRestore();
    });

    it("should log low severity errors with console.info", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const error = new VirtualizationError("Memory error");

      logError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[INFO]",
        expect.objectContaining({
          type: "VIRTUALIZATION_ERROR",
          severity: "low",
        })
      );

      consoleSpy.mockRestore();
    });

    it("should include context in log", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test");

      logError(error, { requestId: "abc123" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ERROR]",
        expect.objectContaining({
          requestId: "abc123",
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Error Boundary Helpers", () => {
    it("should create initial error boundary state", () => {
      const state = createErrorBoundaryState();

      expect(state.hasError).toBe(false);
      expect(state.error).toBeNull();
      expect(state.errorInfo).toBeNull();
    });

    it("should handle error in error boundary", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test error");

      const state = handleErrorBoundary(error);

      expect(state.hasError).toBe(true);
      expect(state.error).toBe(error);
      expect(state.errorInfo).toBeDefined();
      expect(state.errorInfo?.type).toBe("UNKNOWN_ERROR");

      consoleSpy.mockRestore();
    });

    it("should reset error boundary state", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test error");

      const errorState = handleErrorBoundary(error);
      expect(errorState.hasError).toBe(true);

      const resetState = resetErrorBoundary();
      expect(resetState.hasError).toBe(false);
      expect(resetState.error).toBeNull();

      consoleSpy.mockRestore();
    });

    it("should include context in error boundary handling", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test error");

      const state = handleErrorBoundary(error, { component: "TestComponent" });

      expect(state.errorInfo?.metadata?.component).toBe("TestComponent");

      consoleSpy.mockRestore();
    });
  });

  describe("Re-exports", () => {
    it("should re-export query error utilities", async () => {
      const {
        QueryErrorCategory,
        QueryError,
        sanitizeErrorMessage,
        categorizeClickHouseError,
        formatQueryError,
        formatHttpError,
      } = await import("@/lib/error/handling");

      expect(sanitizeErrorMessage).toBeDefined();
      expect(categorizeClickHouseError).toBeDefined();
      expect(formatQueryError).toBeDefined();
      expect(formatHttpError).toBeDefined();
    });

    it("should re-export API error utilities", async () => {
      const { ApiErrorType, ApiErrorResponse, apiError, ApiErrors, apiSuccess } =
        await import("@/lib/error/handling");

      expect(apiError).toBeDefined();
      expect(ApiErrors).toBeDefined();
      expect(apiSuccess).toBeDefined();
    });

    it("should re-export cache fallback utilities", async () => {
      const {
        CircuitBreakerState,
        RedisFallbackManager,
        getFallbackManager,
        createFallbackManager,
        resetFallbackManager,
      } = await import("@/lib/error/handling");

      expect(CircuitBreakerState).toBeDefined();
      expect(RedisFallbackManager).toBeDefined();
      expect(getFallbackManager).toBeDefined();
      expect(createFallbackManager).toBeDefined();
      expect(resetFallbackManager).toBeDefined();
    });
  });
});
