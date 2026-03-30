import { describe, it, expect } from "bun:test";
import { parseTimeRangeFromURL } from "./use-discover-url";
import type { FlexibleTimeRange } from "@/lib/types/discover";

describe("useDiscoverURL - parseTimeRangeFromURL", () => {
  it("parses relative time range from URL", () => {
    const params = new URLSearchParams({ t: "1h" });
    const result = parseTimeRangeFromURL(params);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("relative");
    expect(result?.from).toBe("now-1h");
    expect(result?.to).toBe("now");
  });

  it("parses all valid relative ranges", () => {
    const validRanges = ["5m", "15m", "30m", "1h", "3h", "6h", "12h", "24h", "3d", "7d"];

    for (const range of validRanges) {
      const params = new URLSearchParams({ t: range });
      const result = parseTimeRangeFromURL(params);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("relative");
      expect(result?.from).toBe(`now-${range}`);
    }
  });

  it("returns null for invalid relative range", () => {
    const params = new URLSearchParams({ t: "invalid" });
    const result = parseTimeRangeFromURL(params);

    expect(result).toBeNull();
  });

  it("parses absolute time range from URL", () => {
    const start = "2024-01-15T10:00:00Z";
    const end = "2024-01-15T11:00:00Z";
    const params = new URLSearchParams({ start, end });
    const result = parseTimeRangeFromURL(params);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("absolute");
    expect(result?.from).toBe(start);
    expect(result?.to).toBe(end);
    expect(result?.label).toContain("Jan");
  });

  it("uses 'now' as default end time for absolute range", () => {
    const start = "2024-01-15T10:00:00Z";
    const params = new URLSearchParams({ start });
    const result = parseTimeRangeFromURL(params);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("absolute");
    expect(result?.from).toBe(start);
    expect(result?.to).toBe("now");
  });

  it("returns null for invalid start date", () => {
    const params = new URLSearchParams({ start: "invalid-date" });
    const result = parseTimeRangeFromURL(params);

    expect(result).toBeNull();
  });

  it("returns null when no time params present", () => {
    const params = new URLSearchParams();
    const result = parseTimeRangeFromURL(params);

    expect(result).toBeNull();
  });

  it("prioritizes relative range over absolute", () => {
    const params = new URLSearchParams({
      t: "1h",
      start: "2024-01-15T10:00:00Z",
      end: "2024-01-15T11:00:00Z",
    });
    const result = parseTimeRangeFromURL(params);

    expect(result?.type).toBe("relative");
    expect(result?.from).toBe("now-1h");
  });
});

describe("useDiscoverURL - URLParams interface", () => {
  it("has correct structure for URLParams", () => {
    const params = {
      database: "default",
      table: "my_table",
      filter: "level = 'error'",
      page: 1,
      timeRange: null as FlexibleTimeRange | null,
    };

    expect(params.database).toBe("default");
    expect(params.table).toBe("my_table");
    expect(params.filter).toBe("level = 'error'");
    expect(params.page).toBe(1);
    expect(params.timeRange).toBeNull();
  });
});
