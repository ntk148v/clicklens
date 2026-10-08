import { describe, expect, spyOn, test } from 'bun:test'
import * as clickhouseParser from '@clickhouse/parser'
import { validateReadOnlySql } from './classify'

const code = (sql: string) => {
  const result = validateReadOnlySql(sql)
  return result.ok ? 'OK' : result.code
}

describe('sql/parser/classify', () => {
  test('allows read statements', () => {
    for (const sql of [
      'SELECT 1',
      'SELECT * FROM system.tables',
      'WITH c AS (SELECT 1) SELECT * FROM c',
      'SELECT 1 UNION ALL SELECT 2',
      'SHOW TABLES',
      'SHOW DATABASES',
      'SHOW CREATE TABLE t',
      'DESCRIBE TABLE system.tables',
      'DESC t',
      'EXPLAIN SELECT 1',
      'EXISTS TABLE system.tables',
      'CHECK TABLE t',
      'USE db',
      '/* comment */ SELECT 1',
      '-- comment\nSELECT 1',
      'SELECT 1;',
    ]) {
      expect([sql, code(sql)]).toEqual([sql, 'OK'])
    }
  })

  test('rejects write and DDL statements', () => {
    for (const sql of [
      'DROP TABLE t',
      'INSERT INTO t VALUES (1)',
      'ALTER TABLE t DELETE WHERE 1',
      'TRUNCATE TABLE t',
      'CREATE TABLE t (id UInt8) ENGINE = Memory',
      'SET max_threads = 1',
    ]) {
      expect([sql, code(sql)]).toEqual([sql, 'FORBIDDEN_STATEMENT'])
    }
  })

  test('rejects forbidden functions at any depth', () => {
    for (const sql of [
      "SELECT * FROM file('test.csv')",
      "SELECT * FROM url('http://evil.com')",
      "SELECT * FROM t WHERE x IN (SELECT 1 FROM s3('bucket'))",
      "SELECT * FROM REMOTE('host', db.t)",
      'SELECT * FROM numbers(10)',
    ]) {
      expect([sql, code(sql)]).toEqual([sql, 'FORBIDDEN_STATEMENT'])
    }
  })

  test('allows forbidden names inside strings and as column names', () => {
    expect(code("SELECT 'file(x)', url FROM t")).toBe('OK')
  })

  test('rejects multiple statements', () => {
    expect(code('SELECT 1; SELECT 2')).toBe('MULTIPLE_STATEMENTS')
  })

  test('rejects syntax errors and empty input', () => {
    expect(code('SELECT (')).toBe('SYNTAX_ERROR')
    expect(code('')).toBe('SYNTAX_ERROR')
    expect(code('   ')).toBe('SYNTAX_ERROR')
  })

  test('returns the parsed statement', () => {
    const result = validateReadOnlySql('SELECT 1')
    expect(result.ok && result.statement.type).toBe('SelectWithUnionQuery')
  })

  test('fails closed when the post-parse walk throws', () => {
    const spy = spyOn(clickhouseParser, 'findNodes').mockImplementation(() => {
      throw new RangeError('Maximum call stack size exceeded')
    })
    try {
      const result = validateReadOnlySql('SELECT 1')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('FORBIDDEN_STATEMENT')
    } finally {
      spy.mockRestore()
    }
  })
})
