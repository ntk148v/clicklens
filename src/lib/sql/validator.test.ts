import { describe, test, expect } from "bun:test";
import { validateSqlStatement } from "./validator";

describe("validateSqlStatement", () => {
  test("allows SELECT statements", () => {
    expect(validateSqlStatement("SELECT 1")).toEqual({ valid: true });
    expect(validateSqlStatement("SELECT * FROM system.tables")).toEqual({
      valid: true,
    });
  });

  test("allows WITH (CTE) statements", () => {
    expect(
      validateSqlStatement("WITH cte AS (SELECT 1) SELECT * FROM cte"),
    ).toEqual({ valid: true });
  });

  test("allows SHOW statements", () => {
    expect(validateSqlStatement("SHOW TABLES")).toEqual({ valid: true });
    expect(validateSqlStatement("SHOW DATABASES")).toEqual({ valid: true });
  });

  test("allows DESCRIBE statements", () => {
    expect(validateSqlStatement("DESCRIBE TABLE system.tables")).toEqual({
      valid: true,
    });
    expect(validateSqlStatement("DESC TABLE system.tables")).toEqual({
      valid: true,
    });
  });

  test("allows EXPLAIN statements", () => {
    expect(validateSqlStatement("EXPLAIN SELECT 1")).toEqual({ valid: true });
  });

  test("allows EXISTS statements", () => {
    expect(validateSqlStatement("EXISTS TABLE system.tables")).toEqual({
      valid: true,
    });
  });

  test("strips leading comments before checking", () => {
    expect(validateSqlStatement("/* comment */ SELECT 1")).toEqual({
      valid: true,
    });
    expect(validateSqlStatement("-- comment\nSELECT 1")).toEqual({
      valid: true,
    });
  });

  test("blocks DROP statements", () => {
    const result = validateSqlStatement("DROP TABLE test");
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.reason).toContain("not allowed");
  });

  test("blocks INSERT statements", () => {
    const result = validateSqlStatement(
      "INSERT INTO test VALUES (1)",
    );
    expect(result.valid).toBe(false);
  });

  test("blocks ALTER statements", () => {
    const result = validateSqlStatement(
      "ALTER TABLE test DROP COLUMN x",
    );
    expect(result.valid).toBe(false);
  });

  test("blocks CREATE statements", () => {
    const result = validateSqlStatement(
      "CREATE TABLE test (id Int32) ENGINE = Memory",
    );
    expect(result.valid).toBe(false);
  });

  test("blocks TRUNCATE statements", () => {
    const result = validateSqlStatement("TRUNCATE TABLE test");
    expect(result.valid).toBe(false);
  });

  test("blocks dangerous table functions", () => {
    const result = validateSqlStatement("SELECT * FROM file('test.csv')");
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.reason).toContain("file");

    const result2 = validateSqlStatement("SELECT * FROM url('http://evil.com')");
    expect(result2.valid).toBe(false);

    const result3 = validateSqlStatement(
      "SELECT * FROM remote('host', 'db', 'table')",
    );
    expect(result3.valid).toBe(false);

    const result4 = validateSqlStatement("SELECT * FROM s3('bucket')");
    expect(result4.valid).toBe(false);

    const result5 = validateSqlStatement(
      "SELECT * FROM mysql('host', 'db', 'table')",
    );
    expect(result5.valid).toBe(false);

    const result6 = validateSqlStatement(
      "SELECT * FROM postgresql('host', 'db', 'table')",
    );
    expect(result6.valid).toBe(false);
  });

  test("rejects empty input", () => {
    const result = validateSqlStatement("");
    expect(result.valid).toBe(false);
    const result2 = validateSqlStatement("   ");
    expect(result2.valid).toBe(false);
  });
});
