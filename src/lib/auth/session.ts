/**
 * Session configuration for iron-session
 *
 * Session stores only user credentials (username/password)
 * Connection details (host, port, protocol) come from environment
 *
 * SECURITY NOTE: Currently stores ClickHouse credentials in the session.
 * This is encrypted by iron-session, but ideally should use token-based auth.
 * See: https://github.com/ntk148v/clicklens/issues/security for future improvements.
 */

import { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
  // Reference to server-side session data
  sessionId?: string;

  // Legacy fields (kept for type compatibility during migration, but not used in new sessions)
  user?: {
    username: string;
    password: string;
    host?: string;
    database?: string;
  };
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

/**
 * Get the session secret from environment.
 * In production, SESSION_SECRET is required and must be at least 32 characters.
 * In development, a fallback is used but a warning is logged.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (secret) {
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be at least 32 characters long for security",
      );
    }
    return secret;
  }

  if (isProduction) {
    throw new Error(
      "SESSION_SECRET environment variable is required in production. " +
        "Please set a secure random string of at least 32 characters.",
    );
  }

  // Development fallback with warning
  console.warn(
    "\x1b[33m%s\x1b[0m", // Yellow color
    "[ClickLens Security Warning] SESSION_SECRET not set. " +
      "Using insecure fallback for development. " +
      "Set SESSION_SECRET in production!",
  );

  return "complex_password_at_least_32_characters_long_for_security";
}

export const sessionOptions: SessionOptions = {
  password: getSessionSecret(),
  cookieName: "clicklens-session",
  cookieOptions: {
    // secure: true in production, unless disabled explicitly (e.g. for non-https deployments)
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DISABLE_SECURE_COOKIES !== "true"
        ? true
        : (process.env.NODE_ENV === "production" &&
            console.warn(
              "\x1b[33m%s\x1b[0m",
              "[Security Warning] Secure cookies disabled in production (DISABLE_SECURE_COOKIES=true)",
            ),
          false),
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};
