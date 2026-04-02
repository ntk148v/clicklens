/**
 * Validation Helper Utilities
 *
 * Provides reusable validation helpers for API routes.
 */

import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

export interface ValidationError {
  code: number;
  message: string;
  type: string;
  userMessage: string;
  details?: unknown;
}

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: ValidationError;
}

function getFirstErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return issues?.[0]?.message || "Validation failed";
  }
  return "Validation failed";
}

function getErrorDetails(error: unknown): unknown {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: (string | number | symbol)[]; message: string }> }).issues;
    return issues?.map((e) => ({
      path: e.path.map(String).join("."),
      message: e.message,
    }));
  }
  return undefined;
}

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
): ValidationResult<T> | ValidationFailure {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const firstErrorMessage = getFirstErrorMessage(result.error);

  return {
    success: false,
    error: {
      code: 400,
      message: firstErrorMessage,
      type: "VALIDATION_ERROR",
      userMessage: `Invalid request: ${firstErrorMessage}`,
      details: getErrorDetails(result.error),
    },
  };
}

/**
 * Create a NextResponse for validation errors
 */
export function validationErrorResponse(
  validation: ValidationFailure,
): NextResponse {
  return NextResponse.json(
    { success: false, error: validation.error },
    { status: validation.error.code },
  );
}

/**
 * Validate and return early pattern for API routes
 */
export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<ValidationResult<T> | ValidationFailure> {
  try {
    const body = await request.json();
    return validateBody(schema, body);
  } catch {
    return {
      success: false,
      error: {
        code: 400,
        message: "Invalid JSON body",
        type: "BAD_REQUEST",
        userMessage: "Request body must be valid JSON",
      },
    };
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | string[] | undefined>,
): ValidationResult<T> | ValidationFailure {
  const stringParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      stringParams[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      stringParams[key] = value[0];
    }
  }

  const result = schema.safeParse(stringParams);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const firstErrorMessage = getFirstErrorMessage(result.error);

  return {
    success: false,
    error: {
      code: 400,
      message: firstErrorMessage,
      type: "VALIDATION_ERROR",
      userMessage: `Invalid query parameters: ${firstErrorMessage}`,
    },
  };
}
