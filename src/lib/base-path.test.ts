import { describe, it, expect, afterEach } from "bun:test";
import { getBasePath, withBasePath } from "./base-path";

describe("base-path", () => {
  const originalBase = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBase;
    }
  });

  it("returns empty base path when unset", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(getBasePath()).toBe("");
    expect(withBasePath("/api/foo")).toBe("/api/foo");
  });

  it("strips trailing slash from configured base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/lens/";
    expect(getBasePath()).toBe("/lens");
    expect(withBasePath("/api/foo")).toBe("/lens/api/foo");
  });

  it("does not modify absolute URLs", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/lens";
    expect(withBasePath("https://example.com/api")).toBe(
      "https://example.com/api",
    );
  });
});
