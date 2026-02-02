/**
 * Query Error Handling Module
 *
 * Provides secure, environment-aware error handling for ClickHouse query errors.
 * - Sanitizes sensitive information in production
 * - Categorizes errors for appropriate handling
 * - Logs full details server-side for debugging
 */

// Error categories for different handling strategies
export type QueryErrorCategory =
  | "SYNTAX" // SQL syntax errors - safe to show details
  | "SCHEMA" // Unknown table/column/database - safe to show
  | "TYPE" // Type mismatches - safe to show
  | "PERMISSION" // Access denied - partial info only
  | "RESOURCE" // Memory/timeout limits - partial info
  | "FUNCTION" // Unknown function - sanitize (could be probing)
  | "SYSTEM" // Internal errors - generic only
  | "NETWORK" // Connection issues - partial info
  | "UNKNOWN"; // Uncategorized - generic only

// Structured error response
export interface QueryError {
  code: number;
  type: string;
  category: QueryErrorCategory;
  message: string; // Technical message (may be sanitized in prod)
  userMessage: string; // User-friendly message
  hint?: string; // Optional helpful hint
}

// Sensitive patterns to detect and sanitize
const SENSITIVE_PATTERNS = {
  // File paths (Unix and Windows)
  filePaths: [
    /\/etc\/[^\s'")]+/gi,
    /\/var\/[^\s'")]+/gi,
    /\/home\/[^\s'")]+/gi,
    /\/root\/[^\s'")]+/gi,
    /\/tmp\/[^\s'")]+/gi,
    /\/proc\/[^\s'")]+/gi,
    /\/sys\/[^\s'")]+/gi,
    /C:\\[^\s'"]+/gi,
    /D:\\[^\s'"]+/gi,
  ],
  // IP addresses (but not version numbers like 1.2.3)
  ipAddresses: [/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g],
  // Connection strings and credentials
  credentials: [
    /password\s*[=:]\s*['"]?[^\s'"]+/gi,
    /secret\s*[=:]\s*['"]?[^\s'"]+/gi,
    /api[_-]?key\s*[=:]\s*['"]?[^\s'"]+/gi,
    /token\s*[=:]\s*['"]?[^\s'"]+/gi,
  ],
  // Stack traces and internal paths
  stackTraces: [
    /at\s+[\w.]+\s+\([^)]+:\d+:\d+\)/g,
    /node_modules\/[^\s]+/g,
    /\.node:\d+/g,
  ],
  // Database connection details
  connectionDetails: [/host\s*[=:]\s*['"]?[^\s'"]+/gi, /port\s*[=:]\s*\d+/gi],
};

// Patterns that indicate security probing attempts
const PROBING_PATTERNS = [
  /file\s*\(/i, // file() function attempts
  /url\s*\(/i, // url() function attempts
  /input\s*\(/i, // input() function
  /s3\s*\(/i, // S3 function
  /hdfs\s*\(/i, // HDFS function
  /mysql\s*\(/i, // MySQL table function
  /postgresql\s*\(/i, // PostgreSQL table function
  /odbc\s*\(/i, // ODBC function
  /jdbc\s*\(/i, // JDBC function
  /remote\s*\(/i, // remote() function
  /cluster\s*\(/i, // cluster() function
  /\/etc\//i, // etc path
  /\/proc\//i, // proc filesystem
  /\/passwd/i, // passwd file
  /\/shadow/i, // shadow file
  /\.\.\//, // Path traversal
];

// Error code to category mapping for ClickHouse errors
const ERROR_CODE_CATEGORIES: Record<string, QueryErrorCategory> = {
  // Syntax errors (codes 40-70 range roughly)
  "62": "SYNTAX", // SYNTAX_ERROR
  "47": "SYNTAX", // UNKNOWN_IDENTIFIER
  "184": "SYNTAX", // CANNOT_PARSE_TEXT

  // Schema errors
  "60": "SCHEMA", // UNKNOWN_TABLE
  "81": "SCHEMA", // UNKNOWN_DATABASE
  "16": "SCHEMA", // UNKNOWN_COLUMN
  "36": "SCHEMA", // NO_SUCH_COLUMN_IN_TABLE

  // Type errors
  "53": "TYPE", // TYPE_MISMATCH
  "70": "TYPE", // CANNOT_CONVERT_TYPE

  // Permission errors
  "497": "PERMISSION", // ACCESS_DENIED
  "516": "PERMISSION", // NOT_ENOUGH_PRIVILEGES

  // Resource errors
  "241": "RESOURCE", // MEMORY_LIMIT_EXCEEDED
  "159": "RESOURCE", // TIMEOUT_EXCEEDED
  "160": "RESOURCE", // TOO_SLOW
  "252": "RESOURCE", // TOO_MANY_PARTS

  // Function errors
  "46": "FUNCTION", // UNKNOWN_FUNCTION
  "44": "FUNCTION", // ILLEGAL_TYPE_OF_ARGUMENT
};

/**
 * Check if the error message contains potential security probing patterns
 */
const containsProbingPatterns = (message: string): boolean => {
  return PROBING_PATTERNS.some((pattern) => pattern.test(message));
};

/**
 * Sanitize error message by removing sensitive patterns
 */
export const sanitizeErrorMessage = (message: string): string => {
  let sanitized = message;

  // Replace file paths with placeholder
  for (const pattern of SENSITIVE_PATTERNS.filePaths) {
    sanitized = sanitized.replace(pattern, "[PATH_REDACTED]");
  }

  // Replace IP addresses
  for (const pattern of SENSITIVE_PATTERNS.ipAddresses) {
    sanitized = sanitized.replace(pattern, "[IP_REDACTED]");
  }

  // Replace credentials
  for (const pattern of SENSITIVE_PATTERNS.credentials) {
    sanitized = sanitized.replace(pattern, "[CREDENTIALS_REDACTED]");
  }

  // Remove stack traces
  for (const pattern of SENSITIVE_PATTERNS.stackTraces) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Replace connection details
  for (const pattern of SENSITIVE_PATTERNS.connectionDetails) {
    sanitized = sanitized.replace(pattern, "[CONNECTION_REDACTED]");
  }

  // Clean up any double spaces or empty lines left behind
  sanitized = sanitized.replace(/\s{2,}/g, " ").trim();

  return sanitized;
};

/**
 * Extract ClickHouse error code from error message
 * ClickHouse errors often look like: "Code: 60. DB::Exception: ..."
 */
const extractErrorCode = (message: string): string | null => {
  const match = message.match(/Code:\s*(\d+)/i);
  return match ? match[1] : null;
};

/**
 * Categorize error based on error code and message content
 */
export const categorizeClickHouseError = (
  message: string,
  code?: string | number,
): QueryErrorCategory => {
  const errorCode = code?.toString() || extractErrorCode(message);

  // Check code-based category first
  if (errorCode && ERROR_CODE_CATEGORIES[errorCode]) {
    return ERROR_CODE_CATEGORIES[errorCode];
  }

  const lowerMessage = message.toLowerCase();

  // Check for probing attempts - treat as SYSTEM to hide details
  if (containsProbingPatterns(message)) {
    return "SYSTEM";
  }

  // Syntax errors
  if (
    lowerMessage.includes("syntax error") ||
    lowerMessage.includes("parse error") ||
    lowerMessage.includes("unexpected") ||
    lowerMessage.includes("cannot parse")
  ) {
    return "SYNTAX";
  }

  // Schema errors
  if (
    lowerMessage.includes("unknown table") ||
    lowerMessage.includes("table doesn't exist") ||
    lowerMessage.includes("unknown database") ||
    lowerMessage.includes("database doesn't exist") ||
    lowerMessage.includes("unknown column") ||
    lowerMessage.includes("missing columns")
  ) {
    return "SCHEMA";
  }

  // Type errors
  if (
    lowerMessage.includes("type mismatch") ||
    lowerMessage.includes("illegal type") ||
    lowerMessage.includes("cannot convert")
  ) {
    return "TYPE";
  }

  // Permission errors
  if (
    lowerMessage.includes("access denied") ||
    lowerMessage.includes("not enough privileges") ||
    lowerMessage.includes("permission denied")
  ) {
    return "PERMISSION";
  }

  // Resource errors
  if (
    lowerMessage.includes("memory limit") ||
    lowerMessage.includes("out of memory") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("too many parts") ||
    lowerMessage.includes("too many rows")
  ) {
    return "RESOURCE";
  }

  // Function errors
  if (
    lowerMessage.includes("unknown function") ||
    lowerMessage.includes("function") // general function issues
  ) {
    return "FUNCTION";
  }

  // Network errors
  if (
    lowerMessage.includes("connection refused") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("cannot connect")
  ) {
    return "NETWORK";
  }

  return "UNKNOWN";
};

/**
 * Get user-friendly message based on error category
 */
const getCategoryUserMessage = (category: QueryErrorCategory): string => {
  switch (category) {
    case "SYNTAX":
      return "SQL syntax error in your query";
    case "SCHEMA":
      return "Database object not found";
    case "TYPE":
      return "Data type error in query";
    case "PERMISSION":
      return "Permission denied for this operation";
    case "RESOURCE":
      return "Query resource limit exceeded";
    case "FUNCTION":
      return "Function error in query";
    case "NETWORK":
      return "Connection error";
    case "SYSTEM":
      return "Server error occurred";
    case "UNKNOWN":
    default:
      return "Query execution failed";
  }
};

/**
 * Get helpful hint based on error category
 */
const getCategoryHint = (
  category: QueryErrorCategory,
  message: string,
): string | undefined => {
  switch (category) {
    case "SYNTAX":
      return "Check your SQL syntax. Common issues: missing quotes, commas, or parentheses.";
    case "SCHEMA":
      if (message.toLowerCase().includes("table")) {
        return "Verify the table name and ensure you're connected to the correct database.";
      }
      if (message.toLowerCase().includes("column")) {
        return "Check column names in your query against the table schema.";
      }
      return "Verify that the database object exists.";
    case "TYPE":
      return "Ensure data types are compatible. Use CAST() or toXxx() functions for conversion.";
    case "PERMISSION":
      return "Contact your administrator if you need access to this resource.";
    case "RESOURCE":
      if (message.toLowerCase().includes("memory")) {
        return "Try limiting your result set with LIMIT or adding WHERE conditions.";
      }
      if (message.toLowerCase().includes("timeout")) {
        return "The query is taking too long. Try optimizing or adding indexes.";
      }
      return "Try reducing the scope of your query.";
    case "FUNCTION":
      return "Check the function name and arguments. See ClickHouse documentation for available functions.";
    case "NETWORK":
      return "Check your network connection and ClickHouse server status.";
    default:
      return undefined;
  }
};

/**
 * Check if running in development mode
 */
const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === "development";
};

/**
 * Format query error with appropriate detail level based on environment
 *
 * @param error - The original error (Error object or message string)
 * @param code - Optional error code
 * @param fullLog - If true, log full details to console (for server-side)
 */
export const formatQueryError = (
  error: Error | string,
  code?: string | number,
  fullLog: boolean = true,
): QueryError => {
  const originalMessage = error instanceof Error ? error.message : error;
  const errorCode =
    code?.toString() || extractErrorCode(originalMessage) || "0";
  const category = categorizeClickHouseError(originalMessage, errorCode);

  // Always log full details server-side for debugging
  if (fullLog) {
    console.error("[QueryError]", {
      category,
      code: errorCode,
      originalMessage,
      timestamp: new Date().toISOString(),
    });
  }

  // Categories that are safe to show full details (user errors, not security issues)
  const safeCategories: QueryErrorCategory[] = ["SYNTAX", "SCHEMA", "TYPE"];
  const showFullDetails = isDevelopment() || safeCategories.includes(category);

  // For function errors, sanitize but show partial info
  const showPartialDetails: QueryErrorCategory[] = [
    "FUNCTION",
    "RESOURCE",
    "NETWORK",
    "PERMISSION",
  ];
  const shouldSanitize =
    showPartialDetails.includes(category) || !showFullDetails;

  // Determine the message to show
  let displayMessage: string;
  if (showFullDetails) {
    // Safe to show full details
    displayMessage = originalMessage;
  } else if (shouldSanitize && showPartialDetails.includes(category)) {
    // Sanitize but show some details
    displayMessage = sanitizeErrorMessage(originalMessage);
  } else {
    // Generic message only (SYSTEM, UNKNOWN in production)
    displayMessage = getCategoryUserMessage(category);
  }

  return {
    code: parseInt(errorCode, 10) || 0,
    type: category,
    category,
    message: displayMessage,
    userMessage: getCategoryUserMessage(category),
    hint: getCategoryHint(category, originalMessage),
  };
};

/**
 * Format HTTP error response
 */
export const formatHttpError = (status: number): QueryError => {
  const categoryMap: Record<number, QueryErrorCategory> = {
    400: "SYNTAX",
    401: "PERMISSION",
    403: "PERMISSION",
    404: "SCHEMA",
    408: "RESOURCE",
    429: "RESOURCE",
    500: "SYSTEM",
    502: "NETWORK",
    503: "NETWORK",
    504: "RESOURCE",
  };

  const userMessageMap: Record<number, string> = {
    400: "Invalid request",
    401: "Authentication required",
    403: "Permission denied",
    404: "Resource not found",
    408: "Request timeout",
    429: "Too many requests",
    500: "Server error",
    502: "Unable to reach server",
    503: "Service unavailable",
    504: "Gateway timeout",
  };

  const category = categoryMap[status] || "UNKNOWN";
  const userMessage = userMessageMap[status] || `Error (${status})`;

  return {
    code: status,
    type: "HTTP_ERROR",
    category,
    message: userMessage,
    userMessage,
    hint: status === 401 ? "Please log in again." : undefined,
  };
};
