import { describe, expect, test } from "bun:test";
import { quoteIdentifier, escapeString } from "./utils";

describe("clickhouse/utils", () => {
  describe("quoteIdentifier", () => {
    test("wraps simple identifier in backticks", () => {
      expect(quoteIdentifier("users")).toBe("`users`");
    });

    test("wraps identifier with spaces", () => {
      expect(quoteIdentifier("my table")).toBe("`my table`");
    });

    test("escapes existing backticks", () => {
      expect(quoteIdentifier("table`name")).toBe("`table``name`");
    });

    test("escapes multiple backticks", () => {
      expect(quoteIdentifier("a`b`c")).toBe("`a``b``c`");
    });

    test("handles empty string", () => {
      expect(quoteIdentifier("")).toBe("``");
    });

    test("handles reserved keywords", () => {
      expect(quoteIdentifier("select")).toBe("`select`");
      expect(quoteIdentifier("from")).toBe("`from`");
      expect(quoteIdentifier("where")).toBe("`where`");
    });

    test("handles identifiers with special characters", () => {
      expect(quoteIdentifier("user-data")).toBe("`user-data`");
      expect(quoteIdentifier("data@2024")).toBe("`data@2024`");
      expect(quoteIdentifier("table.column")).toBe("`table.column`");
    });

    test("handles identifiers with numbers", () => {
      expect(quoteIdentifier("table123")).toBe("`table123`");
      expect(quoteIdentifier("123table")).toBe("`123table`");
    });

    test("handles unicode characters", () => {
      expect(quoteIdentifier("table_")).toBe("`table_`");
      expect(quoteIdentifier("data")).toBe("`data`");
    });

    test("preserves case", () => {
      expect(quoteIdentifier("MyTable")).toBe("`MyTable`");
      expect(quoteIdentifier("USERS")).toBe("`USERS`");
    });
  });

  describe("escapeString", () => {
    test("returns unmodified simple string", () => {
      expect(escapeString("hello")).toBe("hello");
    });

    test("escapes single quotes", () => {
      expect(escapeString("it's")).toBe("it''s");
    });

    test("escapes multiple single quotes", () => {
      expect(escapeString("'hello' 'world'")).toBe("''hello'' ''world''");
    });

    test("escapes backslashes", () => {
      expect(escapeString("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    test("escapes both backslashes and single quotes", () => {
      expect(escapeString("it's a \\test")).toBe("it''s a \\\\test");
    });

    test("handles empty string", () => {
      expect(escapeString("")).toBe("");
    });

    test("handles string with only special characters", () => {
      expect(escapeString("'")).toBe("''");
      expect(escapeString("\\")).toBe("\\\\");
      expect(escapeString("'\\'")).toBe("''\\\\''");
    });

    test("preserves other special characters", () => {
      expect(escapeString("hello\nworld")).toBe("hello\nworld");
      expect(escapeString("hello\tworld")).toBe("hello\tworld");
      expect(escapeString('hello"world')).toBe('hello"world');
    });

    test("handles consecutive backslashes", () => {
      expect(escapeString("\\\\")).toBe("\\\\\\\\");
    });

    test("handles consecutive single quotes", () => {
      expect(escapeString("''")).toBe("''''");
    });

    test("handles mixed content", () => {
      const input = "User's data: C:\\path\\file";
      const expected = "User''s data: C:\\\\path\\\\file";
      expect(escapeString(input)).toBe(expected);
    });

    test("handles SQL injection attempts", () => {
      const input = "'; DROP TABLE users; --";
      const expected = "''; DROP TABLE users; --";
      expect(escapeString(input)).toBe(expected);
    });

    test("handles unicode content", () => {
      expect(escapeString("hello world")).toBe("hello world");
    });

    test("preserves numbers and special chars", () => {
      expect(escapeString("price: $99.99")).toBe("price: $99.99");
      expect(escapeString("email@example.com")).toBe("email@example.com");
    });
  });
});
