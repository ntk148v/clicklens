import { describe, it, expect } from 'bun:test';
import {
  validateSQL,
  validateFilter,
  sanitizeColumnName,
} from './sql-validator';

describe('validateSQL', () => {
  it('should accept valid SELECT queries', () => {
    const result = validateSQL('SELECT * FROM table');
    expect(result.valid).toBe(true);
  });

  it('should accept valid WHERE clauses', () => {
    const result = validateSQL('column = value');
    expect(result.valid).toBe(true);
  });

  it('should reject DROP statements', () => {
    const result = validateSQL('DROP TABLE table');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('DROP');
  });

  it('should reject DELETE statements', () => {
    const result = validateSQL('DELETE FROM table');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('DELETE');
  });

  it('should reject ALTER statements', () => {
    const result = validateSQL('ALTER TABLE table ADD COLUMN col INT');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ALTER');
  });

  it('should reject TRUNCATE statements', () => {
    const result = validateSQL('TRUNCATE TABLE table');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('TRUNCATE');
  });

  it('should reject INSERT statements', () => {
    const result = validateSQL('INSERT INTO table VALUES (1)');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('INSERT');
  });

  it('should reject UPDATE statements', () => {
    const result = validateSQL('UPDATE table SET col = 1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('UPDATE');
  });

  it('should reject CREATE statements', () => {
    const result = validateSQL('CREATE TABLE test (id INT)');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('CREATE');
  });

  it('should reject multiple statements', () => {
    const result = validateSQL('SELECT * FROM table; SELECT * FROM table2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid SQL pattern');
  });

  it('should reject SQL comments', () => {
    const result = validateSQL('SELECT * FROM table -- comment');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid SQL pattern');
  });

  it('should reject multi-line comments', () => {
    const result = validateSQL('SELECT * FROM table /* comment */');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid SQL pattern');
  });

  it('should reject backtick identifiers', () => {
    const result = validateSQL('SELECT * FROM `table`');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid SQL pattern');
  });

  it('should reject dollar-quoted strings', () => {
    const result = validateSQL('SELECT $$value$$');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid SQL pattern');
  });

  it('should reject suspicious function calls', () => {
    const result = validateSQL('SELECT eval("value")');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('eval');
  });

  it('should reject file operations', () => {
    const result = validateSQL('SELECT * FROM file("/etc/passwd")');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('file');
  });

  it('should reject INTO OUTFILE', () => {
    const result = validateSQL('SELECT * FROM table INTO OUTFILE "/tmp/data"');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('into outfile');
  });

  it('should reject empty SQL', () => {
    const result = validateSQL('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject whitespace-only SQL', () => {
    const result = validateSQL('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject non-string input', () => {
    const result = validateSQL(null as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-empty string');
  });

  it('should be case-insensitive for dangerous keywords', () => {
    const result1 = validateSQL('drop table test');
    expect(result1.valid).toBe(false);

    const result2 = validateSQL('Drop Table test');
    expect(result2.valid).toBe(false);

    const result3 = validateSQL('DROP TABLE test');
    expect(result3.valid).toBe(false);
  });

  it('should accept complex WHERE clauses', () => {
    const result = validateSQL(
      'column1 = value1 AND column2 > 100 OR column3 LIKE "%test%"'
    );
    expect(result.valid).toBe(true);
  });

  it('should accept IN clauses', () => {
    const result = validateSQL('column IN (1, 2, 3)');
    expect(result.valid).toBe(true);
  });

  it('should accept BETWEEN clauses', () => {
    const result = validateSQL('column BETWEEN 1 AND 100');
    expect(result.valid).toBe(true);
  });

  it('should accept IS NULL clauses', () => {
    const result = validateSQL('column IS NULL');
    expect(result.valid).toBe(true);
  });

  it('should accept IS NOT NULL clauses', () => {
    const result = validateSQL('column IS NOT NULL');
    expect(result.valid).toBe(true);
  });
});

describe('validateFilter', () => {
  it('should accept empty filter', () => {
    const result = validateFilter('');
    expect(result.valid).toBe(true);
  });

  it('should accept null filter', () => {
    const result = validateFilter(null as unknown as string);
    expect(result.valid).toBe(true);
  });

  it('should accept whitespace-only filter', () => {
    const result = validateFilter('   ');
    expect(result.valid).toBe(true);
  });

  it('should accept valid WHERE clause', () => {
    const result = validateFilter('column = value');
    expect(result.valid).toBe(true);
  });

  it('should accept AND operator', () => {
    const result = validateFilter('column1 = value1 AND column2 = value2');
    expect(result.valid).toBe(true);
  });

  it('should accept OR operator', () => {
    const result = validateFilter('column1 = value1 OR column2 = value2');
    expect(result.valid).toBe(true);
  });

  it('should accept NOT operator', () => {
    const result = validateFilter('NOT column = value');
    expect(result.valid).toBe(true);
  });

  it('should accept IN operator', () => {
    const result = validateFilter('column IN (1, 2, 3)');
    expect(result.valid).toBe(true);
  });

  it('should accept LIKE operator', () => {
    const result = validateFilter('column LIKE "%test%"');
    expect(result.valid).toBe(true);
  });

  it('should accept BETWEEN operator', () => {
    const result = validateFilter('column BETWEEN 1 AND 100');
    expect(result.valid).toBe(true);
  });

  it('should accept IS NULL', () => {
    const result = validateFilter('column IS NULL');
    expect(result.valid).toBe(true);
  });

  it('should reject DROP in filter', () => {
    const result = validateFilter('DROP TABLE');
    expect(result.valid).toBe(false);
  });

  it('should reject DELETE in filter', () => {
    const result = validateFilter('DELETE FROM table');
    expect(result.valid).toBe(false);
  });

  it('should reject multiple statements in filter', () => {
    const result = validateFilter('column = value; DROP TABLE');
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeColumnName', () => {
  it('should accept valid column names', () => {
    const result = sanitizeColumnName('column_name');
    expect(result).toBe('column_name');
  });

  it('should trim whitespace', () => {
    const result = sanitizeColumnName('  column_name  ');
    expect(result).toBe('column_name');
  });

  it('should reject column names with semicolons', () => {
    expect(() => sanitizeColumnName('col;umn')).toThrow('invalid characters');
  });

  it('should reject column names with single quotes', () => {
    expect(() => sanitizeColumnName("col'umn")).toThrow('invalid characters');
  });

  it('should reject column names with double quotes', () => {
    expect(() => sanitizeColumnName('col"umn')).toThrow('invalid characters');
  });

  it('should reject column names with backticks', () => {
    expect(() => sanitizeColumnName('col`umn')).toThrow('invalid characters');
  });

  it('should reject SQL keywords', () => {
    expect(() => sanitizeColumnName('SELECT')).toThrow('SQL keyword');
    expect(() => sanitizeColumnName('FROM')).toThrow('SQL keyword');
    expect(() => sanitizeColumnName('WHERE')).toThrow('SQL keyword');
  });

  it('should reject empty column names', () => {
    expect(() => sanitizeColumnName('')).toThrow('non-empty string');
  });

  it('should reject whitespace-only column names', () => {
    expect(() => sanitizeColumnName('   ')).toThrow('non-empty string');
  });

  it('should reject non-string input', () => {
    expect(() => sanitizeColumnName(null as unknown as string)).toThrow('non-empty string');
  });

  it('should be case-insensitive for keyword checking', () => {
    expect(() => sanitizeColumnName('SELECT')).toThrow('SQL keyword');
    expect(() => sanitizeColumnName('select')).toThrow('SQL keyword');
    expect(() => sanitizeColumnName('Select')).toThrow('SQL keyword');
  });
});