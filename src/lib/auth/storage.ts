/**
 * Server-side session storage
 *
 * Replaces client-side storage of sensitive credentials.
 * Stores user session data in-memory, keyed by a random session ID.
 *
 * NOTE: This is an in-memory store. Sessions are lost on server restart.
 * For multi-instance deployments, this should be replaced with Redis.
 */

export interface UserSession {
  username: string;
  password: string;
  host?: string;
  database?: string;
}

interface SessionEntry {
  user: UserSession;
  expiresAt: number;
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

  sessionStore.set(sessionId, { user, expiresAt });
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

  return entry.user;
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
