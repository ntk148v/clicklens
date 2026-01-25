import { describe, expect, test } from "bun:test";
import { splitSqlStatements, findStatementAtPosition } from "./splitter";

describe("sql/splitter", () => {
  describe("splitSqlStatements", () => {
    test("splits simple statements", () => {
      const sql = "SELECT 1; SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 1", "SELECT 2"]);
    });

    test("handles single statement without semicolon", () => {
      const sql = "SELECT * FROM users";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT * FROM users"]);
    });

    test("handles single statement with semicolon", () => {
      const sql = "SELECT * FROM users;";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT * FROM users"]);
    });

    test("handles empty input", () => {
      const statements = splitSqlStatements("");
      expect(statements).toEqual([]);
    });

    test("handles whitespace only", () => {
      const statements = splitSqlStatements("   \n\t  ");
      expect(statements).toEqual([]);
    });

    test("handles multiple semicolons in a row", () => {
      const sql = "SELECT 1;; SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 1", "SELECT 2"]);
    });

    test("preserves semicolons in string literals (single quotes)", () => {
      const sql = "SELECT ';' AS delimiter; SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT ';' AS delimiter", "SELECT 2"]);
    });

    test("preserves semicolons in string literals (double quotes)", () => {
      const sql = 'SELECT ";" AS delimiter; SELECT 2';
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(['SELECT ";" AS delimiter', "SELECT 2"]);
    });

    test("handles escaped single quotes", () => {
      const sql = "SELECT 'it''s a test'; SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 'it''s a test'", "SELECT 2"]);
    });

    test("handles escaped double quotes", () => {
      const sql = 'SELECT "say ""hello"""; SELECT 2';
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(['SELECT "say ""hello"""', "SELECT 2"]);
    });

    test("handles backslash escaped quotes", () => {
      const sql = "SELECT 'test\\'s value'; SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 'test\\'s value'", "SELECT 2"]);
    });

    test("handles single-line comments with --", () => {
      const sql = "SELECT 1; -- comment with ; semicolon\nSELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual([
        "SELECT 1",
        "-- comment with ; semicolon\nSELECT 2",
      ]);
    });

    test("handles multi-line comments", () => {
      const sql = "SELECT 1; /* comment with ; semicolon */ SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual([
        "SELECT 1",
        "/* comment with ; semicolon */ SELECT 2",
      ]);
    });

    test("handles unclosed multi-line comment", () => {
      const sql = "SELECT 1; /* unclosed comment";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 1", "/* unclosed comment"]);
    });

    test("handles unclosed single-line comment at end", () => {
      const sql = "SELECT 1; -- comment at end";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 1", "-- comment at end"]);
    });

    test("handles complex query with CTEs", () => {
      const sql = `
        WITH cte AS (SELECT 1 AS n)
        SELECT * FROM cte;

        SELECT * FROM users WHERE name = 'test'
      `;
      const statements = splitSqlStatements(sql);
      expect(statements.length).toBe(2);
      expect(statements[0]).toContain("WITH cte");
      expect(statements[1]).toContain("SELECT * FROM users");
    });

    test("handles unclosed string literal", () => {
      const sql = "SELECT 'unclosed";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 'unclosed"]);
    });

    test("handles nested quotes", () => {
      const sql = "SELECT \"name = 'test'\"; SELECT 2";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT \"name = 'test'\"", "SELECT 2"]);
    });

    test("trims whitespace from statements", () => {
      const sql = "   SELECT 1   ;   SELECT 2   ";
      const statements = splitSqlStatements(sql);
      expect(statements).toEqual(["SELECT 1", "SELECT 2"]);
    });

    test("handles multiline statements", () => {
      const sql = `
        SELECT
          id,
          name
        FROM users
        WHERE active = 1;

        SELECT COUNT(*) FROM orders
      `;
      const statements = splitSqlStatements(sql);
      expect(statements.length).toBe(2);
    });
  });

  describe("findStatementAtPosition", () => {
    test("finds statement at beginning", () => {
      const sql = "SELECT 1; SELECT 2";
      const statement = findStatementAtPosition(sql, 0);
      expect(statement).toBe("SELECT 1");
    });

    test("finds statement in middle of first statement", () => {
      const sql = "SELECT 1; SELECT 2";
      const statement = findStatementAtPosition(sql, 5);
      expect(statement).toBe("SELECT 1");
    });

    test("finds statement at semicolon", () => {
      const sql = "SELECT 1; SELECT 2";
      const statement = findStatementAtPosition(sql, 8);
      expect(statement).toBe("SELECT 1");
    });

    test("finds second statement", () => {
      const sql = "SELECT 1; SELECT 2";
      const statement = findStatementAtPosition(sql, 10);
      expect(statement).toBe("SELECT 2");
    });

    test("finds last statement without semicolon", () => {
      const sql = "SELECT 1; SELECT 2";
      const statement = findStatementAtPosition(sql, 17);
      expect(statement).toBe("SELECT 2");
    });

    test("handles position at end of string", () => {
      const sql = "SELECT 1; SELECT 2";
      const statement = findStatementAtPosition(sql, sql.length);
      expect(statement).toBe("SELECT 2");
    });

    test("returns null for empty statement position", () => {
      const sql = "SELECT 1; ; SELECT 2";
      const statement = findStatementAtPosition(sql, 10);
      expect(statement).toBeNull();
    });

    test("handles single-line comments", () => {
      const sql = "SELECT 1; -- comment\nSELECT 2";
      const statement = findStatementAtPosition(sql, 25);
      expect(statement).toBe("-- comment\nSELECT 2");
    });

    test("handles multi-line comments", () => {
      const sql = "SELECT 1; /* comment */ SELECT 2";
      const statement = findStatementAtPosition(sql, 30);
      expect(statement).toBe("/* comment */ SELECT 2");
    });

    test("handles string literals with semicolons", () => {
      const sql = "SELECT ';'; SELECT 2";
      const statement = findStatementAtPosition(sql, 5);
      expect(statement).toBe("SELECT ';'");
    });

    test("handles escaped quotes in strings", () => {
      const sql = "SELECT 'it''s'; SELECT 2";
      const statement = findStatementAtPosition(sql, 5);
      expect(statement).toBe("SELECT 'it''s'");
    });

    test("handles position beyond cursor in last statement", () => {
      const sql = "SELECT * FROM users";
      const statement = findStatementAtPosition(sql, 15);
      expect(statement).toBe("SELECT * FROM users");
    });

    test("handles empty input", () => {
      const statement = findStatementAtPosition("", 0);
      expect(statement).toBeNull();
    });

    test("handles whitespace-only input", () => {
      const statement = findStatementAtPosition("   ", 1);
      expect(statement).toBeNull();
    });

    test("handles complex query with CTEs", () => {
      const sql = `WITH cte AS (SELECT 1) SELECT * FROM cte; SELECT 2`;
      const statement = findStatementAtPosition(sql, 20);
      expect(statement).toBe("WITH cte AS (SELECT 1) SELECT * FROM cte");
    });

    test("handles unclosed string at position", () => {
      const sql = "SELECT 'unclosed";
      const statement = findStatementAtPosition(sql, 10);
      expect(statement).toBe("SELECT 'unclosed");
    });
  });
});
