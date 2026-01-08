/**
 * Session configuration for iron-session
 *
 * Session stores only user credentials (username/password)
 * Connection details (host, port, protocol) come from environment
 */

import { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
  // User credentials only - connection info from env
  user?: {
    username: string;
    password: string;
  };
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "complex_password_at_least_32_characters_long_for_security",
  cookieName: "clicklens-session",
  cookieOptions: {
    // secure: true in production, unless disabled explicitly (e.g. for non-https deployments)
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DISABLE_SECURE_COOKIES !== "true",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};
