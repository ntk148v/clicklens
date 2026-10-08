import { describe, expect, test } from 'bun:test'
import { parseSql } from './parse'
import { paginate } from './rewrite'

function only(sql: string) {
  const result = parseSql(sql)
  if (!result.ok) throw new Error(result.error.message)
  return result.statements[0]
}

const page = (sql: string) => paginate(only(sql), sql, 2, 10)

describe('sql/parser/rewrite', () => {
  describe('paginate', () => {
    test('wraps a SELECT', () => {
      expect(page('SELECT a FROM t')).toBe(
        'SELECT * FROM (\nSELECT a FROM t\n) LIMIT 10 OFFSET 20',
      )
    })

    test('handles a trailing line comment', () => {
      const result = page('SELECT a FROM t -- note')
      expect(result).toEndWith('\n) LIMIT 10 OFFSET 20')
      expect(parseSql(result).ok).toBe(true)
    })

    test('drops a trailing semicolon and comment', () => {
      expect(page('SELECT a FROM t; -- note')).toBe(
        'SELECT * FROM (\nSELECT a FROM t\n) LIMIT 10 OFFSET 20',
      )
    })

    test('wraps WITH and UNION queries', () => {
      expect(parseSql(page('WITH c AS (SELECT 1) SELECT * FROM c')).ok).toBe(
        true,
      )
      expect(page('(SELECT 1) UNION ALL (SELECT 2)')).toBe(
        'SELECT * FROM (\n(SELECT 1) UNION ALL (SELECT 2)\n) LIMIT 10 OFFSET 20',
      )
    })

    test('does not wrap queries with FORMAT, SETTINGS or INTO OUTFILE', () => {
      for (const sql of [
        'SELECT 1 FORMAT JSON',
        'SELECT 1 FORMAT JSON SETTINGS max_threads = 1',
        "SELECT 1 INTO OUTFILE 'x'",
      ]) {
        expect(page(sql)).toBe(sql)
      }
    })

    test('does not wrap statements that are not SELECT', () => {
      expect(page('SHOW TABLES')).toBe('SHOW TABLES')
      expect(page('EXPLAIN SELECT 1')).toBe('EXPLAIN SELECT 1')
    })
  })
})
