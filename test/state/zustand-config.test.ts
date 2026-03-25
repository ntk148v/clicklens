import { describe, expect, test } from "bun:test";
import { devtools, persist, getMiddlewareConfig } from "../../src/lib/state/zustand.config";

describe("zustand config", () => {
  describe("getMiddlewareConfig", () => {
    test("returns default config with no options", () => {
      const config = getMiddlewareConfig();
      expect(config.devtools).toEqual({
        name: "clicklens-store",
        enabled: process.env.NODE_ENV !== "production",
      });
      expect(config.persist).toBe(false);
    });

    test("applies custom name", () => {
      const config = getMiddlewareConfig({ name: "my-store" });
      expect(config.devtools).toEqual({
        name: "my-store",
        enabled: process.env.NODE_ENV !== "production",
      });
    });

    test("enables devtools when specified", () => {
      const config = getMiddlewareConfig({ devtools: true });
      expect(config.devtools).toEqual({
        name: "clicklens-store",
        enabled: process.env.NODE_ENV !== "production",
      });
    });

    test("disables devtools when specified", () => {
      const config = getMiddlewareConfig({ devtools: false });
      expect(config.devtools).toBe(false);
    });

    test("enables persist when specified", () => {
      const config = getMiddlewareConfig({ persist: true });
      expect(config.persist).toEqual({
        name: "clicklens-store",
      });
    });

    test("combines all options", () => {
      const config = getMiddlewareConfig({
        name: "test-store",
        devtools: true,
        persist: true,
      });
      expect(config.devtools).toEqual({
        name: "test-store",
        enabled: process.env.NODE_ENV !== "production",
      });
      expect(config.persist).toEqual({
        name: "test-store",
      });
    });
  });

  describe("middleware exports", () => {
    test("devtools is a function", () => {
      expect(typeof devtools).toBe("function");
    });

    test("persist is a function", () => {
      expect(typeof persist).toBe("function");
    });
  });
});
