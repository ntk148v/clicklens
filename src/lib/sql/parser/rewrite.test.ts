import { describe, expect, test } from 'bun:test'
import { formatNode, parse } from '@clickhouse/parser'
import { parseSql } from './parse'
import { injectTimeRange, paginate, toExplain } from './rewrite'

function only(sql: string) {
  const result = parseSql(sql)
  if (!result.ok) throw new Error(result.error.message)
  return result.statements[0]
}

function whereOf(sql: string): string {
  const statement = parse(sql)[0]
  if (statement.type !== 'SelectWithUnionQuery') throw new Error('not a SELECT')
  const select = statement.selects[0]
  if (select.type !== 'SelectQuery' || !select.where)
    throw new Error('no WHERE')
  return formatNode(select.where).replace(/\s+/g, ' ')
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

  describe('toExplain', () => {
    test('adds EXPLAIN to a query', () => {
      expect(toExplain('SELECT 1', 'PLAN')).toBe('EXPLAIN PLAN SELECT 1')
    })

    test('replaces an existing EXPLAIN and keeps the query', () => {
      expect(toExplain('EXPLAIN SELECT 1', 'PLAN')).toBe(
        'EXPLAIN PLAN SELECT 1',
      )
      expect(toExplain('EXPLAIN PIPELINE SELECT 1', 'AST')).toBe(
        'EXPLAIN AST SELECT 1',
      )
      expect(
        toExplain('-- note\nEXPLAIN SYNTAX SELECT a FROM t', 'PLAN'),
      ).toBe('EXPLAIN PLAN SELECT a FROM t')
    })

    test('keeps text that does not parse, so the server reports the error', () => {
      expect(toExplain('SELECT (', 'PLAN')).toBe('EXPLAIN PLAN SELECT (')
    })
  })

  describe('injectTimeRange', () => {
    const condition = 'ts > 1'

    test('adds a WHERE clause', () => {
      const result = injectTimeRange('SELECT a FROM t ORDER BY a', condition)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(whereOf(result.sql)).toBe('ts > 1')
        expect(result.sql).toContain('ORDER BY a')
      }
    })

    test('adds the condition to an existing WHERE and keeps precedence', () => {
      const result = injectTimeRange(
        'SELECT a FROM t WHERE (x = 1) OR (y = 2)',
        condition,
      )
      expect(result.ok).toBe(true)
      if (result.ok)
        expect(whereOf(result.sql)).toBe('(x = 1 OR y = 2) AND ts > 1')
    })

    test('does not change a WHERE inside a CTE or subquery', () => {
      const result = injectTimeRange(
        'WITH c AS (SELECT a FROM u WHERE b ORDER BY a) SELECT * FROM c',
        condition,
      )
      expect(result.ok).toBe(true)
      if (result.ok) expect(whereOf(result.sql)).toBe('ts > 1')
    })

    test('rejects text that it cannot change safely', () => {
      const reason = (sql: string, cond = condition) => {
        const result = injectTimeRange(sql, cond)
        expect(result.ok).toBe(false)
        return result.ok ? '' : result.reason
      }
      expect(reason('SELECT 1; SELECT 2')).toContain('exactly one statement')
      expect(reason('SELECT 1 UNION ALL SELECT 2')).toContain('single SELECT')
      expect(reason('SELECT now()')).toContain('FROM clause')
      expect(reason('SHOW TABLES')).toContain('single SELECT')
      expect(reason('SELECT (')).toContain('Cannot parse the query')
    })

    test('rejects an invalid condition', () => {
      const result = injectTimeRange('SELECT a FROM t', 'ts >')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toContain('Invalid time range')
    })

    test('joins a plain AND chain with the condition', () => {
      const result = injectTimeRange(
        'SELECT a FROM t WHERE x = 1 AND y = 2',
        condition,
      )
      expect(result.ok).toBe(true)
      if (result.ok)
        expect(whereOf(result.sql)).toBe('(x = 1 AND y = 2) AND ts > 1')
    })
  })
})
