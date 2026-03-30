import {
  TIMEOUT_DEFAULTS,
  clampTimeout,
  validateTimeout,
  isTimeoutError,
  formatTimeoutError,
  createTimeoutSettings,
  formatTimeoutDisplay,
  QueryTimeoutError,
} from "../../src/lib/clickhouse/timeout";

describe("timeout", () => {
  describe("TIMEOUT_DEFAULTS", () => {
    it("should have correct default timeout", () => {
      expect(TIMEOUT_DEFAULTS.DEFAULT).toBe(60);
    });

    it("should have correct max timeout (300s)", () => {
      expect(TIMEOUT_DEFAULTS.MAX).toBe(300);
    });

    it("should have correct min timeout", () => {
      expect(TIMEOUT_DEFAULTS.MIN).toBe(1);
    });
  });

  describe("clampTimeout", () => {
    it("should return same value for valid timeout", () => {
      expect(clampTimeout(60)).toBe(60);
      expect(clampTimeout(30)).toBe(30);
    });

    it("should clamp timeout below minimum to minimum", () => {
      expect(clampTimeout(0)).toBe(1);
      expect(clampTimeout(-5)).toBe(1);
    });

    it("should clamp timeout above maximum to maximum", () => {
      expect(clampTimeout(500)).toBe(300);
      expect(clampTimeout(TIMEOUT_DEFAULTS.MAX + 100)).toBe(300);
    });
  });

  describe("validateTimeout", () => {
    it("should not throw for valid timeout", () => {
      expect(() => validateTimeout(60)).not.toThrow();
      expect(() => validateTimeout(TIMEOUT_DEFAULTS.MIN)).not.toThrow();
      expect(() => validateTimeout(TIMEOUT_DEFAULTS.MAX)).not.toThrow();
    });

    it("should throw for invalid timeout below minimum", () => {
      expect(() => validateTimeout(0)).toThrow(
        "Timeout must be at least 1 second",
      );
    });

    it("should throw for invalid timeout above maximum", () => {
      expect(() => validateTimeout(301)).toThrow(
        "Timeout cannot exceed 300 seconds",
      );
    });

    it("should throw for non-finite numbers", () => {
      expect(() => validateTimeout(NaN)).toThrow(
        "Timeout must be a finite number",
      );
      expect(() => validateTimeout(Infinity)).toThrow(
        "Timeout must be a finite number",
      );
    });
  });

  describe("isTimeoutError", () => {
    it("should return true for QueryTimeoutError", () => {
      const error = new QueryTimeoutError(60, "SELECT 1");
      expect(isTimeoutError(error)).toBe(true);
    });

    it("should return true for AbortError", () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      expect(isTimeoutError(error)).toBe(true);
    });

    it("should return true for error with timeout message", () => {
      const error = new Error("Query timeout exceeded");
      expect(isTimeoutError(error)).toBe(true);
    });

    it("should return true for error with timed out message", () => {
      const error = new Error("Request timed out");
      expect(isTimeoutError(error)).toBe(true);
    });

    it("should return false for non-timeout errors", () => {
      expect(isTimeoutError(new Error("Some other error"))).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      expect(isTimeoutError("error string")).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
    });
  });

  describe("QueryTimeoutError", () => {
    it("should create error with correct properties", () => {
      const error = new QueryTimeoutError(60, "SELECT * FROM users");
      expect(error.timeoutSeconds).toBe(60);
      expect(error.query).toBe("SELECT * FROM users");
      expect(error.name).toBe("QueryTimeoutError");
    });

    it("should provide user-friendly message", () => {
      const error = new QueryTimeoutError(60, "SELECT 1");
      expect(error.getUserMessage()).toContain("60 seconds");
    });

    it("should provide optimization hint", () => {
      const error = new QueryTimeoutError(60, "SELECT 1");
      expect(error.getHint()).toContain("WHERE");
    });
  });

  describe("formatTimeoutError", () => {
    it("should format error with all required fields", () => {
      const error = new QueryTimeoutError(60, "SELECT 1");
      const formatted = formatTimeoutError(error);

      expect(formatted).toHaveProperty("message");
      expect(formatted).toHaveProperty("userMessage");
      expect(formatted).toHaveProperty("hint");
      expect(formatted).toHaveProperty("code");
      expect(formatted.code).toBe(159);
    });
  });

  describe("createTimeoutSettings", () => {
    it("should create settings with correct timeout", () => {
      const settings = createTimeoutSettings(60);
      expect(settings.timeout).toBe(60000);
      expect(settings.clickhouse_settings.max_execution_time).toBe(60);
    });

    it("should clamp timeout above maximum", () => {
      const settings = createTimeoutSettings(500);
      expect(settings.timeout).toBe(300000);
      expect(settings.clickhouse_settings.max_execution_time).toBe(300);
    });

    it("should clamp timeout below minimum", () => {
      const settings = createTimeoutSettings(0);
      expect(settings.timeout).toBe(1000);
      expect(settings.clickhouse_settings.max_execution_time).toBe(1);
    });
  });

  describe("formatTimeoutDisplay", () => {
    it("should format seconds correctly", () => {
      expect(formatTimeoutDisplay(1)).toBe("1 second");
      expect(formatTimeoutDisplay(30)).toBe("30 seconds");
    });

    it("should format minutes correctly", () => {
      expect(formatTimeoutDisplay(60)).toBe("1 minute");
      expect(formatTimeoutDisplay(120)).toBe("2 minutes");
    });

    it("should format mixed minutes and seconds", () => {
      expect(formatTimeoutDisplay(90)).toBe("1m 30s");
      expect(formatTimeoutDisplay(150)).toBe("2m 30s");
    });
  });
});
