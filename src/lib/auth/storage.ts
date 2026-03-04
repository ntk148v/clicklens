/**
 * Server-side session storage
 *
 * Replaces client-side storage of sensitive credentials.
 * Stores user session data in-memory, keyed by a random session ID.
 *
 * NOTE: This is an in-memory store. Sessions are lost on server restart.
 * For multi-instance deployments, this should be replaced with Redis.
 */

import crypto from "crypto";

export interface UserSession {
  username: string;
  password: string;
  host?: string;
  database?: string;
}

interface EncryptedPassword {
  ciphertext: string;
  iv: string;
  authTag: string;
}

interface SessionEntry {
  user: Omit<UserSession, "password">;
  encryptedPassword: EncryptedPassword;
  expiresAt: number;
}

const ALGORITHM = "aes-256-gcm";

function getSecretKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production for server-side session encryption.",
    );
  }
  return crypto
    .createHash("sha256")
    .update(secret || "development_fallback_secret_at_least_32_characters_long")
    .digest();
}

function encryptPassword(password: string): EncryptedPassword {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  let ciphertext = cipher.update(password, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  return { ciphertext, iv: iv.toString("base64"), authTag };
}

function decryptPassword(encrypted: EncryptedPassword): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getSecretKey(),
    Buffer.from(encrypted.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  let decrypted = decipher.update(encrypted.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// In-memory store: SessionID -> SessionEntry
const sessionStore = new Map<string, SessionEntry>();

// Configuration
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour

// Periodic cleanup
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of sessionStore.entries()) {
      if (now > entry.expiresAt) {
        sessionStore.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Store user session data on server
 * @returns sessionId
 */
export function createSession(user: UserSession): string {
  startCleanup();

  // Generate secure random Session ID
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  const { password, ...userWithoutPassword } = user;
  sessionStore.set(sessionId, {
    user: userWithoutPassword,
    encryptedPassword: encryptPassword(password),
    expiresAt,
  });
  return sessionId;
}

/**
 * Retrieve user session data
 */
export function getSessionUser(sessionId?: string): UserSession | null {
  if (!sessionId) return null;

  const entry = sessionStore.get(sessionId);
  if (!entry) return null;

  // Check expiration
  if (Date.now() > entry.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }

  // Extend session on activity? Optional.
  // For now, fixed TTL from login seems safer/simpler.

  try {
    const password = decryptPassword(entry.encryptedPassword);
    return { ...entry.user, password };
  } catch {
    console.error("Failed to decrypt session password for session:", sessionId);
    sessionStore.delete(sessionId);
    return null;
  }
}

/**
 * Update password for an existing session (e.g., after password change)
 */
export function updateSessionPassword(
  sessionId: string | undefined,
  newPassword: string,
): boolean {
  if (!sessionId) return false;

  const entry = sessionStore.get(sessionId);
  if (!entry) return false;

  if (Date.now() > entry.expiresAt) {
    sessionStore.delete(sessionId);
    return false;
  }

  entry.encryptedPassword = encryptPassword(newPassword);
  return true;
}

/**
 * Remove session (logout)
 */
export function destroySession(sessionId?: string): void {
  if (sessionId) {
    sessionStore.delete(sessionId);
  }
}

/**
 * Get active session count (for monitoring)
 */
export function getActiveSessionCount(): number {
  return sessionStore.size;
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions(): void {
  sessionStore.clear();
}
