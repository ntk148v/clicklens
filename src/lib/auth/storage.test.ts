import { describe, test, expect, beforeEach } from "bun:test";
import {
  createSession,
  getSessionUser,
  destroySession,
  clearAllSessions,
  getActiveSessionCount,
} from "./storage";

describe("Session Storage", () => {
  beforeEach(() => {
    clearAllSessions();
  });

  const mockUser = {
    username: "testuser",
    password: "securepassword",
    host: "localhost",
  };

  test("creates and retrieves session", () => {
    const sessionId = createSession(mockUser);
    expect(sessionId).toBeDefined();

    const retrieved = getSessionUser(sessionId);
    expect(retrieved).toEqual(mockUser);
  });

  test("destroys session", () => {
    const sessionId = createSession(mockUser);
    expect(getSessionUser(sessionId)).toBeDefined();

    destroySession(sessionId);
    expect(getSessionUser(sessionId)).toBeNull();
  });

  test("handles missing session", () => {
    expect(getSessionUser("non-existent-id")).toBeNull();
    // Should not throw
    destroySession("non-existent-id");
  });

  test("manages multiple sessions", () => {
    const id1 = createSession({ ...mockUser, username: "user1" });
    const id2 = createSession({ ...mockUser, username: "user2" });

    expect(getActiveSessionCount()).toBe(2);
    expect(getSessionUser(id1)?.username).toBe("user1");
    expect(getSessionUser(id2)?.username).toBe("user2");

    destroySession(id1);
    expect(getActiveSessionCount()).toBe(1);
    expect(getSessionUser(id1)).toBeNull();
    expect(getSessionUser(id2)).toBeDefined();
  });
});
