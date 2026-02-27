import { describe, expect, test, mock, beforeEach } from "bun:test";
import { checkPermission, type Permission } from "./authorization";
import { NextResponse } from "next/server";

// Mock dependencies
const mockGetSession = mock();
const mockGetSessionClickHouseConfig = mock();
const mockCreateClient = mock();
const mockIsLensUserConfigured = mock();
const mockGetLensConfig = mock();
const mockEscapeSqlString = mock((s: string) => s);

// Mock modules
mock.module("./index", () => ({
  getSession: mockGetSession,
  getSessionClickHouseConfig: mockGetSessionClickHouseConfig,
}));

mock.module("@/lib/clickhouse", () => ({
  createClient: mockCreateClient,
  isLensUserConfigured: mockIsLensUserConfigured,
  getLensConfig: mockGetLensConfig,
}));

mock.module("@/lib/clickhouse/utils", () => ({
  escapeSqlString: mockEscapeSqlString,
}));

describe("checkPermission", () => {
  const mockClient = {
    query: mock(),
  };

  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSessionClickHouseConfig.mockReset();
    mockCreateClient.mockReset();
    mockIsLensUserConfigured.mockReset();
    mockGetLensConfig.mockReset();
    mockClient.query.mockReset();

    mockCreateClient.mockReturnValue(mockClient);
    mockIsLensUserConfigured.mockReturnValue(true);
    mockGetLensConfig.mockReturnValue({});
  });

  test("should return 401 if not authenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await checkPermission("canManageUsers");
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(401);
  });

  test("should return 401 if no config", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true, user: { name: "test" } });
    mockGetSessionClickHouseConfig.mockResolvedValue(null);
    const response = await checkPermission("canManageUsers");
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(401);
  });

  test("should return 403 if permission denied", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true, user: { name: "test" } });
    mockGetSessionClickHouseConfig.mockResolvedValue({ username: "test" });

    // Mock getEffectiveRoles (empty)
    mockClient.query.mockResolvedValueOnce({ data: [] });
    // Mock checkGlobalAccess (false) - returns 0 count
    mockClient.query.mockResolvedValueOnce({ data: [] }); // roles query
    mockClient.query.mockResolvedValueOnce({ data: [{ cnt: 0 }] }); // global check
    // Mock specific permission check (fail)
    mockClient.query.mockRejectedValue(new Error("Denied"));

    const response = await checkPermission("canManageUsers");
    expect(response).toBeInstanceOf(NextResponse);
    expect(response?.status).toBe(403);
  });

  test("should return null if permission granted via role", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true, user: { name: "test" } });
    mockGetSessionClickHouseConfig.mockResolvedValue({ username: "test" });

    // Mock getEffectiveRoles (has role)
    mockClient.query.mockResolvedValueOnce({
      data: [{ user_name: "test", granted_role_name: "clicklens_user_admin" }],
    });

    const response = await checkPermission("canManageUsers");
    expect(response).toBeNull();
  });

  test("should return null if permission granted via global access", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true, user: { name: "test" } });
    mockGetSessionClickHouseConfig.mockResolvedValue({ username: "test" });

    // Mock getEffectiveRoles (empty)
    mockClient.query.mockResolvedValueOnce({ data: [] });
    // Mock checkGlobalAccess (true)
    mockClient.query.mockResolvedValueOnce({ data: [] }); // roles
    mockClient.query.mockResolvedValueOnce({ data: [{ cnt: 1 }] }); // global check

    const response = await checkPermission("canBrowseTables");
    expect(response).toBeNull();
  });
});
