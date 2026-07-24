import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import {
  buildConnectionUrl,
  getLensConfig,
  getUserConfig,
  buildAuthHeaders,
  isLensUserConfigured,
  type ClickHouseConfig,
  parseClusterRegistry,
  getConfiguredClusters,
  getDefaultClusterId,
  isClusterConfigured,
  $$resetDeprecationWarning,
} from "./config";

describe("clickhouse/config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CLICKHOUSE_CLUSTERS;
    delete process.env.CLICKHOUSE_HOST;
    delete process.env.CLICKHOUSE_PORT;
    delete process.env.CLICKHOUSE_SECURE;
    delete process.env.CLICKHOUSE_VERIFY;
    delete process.env.LENS_USER;
    delete process.env.LENS_PASSWORD;

    // Reset module-level deprecation flag
    $$resetDeprecationWarning();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("buildConnectionUrl", () => {
    test("builds HTTP URL", () => {
      expect(buildConnectionUrl({ host: "localhost", port: 8123, secure: false, verifySsl: true })).toBe("http://localhost:8123");
    });
    test("builds HTTPS URL", () => {
      expect(buildConnectionUrl({ host: "localhost", port: 8443, secure: true, verifySsl: true })).toBe("https://localhost:8443");
    });
    test("handles custom port", () => {
      expect(buildConnectionUrl({ host: "clickhouse.example.com", port: 9000, secure: false, verifySsl: true })).toBe("http://clickhouse.example.com:9000");
    });
  });

  describe("getLensConfig", () => {
    test("returns null for unknown cluster ID", () => {
      expect(getLensConfig("primary")).toBeNull();
    });
    test("returns null when no config at all", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((getLensConfig as any)()).toBeNull();
    });
    test("returns cluster config for known cluster", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "primary", label: "Primary", host: "primary.example.test", lensUser: "lens", lensPassword: "lens-password" }]);
      const config = getLensConfig("primary");
      expect(config!.host).toBe("primary.example.test");
      expect(config!.username).toBe("lens");
      expect(config!.database).toBe("default");
      expect(config!.clusterId).toBe("primary");
    });
    test("returns config from legacy env translation as default", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      process.env.LENS_USER = "legacy-lens";
      process.env.LENS_PASSWORD = "legacy-password";
      const config = getLensConfig("default");
      expect(config!.host).toBe("legacy.example.test");
      expect(config!.username).toBe("legacy-lens");
      expect(config!.clusterId).toBe("default");
    });
    test("returns null when legacy vars are partial", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      expect(getLensConfig("default")).toBeNull();
    });
    test("returns null when registry is empty array", () => {
      process.env.CLICKHOUSE_CLUSTERS = "[]";
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      process.env.LENS_USER = "lens";
      expect(getLensConfig("default")).toBeNull();
    });
    test("legacy vars with secure true use HTTPS port", () => {
      process.env.CLICKHOUSE_HOST = "secure.example.test";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pw";
      process.env.CLICKHOUSE_SECURE = "true";
      expect(getLensConfig("default")!.secure).toBe(true);
      expect(getLensConfig("default")!.port).toBe(8443);
    });
    test("legacy vars with custom port", () => {
      process.env.CLICKHOUSE_HOST = "custom.example.test";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pw";
      process.env.CLICKHOUSE_PORT = "9123";
      expect(getLensConfig("default")!.port).toBe(9123);
    });
    test("legacy verify_ssl false", () => {
      process.env.CLICKHOUSE_HOST = "noverify.example.test";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pw";
      process.env.CLICKHOUSE_VERIFY = "false";
      expect(getLensConfig("default")!.verifySsl).toBe(false);
    });
  });

  describe("getUserConfig", () => {
    test("returns null for unknown cluster", () => {
      expect(getUserConfig("nonexistent", { username: "user", password: "pass" })).toBeNull();
    });
    test("returns null when no config at all", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((getUserConfig as any)({ username: "user", password: "pass" })).toBeNull();
    });
    test("returns config with user credentials for known cluster", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "primary", label: "Primary", host: "primary.example.test", lensUser: "lens", lensPassword: "lens-pw" }]);
      const config = getUserConfig("primary", { username: "testuser", password: "testpass" });
      expect(config!.host).toBe("primary.example.test");
      expect(config!.username).toBe("testuser");
      expect(config!.clusterId).toBe("primary");
    });
    test("uses provided database", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "primary", label: "Primary", host: "primary.example.test", lensUser: "lens", lensPassword: "lens-pw" }]);
      expect(getUserConfig("primary", { username: "u", password: "p", database: "mydb" })!.database).toBe("mydb");
    });
    test("returns config from legacy env translation as default", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      process.env.LENS_USER = "lens";
      const config = getUserConfig("default", { username: "testuser", password: "testpass" });
      expect(config!.host).toBe("legacy.example.test");
      expect(config!.username).toBe("testuser");
    });
    test("returns null when legacy vars are partial", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      expect(getUserConfig("default", { username: "user", password: "pass" })).toBeNull();
    });
    test("inherits server connection settings from legacy", () => {
      process.env.CLICKHOUSE_HOST = "db.example.com";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pw";
      process.env.CLICKHOUSE_PORT = "8443";
      process.env.CLICKHOUSE_SECURE = "true";
      process.env.CLICKHOUSE_VERIFY = "false";
      const config = getUserConfig("default", { username: "user", password: "pass" });
      expect(config!.host).toBe("db.example.com");
      expect(config!.port).toBe(8443);
      expect(config!.secure).toBe(true);
      expect(config!.verifySsl).toBe(false);
    });
  });

  describe("buildAuthHeaders", () => {
    test("builds correct headers", () => {
      const config: ClickHouseConfig = { host: "localhost", port: 8123, secure: false, verifySsl: true, username: "admin", password: "secret", database: "mydb" };
      const h = buildAuthHeaders(config);
      expect(h["X-ClickHouse-User"]).toBe("admin");
      expect(h["X-ClickHouse-Key"]).toBe("secret");
      expect(h["X-ClickHouse-Database"]).toBe("mydb");
    });
    test("handles special characters", () => {
      const config: ClickHouseConfig = { host: "localhost", port: 8123, secure: false, verifySsl: true, username: "user@domain", password: "p@ss!", database: "my-db" };
      const h = buildAuthHeaders(config);
      expect(h["X-ClickHouse-User"]).toBe("user@domain");
      expect(h["X-ClickHouse-Key"]).toBe("p@ss!");
    });
  });

  describe("isLensUserConfigured", () => {
    test("returns false with no config", () => expect(isLensUserConfigured()).toBe(false));
    test("returns true when CLICKHOUSE_CLUSTERS is set", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "ch", label: "CH", host: "h", lensUser: "u", lensPassword: "p" }]);
      expect(isLensUserConfigured()).toBe(true);
    });
    test("returns true when legacy env vars are set", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      expect(isLensUserConfigured()).toBe(true);
    });
    test("returns false when empty registry overrides legacy", () => {
      process.env.CLICKHOUSE_CLUSTERS = "[]";
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      expect(isLensUserConfigured()).toBe(false);
    });
  });

  describe("multi-cluster registry", () => {
    test("one-entry registry is complete config", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "primary", label: "Primary", host: "primary.example.test", port: 8123, lensUser: "lens", lensPassword: "lens-pw" }]);
      expect(getConfiguredClusters()).toEqual([{ id: "primary", label: "Primary" }]);
      expect(getDefaultClusterId()).toBe("primary");
      expect(getLensConfig("primary")).toMatchObject({ host: "primary.example.test", username: "lens", clusterId: "primary" });
      expect(getUserConfig("primary", { username: "alice", password: "pw" })).toMatchObject({ username: "alice", clusterId: "primary" });
    });
    test("registry takes exclusive precedence", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      process.env.LENS_USER = "legacy-lens";
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "primary", label: "Primary", host: "primary.example.test", lensUser: "lens", lensPassword: "pw" }]);
      expect(getConfiguredClusters()).toEqual([{ id: "primary", label: "Primary" }]);
      expect(isClusterConfigured("default")).toBe(false);
      expect(getLensConfig("default")).toBeNull();
    });
    test("translates complete legacy config to deprecated default", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      process.env.CLICKHOUSE_PORT = "8443";
      process.env.CLICKHOUSE_SECURE = "true";
      process.env.CLICKHOUSE_VERIFY = "false";
      process.env.LENS_USER = "legacy-lens";
      process.env.LENS_PASSWORD = "legacy-pw";
      expect(getConfiguredClusters()).toEqual([{ id: "default", label: "Default" }]);
      expect(getLensConfig("default")).toMatchObject({ host: "legacy.example.test", port: 8443, secure: true, verifySsl: false, username: "legacy-lens", clusterId: "default" });
    });
    test("empty registry disables legacy fallback", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      process.env.LENS_USER = "legacy-lens";
      process.env.CLICKHOUSE_CLUSTERS = "[]";
      expect(getConfiguredClusters()).toEqual([]);
      expect(getDefaultClusterId()).toBeNull();
    });
    test("partial legacy vars produce no config", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.test";
      expect(getConfiguredClusters()).toEqual([]);
      expect(getLensConfig("default")).toBeNull();
    });
    test("emits one-time deprecation warning for legacy config", () => {
      const warn = spyOn(console, "warn");
      try {
        process.env.CLICKHOUSE_HOST = "legacy.example.test";
        process.env.LENS_USER = "legacy-lens";
        process.env.LENS_PASSWORD = "legacy-pw";
        getConfiguredClusters();
        getConfiguredClusters();
        getConfiguredClusters();
        expect(warn).toHaveBeenCalledTimes(1);
        const msg = warn.mock.calls[0][0] as string;
        expect(msg).toMatch(/deprecated/i);
        expect(msg).toMatch(/CLICKHOUSE_CLUSTERS/i);
        expect(msg).toMatch(/next major release/i);
        expect(msg).not.toContain("legacy.example.test");
        expect(msg).not.toContain("legacy-lens");
        expect(msg).not.toContain("legacy-pw");
      } finally {
        warn.mockRestore();
      }
    });
    test("does not warn when CLICKHOUSE_CLUSTERS is set", () => {
      const warn = spyOn(console, "warn");
      try {
        process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "primary", label: "Primary", host: "primary", lensUser: "lens", lensPassword: "pw" }]);
        getConfiguredClusters();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
    test("parses multiple clusters", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Production", host: "prod.example.com", lensUser: "lens", lensPassword: "secret" },
        { id: "staging", label: "Staging", host: "staging.example.com", port: 8443, secure: true, lensUser: "lens", lensPassword: "secret" },
      ]);
      const clusters = getConfiguredClusters();
      expect(clusters).toHaveLength(2);
      expect(clusters[0].id).toBe("prod");
      expect(clusters[1].id).toBe("staging");
    });
    test("rejects duplicate cluster IDs", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Prod", host: "a.com", lensUser: "l", lensPassword: "p" },
        { id: "prod", label: "Dupe", host: "b.com", lensUser: "l", lensPassword: "p" },
      ]);
      expect(() => parseClusterRegistry()).toThrow(/duplicate/i);
    });
    test("rejects whitespace in cluster ID", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "bad id", label: "Bad", host: "x.com", lensUser: "u", lensPassword: "p" }]);
      expect(() => parseClusterRegistry()).toThrow(/whitespace/i);
    });
    test("isClusterConfigured for registry entry", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "qa", label: "QA", host: "qa.example.com", lensUser: "l", lensPassword: "p" }]);
      expect(isClusterConfigured("qa")).toBe(true);
      expect(isClusterConfigured("fake")).toBe(false);
    });
    test("isClusterConfigured for legacy default", () => {
      process.env.CLICKHOUSE_HOST = "ch.local";
      process.env.LENS_USER = "lens";
      expect(isClusterConfigured("default")).toBe(true);
    });
    test("resolves explicit default registry entry", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "default", label: "Primary", host: "primary", port: 8123, lensUser: "lens", lensPassword: "secret" }]);
      delete process.env.CLICKHOUSE_HOST;
      delete process.env.LENS_USER;
      expect(getLensConfig("default")).toMatchObject({ host: "primary", username: "lens", clusterId: "default" });
      expect(getUserConfig("default", { username: "alice", password: "pw" })).toMatchObject({ host: "primary", username: "alice", clusterId: "default" });
    });
    test("registry default overrides legacy env", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.com";
      process.env.LENS_USER = "legacyUser";
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "default", label: "Registry", host: "registry", port: 8123, lensUser: "lensReg", lensPassword: "regSecret" }]);
      expect(getLensConfig("default")!.host).toBe("registry");
      expect(getUserConfig("default", { username: "bob", password: "bobpass" })!.host).toBe("registry");
    });
    test("does not include registry secrets in parse errors", () => {
      process.env.CLICKHOUSE_CLUSTERS = "not-json-secret";
      expect(() => parseClusterRegistry()).toThrow("CLICKHOUSE_CLUSTERS");
      expect(() => parseClusterRegistry()).not.toThrow("not-json-secret");
    });
    test("parse errors do not include registry entry contents", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "x", label: "X", host: "x", lensUser: "u", lensPassword: "super-secret-password" },
        null,
      ]);
      expect(() => parseClusterRegistry()).toThrow(/cluster entry/i);
      expect(() => parseClusterRegistry()).not.toThrow("super-secret-password");
    });
    test("isClusterConfigured for explicit default registry", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([{ id: "default", label: "Primary", host: "primary", port: 8123, lensUser: "lens", lensPassword: "secret" }]);
      delete process.env.CLICKHOUSE_HOST;
      expect(isClusterConfigured("default")).toBe(true);
    });
  });
});