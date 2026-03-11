import { describe, it, expect } from "bun:test";
import { parseError } from "./error-parser";

describe("parseError", () => {
  it("should parse syntax errors", () => {
    const error = "Syntax error: Missing closing parenthesis near 'level'";
    const result = parseError(error);
    expect(result.category).toBe("syntax");
    expect(result.message).toContain("Missing closing parenthesis");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("should parse timeout errors", () => {
    const error = "Query timeout: Deadline exceeded after 30s";
    const result = parseError(error);
    expect(result.category).toBe("timeout");
    expect(result.suggestions.some(s => s.includes("time range"))).toBe(true);
  });

  it("should parse permission errors", () => {
    const error = "Access denied: user 'test' lacks SELECT privilege";
    const result = parseError(error);
    expect(result.category).toBe("permission");
    expect(result.suggestions.some(s => s.includes("RBAC"))).toBe(true);
  });

  it("should parse connection errors", () => {
    const error = "Connection refused: ClickHouse server unavailable";
    const result = parseError(error);
    expect(result.category).toBe("connection");
    expect(result.quickFixes.some(f => f.label === "Retry")).toBe(true);
  });

  it("should parse unknown column errors", () => {
    const error = "Unknown column 'user_id' in WHERE clause";
    const result = parseError(error);
    expect(result.category).toBe("not_found");
    expect(result.details).toContain("user_id");
  });

  it("should fallback to unknown for unrecognized errors", () => {
    const error = "Some weird error message";
    const result = parseError(error);
    expect(result.category).toBe("unknown");
    expect(result.message).toBe(error);
  });
});