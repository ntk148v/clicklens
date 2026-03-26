/**
 * Centralized Error Handling Module
 *
 * Provides comprehensive error handling and graceful degradation for:
 * - Query errors (ClickHouse)
 * - API errors (HTTP)
 * - Cache failures (Redis)
 * - Virtualization failures
 * - Network errors with retry logic
 *
 * This module re-exports existing error handling utilities and adds:
 * - Virtualization error handling with graceful degradation
 * - Network retry logic with exponential backoff
 * - Unified error handling interface
 */

// ============================================================================
// RE-EXPORTS: Existing error handling utilities
// ============================================================================

// Query error handling (from query-error.ts)
export {
  type QueryErrorCategory,
  type QueryError,
  sanitizeErrorMessage,
  categorizeClickHouseError,
  formatQueryError,
  formatHttpError,
} from "@/lib/errors/query-error";

// API error handling (from api/errors.ts)
export {
  type ApiErrorType,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  apiError,
  ApiErrors,
  apiSuccess,
} from "@/lib/api/errors";

// Cache fallback (from redis-fallback.ts)
export {
  CircuitBreakerState,
  type FallbackOptions,
  type FallbackStatus,
  RedisFallbackManager,
  getFallbackManager,
  createFallbackManager,
  resetFallbackManager,
} from "@/lib/cache/redis-fallback";

// ============================================================================
// VIRTUALIZATION ERROR HANDLING
// ============================================================================

/**
 * Error thrown when virtualization fails
 */
export class VirtualizationError extends Error {
  public readonly type = "VIRTUALIZATION_ERROR";
  public readonly fallbackAvailable: boolean;

  constructor(
    message: string,
    public readonly cause?: Error,
    fallbackAvailable: boolean = true,
  ) {
    super(message);
    this.name = "VirtualizationError";
    this.fallbackAvailable = fallbackAvailable;
  }
}

/**
 * Virtualization error types
 */
export type VirtualizationErrorType =
  | "MEMORY_PRESSURE" // Out of memory during virtualization
  | "RENDER_FAILURE" // Rendering error
  | "INITIALIZATION_FAILURE" // Failed to initialize virtualizer
  | "SCROLL_ERROR" // Scroll handling error
  | "UNKNOWN"; // Unknown virtualization error

/**
 * Virtualization error result
 */
export interface VirtualizationErrorResult {
  error: VirtualizationError;
  errorType: VirtualizationErrorType;
  shouldFallback: boolean;
  userMessage: string;
  technicalMessage: string;
}

/**
 * Detect virtualization error type from error
 */
export function detectVirtualizationErrorType(
  error: Error | unknown,
): VirtualizationErrorType {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("memory") || message.includes("out of memory")) {
    return "MEMORY_PRESSURE";
  }

  if (message.includes("render") || message.includes("dom")) {
    return "RENDER_FAILURE";
  }

  if (message.includes("initialize") || message.includes("init")) {
    return "INITIALIZATION_FAILURE";
  }

  if (message.includes("scroll")) {
    return "SCROLL_ERROR";
  }

  return "UNKNOWN";
}

/**
 * Handle virtualization error with graceful degradation
 *
 * @param error - The error that occurred
 * @param context - Additional context about the error
 * @returns VirtualizationErrorResult with fallback information
 */
export function handleVirtualizationError(
  error: Error | unknown,
  context?: { rowCount?: number; columnCount?: number },
): VirtualizationErrorResult {
  const errorType = detectVirtualizationErrorType(error);
  const cause = error instanceof Error ? error : new Error(String(error));

  // Determine if fallback is available based on error type
  const shouldFallback = errorType !== "INITIALIZATION_FAILURE";

  // Generate user-friendly message
  let userMessage: string;
  switch (errorType) {
    case "MEMORY_PRESSURE":
      userMessage =
        "Displaying data in simple mode due to memory constraints. " +
        "Consider reducing the result set size.";
      break;
    case "RENDER_FAILURE":
      userMessage =
        "Switched to simple display mode. " +
        "Some advanced features may be unavailable.";
      break;
    case "INITIALIZATION_FAILURE":
      userMessage =
        "Unable to initialize advanced display. " +
        "Please refresh the page or contact support.";
      break;
    case "SCROLL_ERROR":
      userMessage =
        "Scrolling may be limited. " +
        "Try using pagination instead.";
      break;
    case "UNKNOWN":
    default:
      userMessage =
        "Switched to simple display mode. " +
        "Data is still accessible.";
      break;
  }

  // Generate technical message for logging
  const technicalMessage = [
    `Virtualization error: ${errorType}`,
    context?.rowCount ? `Rows: ${context.rowCount}` : null,
    context?.columnCount ? `Columns: ${context.columnCount}` : null,
    `Cause: ${cause.message}`,
  ]
    .filter(Boolean)
    .join(" | ");

  // Log error for debugging
  console.error("[VirtualizationError]", {
    type: errorType,
    message: cause.message,
    stack: cause.stack,
    context,
    timestamp: new Date().toISOString(),
  });

  return {
    error: new VirtualizationError(cause.message, cause, shouldFallback),
    errorType,
    shouldFallback,
    userMessage,
    technicalMessage,
  };
}

/**
 * Wrap a virtualization operation with error handling
 *
 * @param operation - The virtualization operation to execute
 * @param fallback - Fallback function to call if virtualization fails
 * @param context - Additional context for error handling
 * @returns Result from operation or fallback
 */
export async function withVirtualizationFallback<T>(
  operation: () => Promise<T> | T,
  fallback: () => Promise<T> | T,
  context?: { rowCount?: number; columnCount?: number },
): Promise<{ result: T; isFallback: boolean; error?: VirtualizationErrorResult }> {
  try {
    const result = await operation();
    return { result, isFallback: false };
  } catch (error) {
    const errorResult = handleVirtualizationError(error, context);

    if (!errorResult.shouldFallback) {
      throw errorResult.error;
    }

    const result = await fallback();
    return { result, isFallback: true, error: errorResult };
  }
}

// ============================================================================
// NETWORK ERROR HANDLING WITH RETRY
// ============================================================================

/**
 * Network error types
 */
export type NetworkErrorType =
  | "TIMEOUT" // Request timeout
  | "CONNECTION_REFUSED" // Connection refused
  | "NETWORK_UNREACHABLE" // Network unreachable
  | "SERVER_ERROR" // 5xx server errors
  | "RATE_LIMITED" // 429 Too Many Requests
  | "CLIENT_ERROR" // 4xx client errors (non-retryable)
  | "UNKNOWN"; // Unknown network error

/**
 * Network error class
 */
export class NetworkError extends Error {
  public readonly type = "NETWORK_ERROR";
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    public readonly errorType: NetworkErrorType,
    options: { retryable?: boolean; statusCode?: number; cause?: Error } = {},
  ) {
    super(message);
    this.name = "NetworkError";
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
  }
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Jitter factor to add randomness to delays (default: 0.1) */
  jitterFactor?: number;
  /** Retryable HTTP status codes (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
  /** Custom predicate to determine if error is retryable */
  shouldRetry?: (error: Error | unknown, attempt: number) => boolean;
  /** Callback for retry attempts */
  onRetry?: (error: Error | unknown, attempt: number, delay: number) => void;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTime: number;
  errors: Error[];
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<
  Omit<RetryOptions, "shouldRetry" | "onRetry">
> & {
  shouldRetry: (error: Error | unknown, attempt: number) => boolean;
  onRetry: (error: Error | unknown, attempt: number, delay: number) => void;
} = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.1,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Detect network error type from error
 */
export function detectNetworkErrorType(
  error: Error | unknown,
  statusCode?: number,
): NetworkErrorType {
  // Check status code first
  if (statusCode) {
    if (statusCode === 408 || statusCode === 504) return "TIMEOUT";
    if (statusCode === 429) return "RATE_LIMITED";
    if (statusCode >= 500) return "SERVER_ERROR";
    if (statusCode >= 400) return "CLIENT_ERROR";
  }

  // Check error message
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return "TIMEOUT";
  }

  if (message.includes("econnrefused") || message.includes("connection refused")) {
    return "CONNECTION_REFUSED";
  }

  if (message.includes("enetunreach") || message.includes("network unreachable")) {
    return "NETWORK_UNREACHABLE";
  }

  return "UNKNOWN";
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(
  error: Error | unknown,
  options: Pick<RetryOptions, "retryableStatusCodes"> = {},
): boolean {
  const { retryableStatusCodes = DEFAULT_RETRY_OPTIONS.retryableStatusCodes } = options;

  // NetworkError with retryable flag
  if (error instanceof NetworkError) {
    return error.retryable;
  }

  // Check for fetch Response with status code
  if (error instanceof Response) {
    return retryableStatusCodes.includes(error.status);
  }

  // Check for error with status code
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    return retryableStatusCodes.includes(statusCode);
  }

  // Check error type
  const errorType = detectNetworkErrorType(error);

  // Client errors are not retryable
  if (errorType === "CLIENT_ERROR") {
    return false;
  }

  // All other network errors are retryable
  return (
    errorType === "TIMEOUT" ||
    errorType === "CONNECTION_REFUSED" ||
    errorType === "NETWORK_UNREACHABLE" ||
    errorType === "SERVER_ERROR" ||
    errorType === "RATE_LIMITED" ||
    errorType === "UNKNOWN"
  );
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitterFactor: number,
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Apply jitter: delay * (1 ± jitterFactor)
  const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor;
  const delayWithJitter = exponentialDelay * jitter;

  // Cap at max delay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic and exponential backoff
 *
 * @param operation - The operation to execute
 * @param options - Retry configuration options
 * @returns Result from operation with retry metadata
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  const errors: Error[] = [];

  const {
    maxRetries,
    baseDelay,
    maxDelay,
    jitterFactor,
    retryableStatusCodes,
    shouldRetry,
    onRetry,
  } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return {
        result,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
        errors,
      };
    } catch (error) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      errors.push(errorInstance);

      // Check if we should retry
      const isLastAttempt = attempt === maxRetries;
      const canRetry = isRetryableError(error, { retryableStatusCodes });
      const shouldAttemptRetry = shouldRetry(error, attempt);

      if (isLastAttempt || !canRetry || !shouldAttemptRetry) {
        throw error;
      }

      // Calculate delay and notify
      const delay = calculateRetryDelay(
        attempt,
        baseDelay,
        maxDelay,
        jitterFactor,
      );
      onRetry(error, attempt + 1, delay);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw errors[errors.length - 1] || new Error("Retry failed");
}

/**
 * Wrap a fetch request with retry logic
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry configuration options
 * @returns Fetch response with retry metadata
 */
export async function fetchWithRetry(
  url: string | URL | Request,
  options?: RequestInit,
  retryOptions?: RetryOptions,
): Promise<RetryResult<Response>> {
  return withRetry(async () => {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorType = detectNetworkErrorType(
        new Error(`HTTP ${response.status}`),
        response.status,
      );

      throw new NetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        errorType,
        {
          retryable: isRetryableError(response, retryOptions),
          statusCode: response.status,
        },
      );
    }

    return response;
  }, retryOptions);
}

// ============================================================================
// UNIFIED ERROR HANDLING INTERFACE
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Unified error information
 */
export interface UnifiedError {
  /** Error type/category */
  type: string;
  /** Error severity */
  severity: ErrorSeverity;
  /** Technical error message (may be sanitized) */
  message: string;
  /** User-friendly message */
  userMessage: string;
  /** Optional hint for the user */
  hint?: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Original error (if available) */
  cause?: Error;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a unified error from various error types
 */
export function createUnifiedError(
  error: Error | unknown,
  context?: Record<string, unknown>,
): UnifiedError {
  // NetworkError
  if (error instanceof NetworkError) {
    return {
      type: error.errorType,
      severity: error.retryable ? "medium" : "high",
      message: error.message,
      userMessage: getNetworkErrorUserMessage(error.errorType),
      hint: getNetworkErrorHint(error.errorType),
      retryable: error.retryable,
      cause: error,
      metadata: { statusCode: error.statusCode, ...context },
    };
  }

  // VirtualizationError
  if (error instanceof VirtualizationError) {
    return {
      type: "VIRTUALIZATION_ERROR",
      severity: "low",
      message: error.message,
      userMessage: "Display mode changed. Data is still accessible.",
      hint: error.fallbackAvailable
        ? "The system automatically switched to a simpler display mode."
        : "Please refresh the page or contact support.",
      retryable: false,
      cause: error,
      metadata: { fallbackAvailable: error.fallbackAvailable, ...context },
    };
  }

  // Generic Error
  return {
    type: "UNKNOWN_ERROR",
    severity: "high",
    message: error instanceof Error ? error.message : String(error),
    userMessage: "An unexpected error occurred.",
    hint: "Please try again or contact support if the problem persists.",
    retryable: false,
    cause: error instanceof Error ? error : undefined,
    metadata: context,
  };
}

/**
 * Get user-friendly message for network errors
 */
function getNetworkErrorUserMessage(type: NetworkErrorType): string {
  switch (type) {
    case "TIMEOUT":
      return "The request timed out. Please try again.";
    case "CONNECTION_REFUSED":
      return "Unable to connect to the server. Please check your connection.";
    case "NETWORK_UNREACHABLE":
      return "Network is unreachable. Please check your internet connection.";
    case "SERVER_ERROR":
      return "Server error occurred. Please try again later.";
    case "RATE_LIMITED":
      return "Too many requests. Please wait a moment and try again.";
    case "CLIENT_ERROR":
      return "Invalid request. Please check your input.";
    case "UNKNOWN":
    default:
      return "A network error occurred. Please try again.";
  }
}

/**
 * Get hint for network errors
 */
function getNetworkErrorHint(type: NetworkErrorType): string | undefined {
  switch (type) {
    case "TIMEOUT":
      return "The server is taking too long to respond. Try simplifying your query.";
    case "CONNECTION_REFUSED":
      return "Make sure the ClickHouse server is running and accessible.";
    case "NETWORK_UNREACHABLE":
      return "Check your network settings and firewall configuration.";
    case "SERVER_ERROR":
      return "The server encountered an internal error. Check server logs for details.";
    case "RATE_LIMITED":
      return "You've made too many requests. Wait a few seconds before trying again.";
    case "CLIENT_ERROR":
      return "The request was invalid. Check the API documentation for correct usage.";
    case "UNKNOWN":
    default:
      return undefined;
  }
}

/**
 * Log error with appropriate level
 */
export function logError(
  error: Error | unknown,
  context?: Record<string, unknown>,
): void {
  const unifiedError = createUnifiedError(error, context);

  const logData = {
    type: unifiedError.type,
    severity: unifiedError.severity,
    message: unifiedError.message,
    retryable: unifiedError.retryable,
    timestamp: new Date().toISOString(),
    ...unifiedError.metadata,
  };

  switch (unifiedError.severity) {
    case "critical":
      console.error("[CRITICAL ERROR]", logData);
      break;
    case "high":
      console.error("[ERROR]", logData);
      break;
    case "medium":
      console.warn("[WARNING]", logData);
      break;
    case "low":
      console.info("[INFO]", logData);
      break;
  }
}

// ============================================================================
// ERROR BOUNDARY HELPERS
// ============================================================================

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: UnifiedError | null;
}

/**
 * Create initial error boundary state
 */
export function createErrorBoundaryState(): ErrorBoundaryState {
  return {
    hasError: false,
    error: null,
    errorInfo: null,
  };
}

/**
 * Handle error in error boundary
 */
export function handleErrorBoundary(
  error: Error,
  context?: Record<string, unknown>,
): ErrorBoundaryState {
  const unifiedError = createUnifiedError(error, context);
  logError(error, context);

  return {
    hasError: true,
    error,
    errorInfo: unifiedError,
  };
}

/**
 * Reset error boundary state
 */
export function resetErrorBoundary(): ErrorBoundaryState {
  return createErrorBoundaryState();
}
