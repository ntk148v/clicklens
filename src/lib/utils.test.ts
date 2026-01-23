import { describe, expect, test } from "bun:test";
import { cn, generateUUID, formatDateTime, formatDate } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    test("combines class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    test("handles conditional classes", () => {
      expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
    });

    test("handles empty input", () => {
      expect(cn()).toBe("");
    });

    test("handles boolean conditions", () => {
      expect(cn("base", false && "hidden", true && "visible")).toBe(
        "base visible",
      );
    });

    test("merges tailwind classes", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });

    test("handles array of classes", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });
  });

  describe("generateUUID", () => {
    test("returns a valid UUID v4 format", () => {
      const uuid = generateUUID();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    test("generates unique values", () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });

    test("returns string of correct length", () => {
      const uuid = generateUUID();
      expect(uuid.length).toBe(36);
    });

    test("has correct version number (4)", () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe("4");
    });

    test("has correct variant (8, 9, a, or b)", () => {
      const uuid = generateUUID();
      expect(["8", "9", "a", "b"]).toContain(uuid[19].toLowerCase());
    });
  });

  describe("formatDateTime", () => {
    test("returns em dash for null", () => {
      expect(formatDateTime(null)).toBe("—");
    });

    test("returns em dash for undefined", () => {
      expect(formatDateTime(undefined)).toBe("—");
    });

    test("formats ISO string correctly", () => {
      const result = formatDateTime("2026-01-15T10:30:00Z");
      // Should contain date and time components
      expect(result).toContain("2026");
      expect(result).toContain("01");
      expect(result).toContain("15");
    });

    test("preserves fractional seconds from DateTime64", () => {
      const result = formatDateTime("2026-01-15T10:30:00.123456Z");
      expect(result).toContain(".123456");
    });

    test("formats timestamp number", () => {
      const timestamp = new Date("2026-01-15T10:30:00Z").getTime();
      const result = formatDateTime(timestamp);
      expect(result).toContain("2026");
    });

    test("formats Date object", () => {
      const date = new Date("2026-01-15T10:30:00Z");
      const result = formatDateTime(date);
      expect(result).toContain("2026");
    });

    test("returns original string for invalid date", () => {
      expect(formatDateTime("invalid-date")).toBe("invalid-date");
    });

    test("includes timezone offset", () => {
      const result = formatDateTime("2026-01-15T10:30:00Z");
      // Should have timezone offset like +HH:MM or -HH:MM
      expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
    });

    test("handles edge case: epoch time", () => {
      const result = formatDateTime(0);
      expect(result).toContain("1970");
    });

    test("handles edge case: far future date", () => {
      const result = formatDateTime("2099-12-31T23:59:59Z");
      expect(result).toContain("2099");
    });
  });

  describe("formatDate", () => {
    test("returns em dash for null", () => {
      expect(formatDate(null)).toBe("—");
    });

    test("returns em dash for undefined", () => {
      expect(formatDate(undefined)).toBe("—");
    });

    test("returns YYYY-MM-DD string as-is", () => {
      expect(formatDate("2026-01-15")).toBe("2026-01-15");
    });

    test("formats ISO datetime to date only", () => {
      const result = formatDate("2026-01-15T10:30:00Z");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("formats Date object", () => {
      const date = new Date("2026-01-15T10:30:00Z");
      const result = formatDate(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("formats timestamp number", () => {
      const timestamp = new Date("2026-01-15T10:30:00Z").getTime();
      const result = formatDate(timestamp);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("returns original string for invalid date", () => {
      expect(formatDate("invalid-date")).toBe("invalid-date");
    });

    test("pads single digit months and days", () => {
      const result = formatDate(new Date("2026-01-05T10:00:00Z"));
      expect(result).toMatch(/-0[1-9]-0[1-9]$|^\d{4}-\d{2}-\d{2}$/);
    });

    test("handles edge case: epoch time", () => {
      const result = formatDate(0);
      expect(result).toContain("1970");
    });

    test("handles leap year date", () => {
      expect(formatDate("2024-02-29")).toBe("2024-02-29");
    });
  });
});
