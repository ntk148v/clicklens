/**
 * CSRF Protection Utilities
 *
 * Provides CSRF token generation and validation for state-changing operations.
 * Uses double-submit cookie pattern with cryptographically secure tokens.
 */

import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const CSRF_COOKIE_NAME = "clicklens-csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a new CSRF token and set it in a cookie
 * @returns The generated token to be sent to the client
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DISABLE_SECURE_COOKIES !== "true",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return token;
}

/**
 * Validate CSRF token from request header against cookie
 * @param request The incoming request
 * @returns true if valid, false otherwise
 */
export async function validateCsrfToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const cookieBuffer = Buffer.from(cookieToken, "hex");
    const headerBuffer = Buffer.from(headerToken, "hex");

    if (cookieBuffer.length !== headerBuffer.length) {
      return false;
    }

    return timingSafeEqual(cookieBuffer, headerBuffer);
  } catch {
    return false;
  }
}

/**
 * Require CSRF token validation for state-changing operations
 * Returns null if valid, or a NextResponse error if invalid
 *
 * Usage:
 *   const csrfError = await requireCsrf(request);
 *   if (csrfError) return csrfError;
 */
export async function requireCsrf(
  request: Request,
): Promise<NextResponse<{ success: false; error: string }> | null> {
  // Only require CSRF for state-changing methods
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const isValid = await validateCsrfToken(request);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing CSRF token" },
        { status: 403 },
      );
    }
  }
  return null;
}

/**
 * Clear CSRF cookie (useful for logout)
 */
export async function clearCsrfToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}
