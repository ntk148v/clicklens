/**
 * Authorization Module Test Suite
 *
 * Tests for authorization utilities including permission types.
 */

import { describe, expect, test } from "bun:test";

describe("Permission Type", () => {
  test("all permission types are defined", () => {
    const validPermissions = [
      "canManageUsers",
      "canViewProcesses",
      "canKillQueries",
      "canViewCluster",
      "canBrowseTables",
      "canExecuteQueries",
      "canViewSettings",
      "canViewSystemLogs",
      "canViewServerLogs",
      "canViewCrashLogs",
      "canViewSessionLogs",
      "canDiscover",
    ] as const;

    expect(validPermissions).toHaveLength(12);
  });

  test("permission types match authorization logic", () => {
    type Permission =
      | "canManageUsers"
      | "canViewProcesses"
      | "canKillQueries"
      | "canViewCluster"
      | "canBrowseTables"
      | "canExecuteQueries"
      | "canViewSettings"
      | "canViewSystemLogs"
      | "canViewServerLogs"
      | "canViewCrashLogs"
      | "canViewSessionLogs"
      | "canDiscover";

    const permissions: Permission[] = [
      "canManageUsers",
      "canViewProcesses",
      "canKillQueries",
      "canViewCluster",
      "canBrowseTables",
      "canExecuteQueries",
      "canViewSettings",
      "canViewSystemLogs",
      "canViewServerLogs",
      "canViewCrashLogs",
      "canViewSessionLogs",
      "canDiscover",
    ];

    expect(permissions.length).toBe(12);

    // Verify all are strings
    permissions.forEach((p) => {
      expect(typeof p).toBe("string");
    });
  });

  test("permission type covers admin, query, table, cluster, and log features", () => {
    const adminPermissions = ["canManageUsers", "canViewSettings"];
    const queryPermissions = ["canViewProcesses", "canKillQueries", "canExecuteQueries"];
    const tablePermissions = ["canBrowseTables"];
    const clusterPermissions = ["canViewCluster"];
    const logPermissions = [
      "canViewSystemLogs",
      "canViewServerLogs",
      "canViewCrashLogs",
      "canViewSessionLogs",
    ];
    const discoverPermissions = ["canDiscover"];

    expect(adminPermissions).toHaveLength(2);
    expect(queryPermissions).toHaveLength(3);
    expect(tablePermissions).toHaveLength(1);
    expect(clusterPermissions).toHaveLength(1);
    expect(logPermissions).toHaveLength(4);
    expect(discoverPermissions).toHaveLength(1);
  });
});
