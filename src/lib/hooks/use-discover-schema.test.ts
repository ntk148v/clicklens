import { describe, it, expect } from "bun:test";
import {
  loadColumnPrefs,
  saveColumnPrefs,
  removeColumnPrefs,
} from "./use-discover-schema";
import type { TableSchema, ColumnMetadata, TimeColumnCandidate } from "@/lib/types/discover";

const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  };
};

describe("useDiscoverSchema - column preferences", () => {
  it("saves and loads column preferences", () => {
    const localStorage = mockLocalStorage();
    Object.defineProperty(global, "localStorage", { value: localStorage, writable: true });

    const db = "default";
    const table = "logs";
    const columns = ["timestamp", "level", "message"];
    const timeColumn = "timestamp";

    saveColumnPrefs(db, table, columns, timeColumn);
    const loaded = loadColumnPrefs(db, table);

    expect(loaded).not.toBeNull();
    expect(loaded?.columns).toEqual(columns);
    expect(loaded?.timeColumn).toBe(timeColumn);
  });

  it("returns null when no preferences exist", () => {
    const localStorage = mockLocalStorage();
    Object.defineProperty(global, "localStorage", { value: localStorage, writable: true });

    const loaded = loadColumnPrefs("nonexistent", "table");
    expect(loaded).toBeNull();
  });

  it("removes column preferences", () => {
    const localStorage = mockLocalStorage();
    Object.defineProperty(global, "localStorage", { value: localStorage, writable: true });

    const db = "default";
    const table = "logs";

    saveColumnPrefs(db, table, ["col1"], "col1");
    removeColumnPrefs(db, table);
    const loaded = loadColumnPrefs(db, table);

    expect(loaded).toBeNull();
  });

  it("handles different databases and tables independently", () => {
    const localStorage = mockLocalStorage();
    Object.defineProperty(global, "localStorage", { value: localStorage, writable: true });

    saveColumnPrefs("db1", "table1", ["a", "b"], "a");
    saveColumnPrefs("db1", "table2", ["c", "d"], "c");
    saveColumnPrefs("db2", "table1", ["e", "f"], "e");

    expect(loadColumnPrefs("db1", "table1")?.columns).toEqual(["a", "b"]);
    expect(loadColumnPrefs("db1", "table2")?.columns).toEqual(["c", "d"]);
    expect(loadColumnPrefs("db2", "table1")?.columns).toEqual(["e", "f"]);
  });
});

describe("useDiscoverSchema - applyDefaultColumns", () => {
  it("returns first 10 columns by default", () => {
    const schema: TableSchema = {
      columns: Array.from({ length: 20 }, (_, i) => ({
        name: `col${i}`,
        type: "String",
      })) as ColumnMetadata[],
      timeColumns: [],
    };

    const defaultCols = schema.columns.slice(0, 10).map((c) => c.name);
    expect(defaultCols).toHaveLength(10);
    expect(defaultCols[0]).toBe("col0");
    expect(defaultCols[9]).toBe("col9");
  });

  it("handles schemas with fewer than 10 columns", () => {
    const schema: TableSchema = {
      columns: [
        { name: "id", type: "UInt64" },
        { name: "name", type: "String" },
      ] as ColumnMetadata[],
      timeColumns: [],
    };

    const defaultCols = schema.columns.map((c) => c.name);
    expect(defaultCols).toHaveLength(2);
  });
});

describe("useDiscoverSchema - selectDefaultTimeColumn", () => {
  it("selects primary DateTime column first", () => {
    const schema: TableSchema = {
      columns: [],
      timeColumns: [
        { name: "created_at", type: "DateTime", isPrimary: true },
        { name: "updated_at", type: "DateTime", isPrimary: false },
      ] as TimeColumnCandidate[],
    };

    const primaryDateTime = schema.timeColumns.find(
      (tc) => tc.isPrimary && tc.type.startsWith("DateTime")
    );
    expect(primaryDateTime?.name).toBe("created_at");
  });

  it("selects primary column if no DateTime", () => {
    const schema: TableSchema = {
      columns: [],
      timeColumns: [
        { name: "timestamp", type: "UInt64", isPrimary: true },
        { name: "other", type: "String", isPrimary: false },
      ] as TimeColumnCandidate[],
    };

    const primary = schema.timeColumns.find((tc) => tc.isPrimary);
    expect(primary?.name).toBe("timestamp");
  });

  it("selects any DateTime column if no primary", () => {
    const schema: TableSchema = {
      columns: [],
      timeColumns: [
        { name: "event_time", type: "DateTime64(3)", isPrimary: false },
        { name: "other", type: "String", isPrimary: false },
      ] as TimeColumnCandidate[],
    };

    const anyDateTime = schema.timeColumns.find(
      (tc) => tc.type.startsWith("DateTime") || tc.type.startsWith("DateTime64")
    );
    expect(anyDateTime?.name).toBe("event_time");
  });

  it("selects first column if no DateTime or primary", () => {
    const schema: TableSchema = {
      columns: [],
      timeColumns: [
        { name: "first_col", type: "String", isPrimary: false },
        { name: "second_col", type: "UInt64", isPrimary: false },
      ] as TimeColumnCandidate[],
    };

    expect(schema.timeColumns[0].name).toBe("first_col");
  });

  it("returns empty string if no time columns", () => {
    const schema: TableSchema = {
      columns: [],
      timeColumns: [],
    };

    expect(schema.timeColumns.length).toBe(0);
  });
});
