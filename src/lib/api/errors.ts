/**
 * Standardized API error response utilities
 *
 * All API routes should use these utilities for consistent error handling.
 */

import { NextResponse } from "next/server";
import { isClickHouseError, type ClickHouseError } from "@/lib/clickhouse";

/**
 * Error types for categorizing API errors
 */
export type ApiErrorType =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "QUERY_ERROR"
  | "INTERNAL_ERROR";

/**
 * Structured API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    type: ApiErrorType;
    userMessage: string;
  };
}

/**
 * Success response wrapper
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Create an error response with consistent structure
 */
export function apiError(
  code: number,
  type: ApiErrorType,
  message: string,
  userMessage?: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code,
        message,
        type,
        userMessage: userMessage ?? message,
      },
    },
    { status: code },
  );
}

/**
 * Common error responses
 */
export const ApiErrors = {
  /** 401 - User is not authenticated */
  unauthorized: (message = "Not authenticated") =>
    apiError(401, "AUTH_REQUIRED", message, "Please log in to continue"),

  /** 403 - User lacks permission */
  forbidden: (message = "Permission denied") =>
    apiError(
      403,
      "FORBIDDEN",
      message,
      "You don't have permission to perform this action",
    ),

  /** 400 - Invalid request parameters */
  badRequest: (message: string) =>
    apiError(400, "VALIDATION_ERROR", message, message),

  /** 404 - Resource not found */
  notFound: (resource = "Resource") =>
    apiError(
      404,
      "NOT_FOUND",
      `${resource} not found`,
      `${resource} not found`,
    ),

  /** 500 - Internal server error */
  internal: (message = "Internal server error") =>
    apiError(500, "INTERNAL_ERROR", message, "An unexpected error occurred"),

  /** Convert any error to a proper response */
  fromError: (error: unknown, fallbackMessage = "An error occurred") => {
    if (isClickHouseError(error)) {
      const chError = error as ClickHouseError;
      return apiError(
        500,
        "QUERY_ERROR",
        chError.message,
        chError.userMessage ?? chError.message,
      );
    }

    if (error instanceof Error) {
      const isProduction = process.env.NODE_ENV === "production";
      const message = isProduction ? fallbackMessage : error.message;
      return apiError(500, "INTERNAL_ERROR", message, fallbackMessage);
    }

    const isProduction = process.env.NODE_ENV === "production";
    const message = isProduction ? fallbackMessage : String(error);
    return apiError(500, "INTERNAL_ERROR", message, fallbackMessage);
  },
} as const;

/**
 * Create a success response with consistent structure
 */
export function apiSuccess<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true as const,
    data,
  });
}
