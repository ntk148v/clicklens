import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  buildConnectionUrl,
  getLensConfig,
  getUserConfig,
  getDefaultConfig,
  buildAuthHeaders,
  isLensUserConfigured,
  type ClickHouseConfig,
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
});
