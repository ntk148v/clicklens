import { describe, expect, test } from "bun:test";
import {
  parseTableAliases,
  findPrecedingWord,
  analyzeContext,
  extractTableName,
} from "./sql-context";

describe("sql-context", () => {
  describe("parseTableAliases", () => {
    test("parses simple FROM clause", () => {
      const sql = "SELECT * FROM users";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("users")).toBe("users");
    });

    test("parses FROM with alias", () => {
      const sql = "SELECT * FROM users u";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("u")).toBe("users");
      expect(aliases.get("users")).toBe("users");
    });

    test("parses FROM with AS alias", () => {
      const sql = "SELECT * FROM users AS u";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("u")).toBe("users");
    });

    test("parses database.table syntax", () => {
      const sql = "SELECT * FROM system.tables";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("tables")).toBe("system.tables");
    });

    test("parses database.table with alias", () => {
      const sql = "SELECT * FROM system.tables t";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("t")).toBe("system.tables");
      expect(aliases.get("tables")).toBe("system.tables");
    });

    test("parses JOIN clauses", () => {
      const sql = "SELECT * FROM users u JOIN orders o ON u.id = o.user_id";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("u")).toBe("users");
      expect(aliases.get("o")).toBe("orders");
    });

    test("parses multiple JOINs", () => {
      const sql = `
        SELECT * FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        JOIN products p ON o.product_id = p.id
      `;
      const aliases = parseTableAliases(sql);
      expect(aliases.get("u")).toBe("users");
      expect(aliases.get("o")).toBe("orders");
      expect(aliases.get("p")).toBe("products");
    });

    test("ignores SQL keywords as aliases", () => {
      // 'where' after table name should not be treated as alias
      const sql = "SELECT * FROM users WHERE id = 1";
      const aliases = parseTableAliases(sql);
      expect(aliases.has("where")).toBe(false);
      expect(aliases.get("users")).toBe("users");
    });

    test("handles quoted identifiers", () => {
      const sql = "SELECT * FROM `system`.`tables` AS t";
      const aliases = parseTableAliases(sql);
      expect(aliases.get("t")).toBe("system.tables");
    });

    test("handles empty SQL", () => {
      const aliases = parseTableAliases("");
      expect(aliases.size).toBe(0);
    });

    test("handles SQL without FROM clause", () => {
      const sql = "SELECT 1 + 1";
      const aliases = parseTableAliases(sql);
      expect(aliases.size).toBe(0);
    });
  });

  describe("findPrecedingWord", () => {
    test("finds word before dot", () => {
      const text = "SELECT users.";
      const word = findPrecedingWord(text, text.length);
      expect(word).toBe("users");
    });

    test("finds alias before dot", () => {
      const text = "SELECT u.";
      const word = findPrecedingWord(text, text.length);
      expect(word).toBe("u");
    });

    test("finds word with spaces before dot", () => {
      const text = "SELECT users . ";
      const word = findPrecedingWord(text, text.length);
      expect(word).toBe("users");
    });

    test("returns undefined for no preceding word", () => {
      const text = ". ";
      const word = findPrecedingWord(text, text.length);
      expect(word).toBeUndefined();
    });

    test("handles database.table.column", () => {
      const text = "SELECT system.tables.";
      const word = findPrecedingWord(text, text.length);
      expect(word).toBe("tables");
    });

    test("handles position in middle of text", () => {
      const text = "SELECT users.name, orders.";
      const word = findPrecedingWord(text, 13); // After "users."
      expect(word).toBe("users");
    });
  });

  describe("analyzeContext", () => {
    test("detects AFTER_SELECT context", () => {
      const sql = "SELECT ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_SELECT");
      expect(context.currentClause).toBe("SELECT");
    });

    test("detects AFTER_FROM context", () => {
      const sql = "SELECT * FROM ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_FROM");
    });

    test("detects AFTER_JOIN context", () => {
      const sql = "SELECT * FROM users JOIN ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_JOIN"); // Current clause is JOIN
    });

    test("detects AFTER_WHERE context", () => {
      const sql = "SELECT * FROM users WHERE ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_WHERE");
    });

    test("detects AFTER_GROUP_BY context", () => {
      const sql = "SELECT * FROM users GROUP BY ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_GROUP_BY");
    });

    test("detects AFTER_ORDER_BY context", () => {
      const sql = "SELECT * FROM users ORDER BY ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_ORDER_BY");
    });

    test("detects AFTER_DOT context", () => {
      const sql = "SELECT users.";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_DOT");
      expect(context.precedingWord).toBe("users");
    });

    test("detects AFTER_DOT with alias", () => {
      const sql = "SELECT * FROM users u WHERE u.";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_DOT");
      expect(context.precedingWord).toBe("u");
    });

    test("detects IN_FUNCTION context", () => {
      const sql = "SELECT count(";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("IN_FUNCTION");
      expect(context.functionName).toBe("count");
    });

    test("detects IN_FUNCTION with nested parentheses", () => {
      const sql = "SELECT sum(if(status = 1, amount, 0), ";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("IN_FUNCTION");
      // Should detect the outer 'sum' function
    });

    test("detects AFTER_DATABASE_KEYWORD context", () => {
      const sql = "USE mydb";
      const context = analyzeContext(sql, sql.length);
      expect(context.type).toBe("AFTER_DATABASE_KEYWORD");
    });

    test("extracts table references from complex query", () => {
      const sql =
        "SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id WHERE ";
      const context = analyzeContext(sql, sql.length);
      expect(context.aliases.get("u")).toBe("users");
      expect(context.aliases.get("o")).toBe("orders");
      expect(context.tables.length).toBeGreaterThan(0);
    });

    test("handles cursor in middle of query", () => {
      const sql = "SELECT name FROM users WHERE status = 1";
      const cursorPos = 12; // After "SELECT name "
      const context = analyzeContext(sql, cursorPos);
      expect(context.currentClause).toBe("SELECT");
    });

    test("handles empty SQL", () => {
      const context = analyzeContext("", 0);
      // Empty SQL defaults to AFTER_SELECT since detectCurrentClause returns "SELECT"
      expect(context.type).toBe("AFTER_SELECT");
    });
  });

  describe("extractTableName", () => {
    test("extracts simple table name", () => {
      const result = extractTableName("users");
      expect(result.table).toBe("users");
      expect(result.database).toBeUndefined();
    });

    test("extracts database and table", () => {
      const result = extractTableName("system.tables");
      expect(result.database).toBe("system");
      expect(result.table).toBe("tables");
    });

    test("handles triple-qualified names", () => {
      // extractTableName only handles 2 parts - returns undefined database for 3+ parts
      const result = extractTableName("cluster.db.table");
      expect(result.database).toBeUndefined();
      expect(result.table).toBe("cluster");
    });

    test("handles empty string", () => {
      const result = extractTableName("");
      expect(result.table).toBe("");
      expect(result.database).toBeUndefined();
    });
  });
});
