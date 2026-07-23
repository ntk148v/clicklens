import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  buildConnectionUrl,
  getLensConfig,
  getUserConfig,
  getDefaultConfig,
  buildAuthHeaders,
  isLensUserConfigured,
  type ClickHouseConfig,
  parseClusterRegistry,
  getConfiguredClusters,
  getDefaultClusterId,
  isClusterConfigured,
} from "./config";

describe("clickhouse/config", () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.CLICKHOUSE_HOST;
    delete process.env.CLICKHOUSE_PORT;
    delete process.env.CLICKHOUSE_SECURE;
    delete process.env.CLICKHOUSE_VERIFY;
    delete process.env.LENS_USER;
    delete process.env.LENS_PASSWORD;
  });

  afterEach(() => {
    // Restore original env vars
    Object.assign(process.env, originalEnv);
  });

  describe("buildConnectionUrl", () => {
    test("builds HTTP URL for non-secure config", () => {
      const config = {
        host: "localhost",
        port: 8123,
        secure: false,
        verifySsl: true,
      };
      expect(buildConnectionUrl(config)).toBe("http://localhost:8123");
    });

    test("builds HTTPS URL for secure config", () => {
      const config = {
        host: "localhost",
        port: 8443,
        secure: true,
        verifySsl: true,
      };
      expect(buildConnectionUrl(config)).toBe("https://localhost:8443");
    });

    test("handles custom port", () => {
      const config = {
        host: "clickhouse.example.com",
        port: 9000,
        secure: false,
        verifySsl: true,
      };
      expect(buildConnectionUrl(config)).toBe(
        "http://clickhouse.example.com:9000"
      );
    });

    test("handles hostname with subdomain", () => {
      const config = {
        host: "db.internal.example.com",
        port: 8123,
        secure: true,
        verifySsl: false,
      };
      expect(buildConnectionUrl(config)).toBe(
        "https://db.internal.example.com:8123"
      );
    });
  });

  describe("getLensConfig", () => {
    test("returns null when CLICKHOUSE_HOST is not set", () => {
      process.env.LENS_USER = "lens";
      expect(getLensConfig()).toBeNull();
    });

    test("returns null when LENS_USER is not set", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      expect(getLensConfig()).toBeNull();
    });

    test("returns config with default values", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";

      const config = getLensConfig();
      expect(config).not.toBeNull();
      expect(config?.host).toBe("localhost");
      expect(config?.port).toBe(8123); // Default HTTP port
      expect(config?.secure).toBe(false);
      expect(config?.verifySsl).toBe(true);
      expect(config?.username).toBe("lens");
      expect(config?.password).toBe("");
      expect(config?.database).toBe("default");
    });

    test("returns config with password when set", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "secret";

      const config = getLensConfig();
      expect(config?.password).toBe("secret");
    });

    test("returns config with secure=true when CLICKHOUSE_SECURE is true", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      process.env.CLICKHOUSE_SECURE = "true";

      const config = getLensConfig();
      expect(config?.secure).toBe(true);
      expect(config?.port).toBe(8443); // Default HTTPS port
    });

    test("returns config with custom port", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      process.env.CLICKHOUSE_PORT = "9123";

      const config = getLensConfig();
      expect(config?.port).toBe(9123);
    });

    test("returns config with verifySsl=false when CLICKHOUSE_VERIFY is false", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      process.env.CLICKHOUSE_VERIFY = "false";

      const config = getLensConfig();
      expect(config?.verifySsl).toBe(false);
    });
  });

  describe("getUserConfig", () => {
    test("returns null when CLICKHOUSE_HOST is not set", () => {
      const result = getUserConfig({ username: "user", password: "pass" });
      expect(result).toBeNull();
    });

    test("returns config with user credentials", () => {
      process.env.CLICKHOUSE_HOST = "localhost";

      const config = getUserConfig({
        username: "testuser",
        password: "testpass",
      });

      expect(config).not.toBeNull();
      expect(config?.username).toBe("testuser");
      expect(config?.password).toBe("testpass");
      expect(config?.database).toBe("default");
    });

    test("uses provided database", () => {
      process.env.CLICKHOUSE_HOST = "localhost";

      const config = getUserConfig({
        username: "user",
        password: "pass",
        database: "mydb",
      });

      expect(config?.database).toBe("mydb");
    });

    test("inherits server connection settings", () => {
      process.env.CLICKHOUSE_HOST = "db.example.com";
      process.env.CLICKHOUSE_PORT = "8443";
      process.env.CLICKHOUSE_SECURE = "true";
      process.env.CLICKHOUSE_VERIFY = "false";

      const config = getUserConfig({ username: "user", password: "pass" });

      expect(config?.host).toBe("db.example.com");
      expect(config?.port).toBe(8443);
      expect(config?.secure).toBe(true);
      expect(config?.verifySsl).toBe(false);
    });
  });

  describe("getDefaultConfig", () => {
    test("returns same as getLensConfig", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";

      const defaultConfig = getDefaultConfig();
      const lensConfig = getLensConfig();

      expect(defaultConfig).toEqual(lensConfig);
    });

    test("returns null when lens user not configured", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      expect(getDefaultConfig()).toBeNull();
    });
  });

  describe("buildAuthHeaders", () => {
    test("builds correct headers from config", () => {
      const config: ClickHouseConfig = {
        host: "localhost",
        port: 8123,
        secure: false,
        verifySsl: true,
        username: "admin",
        password: "secret",
        database: "mydb",
      };

      const headers = buildAuthHeaders(config);

      expect(headers["X-ClickHouse-User"]).toBe("admin");
      expect(headers["X-ClickHouse-Key"]).toBe("secret");
      expect(headers["X-ClickHouse-Database"]).toBe("mydb");
    });

    test("handles empty password", () => {
      const config: ClickHouseConfig = {
        host: "localhost",
        port: 8123,
        secure: false,
        verifySsl: true,
        username: "default",
        password: "",
        database: "default",
      };

      const headers = buildAuthHeaders(config);

      expect(headers["X-ClickHouse-Key"]).toBe("");
    });

    test("handles special characters in credentials", () => {
      const config: ClickHouseConfig = {
        host: "localhost",
        port: 8123,
        secure: false,
        verifySsl: true,
        username: "user@domain",
        password: "p@ss=w0rd!",
        database: "my-database",
      };

      const headers = buildAuthHeaders(config);

      expect(headers["X-ClickHouse-User"]).toBe("user@domain");
      expect(headers["X-ClickHouse-Key"]).toBe("p@ss=w0rd!");
      expect(headers["X-ClickHouse-Database"]).toBe("my-database");
    });
  });

  describe("isLensUserConfigured", () => {
    test("returns false when CLICKHOUSE_HOST is not set", () => {
      process.env.LENS_USER = "lens";
      expect(isLensUserConfigured()).toBe(false);
    });

    test("returns false when LENS_USER is not set", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      expect(isLensUserConfigured()).toBe(false);
    });

    test("returns true when both are set", () => {
      process.env.CLICKHOUSE_HOST = "localhost";
      process.env.LENS_USER = "lens";
      expect(isLensUserConfigured()).toBe(true);
    });

    test("returns false when both are empty strings", () => {
      process.env.CLICKHOUSE_HOST = "";
      process.env.LENS_USER = "";
      expect(isLensUserConfigured()).toBe(false);
    });
  });

  describe("multi-cluster registry", () => {
    test("returns empty when CLICKHOUSE_CLUSTERS is not set and no legacy env", () => {
      delete process.env.CLICKHOUSE_CLUSTERS;
      delete process.env.CLICKHOUSE_HOST;
      expect(getConfiguredClusters()).toEqual([]);
      expect(getDefaultClusterId()).toBeNull();
    });

    test("legacy env vars work as implicit default cluster", () => {
      process.env.CLICKHOUSE_HOST = "ch1.example.com";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pass";
      const clusters = getConfiguredClusters();
      expect(clusters).toHaveLength(1);
      expect(clusters[0].id).toBe("default");
      expect(clusters[0].label).toBe("default");
    });

    test("parses CLICKHOUSE_CLUSTERS JSON correctly", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Production", host: "prod.example.com", lensUser: "lens", lensPassword: "secret" },
        { id: "staging", label: "Staging", host: "staging.example.com", port: 8443, secure: true, lensUser: "lens", lensPassword: "secret" },
      ]);
      const clusters = getConfiguredClusters();
      expect(clusters).toHaveLength(2);
      expect(clusters[0].id).toBe("prod");
      expect(clusters[1].id).toBe("staging");
    });

    test("CLICKHOUSE_CLUSTERS and legacy env vars coexist", () => {
      process.env.CLICKHOUSE_HOST = "old.example.com";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pass";
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Prod", host: "prod.example.com", lensUser: "lens", lensPassword: "x" },
      ]);
      const clusters = getConfiguredClusters();
      expect(clusters).toHaveLength(2);
      expect(clusters[0].id).toBe("default");
      expect(clusters[1].id).toBe("prod");
    });

    test("getLensConfig with clusterId returns correct config", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Prod", host: "prod.example.com", lensUser: "lens", lensPassword: "sekret" },
      ]);
      const config = getLensConfig("prod");
      expect(config).not.toBeNull();
      expect(config!.host).toBe("prod.example.com");
      expect(config!.username).toBe("lens");
      expect(config!.password).toBe("sekret");
      expect(config!.port).toBe(8123);
    });

    test("getLensConfig without clusterId falls back to legacy", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.com";
      process.env.LENS_USER = "legacyUser";
      const config = getLensConfig();
      expect(config).not.toBeNull();
      expect(config!.host).toBe("legacy.example.com");
    });

    test("getUserConfig with clusterId merges cluster definition with user credentials", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Prod", host: "prod.example.com", lensUser: "lens", lensPassword: "x" },
      ]);
      const config = getUserConfig("prod", { username: "alice", password: "alicepass", database: "mydb" });
      expect(config).not.toBeNull();
      expect(config!.host).toBe("prod.example.com");
      expect(config!.username).toBe("alice");
      expect(config!.password).toBe("alicepass");
      expect(config!.database).toBe("mydb");
    });

    test("getUserConfig with unknown cluster returns null", () => {
      expect(getUserConfig("nonexistent", { username: "u", password: "p" })).toBeNull();
    });

    test("getUserConfig legacy path still works", () => {
      process.env.CLICKHOUSE_HOST = "legacy.example.com";
      const config = getUserConfig({ username: "user", password: "pass" });
      expect(config).not.toBeNull();
      expect(config!.host).toBe("legacy.example.com");
    });

    test("rejects duplicate cluster IDs", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "prod", label: "Prod", host: "a.com", lensUser: "l", lensPassword: "p" },
        { id: "prod", label: "Dupe", host: "b.com", lensUser: "l", lensPassword: "p" },
      ]);
      expect(() => parseClusterRegistry()).toThrow(/duplicate|prod/i);
    });

    test("rejects missing id in cluster entry", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { label: "NoID", host: "x.com", lensUser: "u", lensPassword: "p" },
      ]);
      expect(() => parseClusterRegistry()).toThrow(/missing.*id/i);
    });

    test("rejects whitespace in cluster ID", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "bad id", label: "Bad", host: "x.com", lensUser: "u", lensPassword: "p" },
      ]);
      expect(() => parseClusterRegistry()).toThrow(/whitespace/i);
    });

    test("isClusterConfigured returns true for valid cluster", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        { id: "qa", label: "QA", host: "qa.example.com", lensUser: "l", lensPassword: "p" },
      ]);
      expect(isClusterConfigured("qa")).toBe(true);
      expect(isClusterConfigured("fake")).toBe(false);
    });

    test("isClusterConfigured returns true for default with legacy env", () => {
      process.env.CLICKHOUSE_HOST = "ch.local";
      process.env.LENS_USER = "lens";
      expect(isClusterConfigured("default")).toBe(true);
    });
  });
});
