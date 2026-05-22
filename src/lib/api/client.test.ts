import {
  describe,
  it,
  expect,
  mock,
  beforeEach,
  afterEach,
  jest,
} from "bun:test";
import { fetchClient } from "./client";
import { toast } from "@/components/ui/use-toast";

// Mock imports
mock.module("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

describe("fetchClient", () => {
  // Save original global.fetch
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    // Reset mocks
    (toast as jest.Mock).mockClear();

    // Mock window.location
    global.window = {
      location: {
        href: "",
        pathname: "/current-path",
        search: "?query=1",
      },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.window = originalWindow;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  it("should return data on successful response (200)", async () => {
    const mockData = { id: 1, name: "test" };
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      } as Response),
    );
    global.fetch = fetchMock;

    const result = await fetchClient("/api/test");
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("should prefix API paths when NEXT_PUBLIC_BASE_PATH is set", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/lens";
    const mockData = { ok: true };
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      } as Response),
    );
    global.fetch = fetchMock;

    const result = await fetchClient("/api/test");
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalledWith("/lens/api/test", undefined);
  });

  it("should return data unwrapped if wrapped in { success: true, data: ... }", async () => {
    const mockData = { id: 1, name: "test" };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: mockData }),
      } as Response),
    );

    const result = await fetchClient("/api/test");
    expect(result).toEqual(mockData);
  });

  it("should handle 401 Unauthorized by toasting and redirecting", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ error: { message: "Auth required" } }),
      } as Response),
    );

    try {
      await fetchClient("/api/test");
    } catch (error) {
      expect((error as { status: number }).status).toBe(401);
    }

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Session Expired",
      }),
    );

    expect(global.window.location.href).toContain("/login");
  });

  it("should redirect to login under base path on 401 when NEXT_PUBLIC_BASE_PATH is set", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/lens";
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ error: { message: "Auth required" } }),
      } as Response),
    );

    try {
      await fetchClient("/api/test");
    } catch (error) {
      expect((error as { status: number }).status).toBe(401);
    }

    expect(global.window.location.href).toContain("/lens/login");
  });

  it("should handle 403 Forbidden by toasting 'Permission Denied'", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: { message: "No access" } }),
      } as Response),
    );

    try {
      await fetchClient("/api/test");
    } catch (error) {
      expect((error as { status: number }).status).toBe(403);
    }

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Permission Denied",
      }),
    );
  });

  it("should handle 500 Server Error by toasting 'Server Error'", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: () => Promise.resolve({ error: { message: "Crash" } }),
      } as Response),
    );

    try {
      await fetchClient("/api/test");
    } catch (error) {
      expect((error as { status: number }).status).toBe(500);
    }

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Server Error",
      }),
    );
  });

  it("should handle 404 Not Found by toasting 'Resource Not Found'", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: { message: "Missing" } }),
      } as Response),
    );

    try {
      await fetchClient("/api/test");
    } catch (error) {
      expect((error as { status: number }).status).toBe(404);
    }

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Resource Not Found",
      }),
    );
  });

  it("should handle 429 Too Many Requests", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: () => Promise.resolve({}),
      } as Response),
    );

    try {
      await fetchClient("/api/test");
    } catch (error) {
      expect((error as { status: number }).status).toBe(429);
    }

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Too Many Requests",
      }),
    );
  });
});
