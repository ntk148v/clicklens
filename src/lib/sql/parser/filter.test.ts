import { describe, expect, spyOn, test } from 'bun:test'
import * as clickhouseParser from '@clickhouse/parser'
import { parseSql } from './parse'
import { validateFilter } from './filter'

const sqlOf = (filter: string) => {
  const result = validateFilter(filter)
  if (!result.ok) throw new Error(result.reason)
  return result.sql.replace(/\s+/g, ' ')
}
const rejected = (filter: string) => !validateFilter(filter).ok

describe('sql/parser/filter', () => {
  test('returns empty SQL for an empty filter', () => {
    expect(validateFilter('')).toEqual({ ok: true, sql: '' })
    expect(validateFilter('   ')).toEqual({ ok: true, sql: '' })
  })

  test('regenerates a simple filter', () => {
    expect(sqlOf("level = 'error' AND msg LIKE '%ab%'")).toBe(
      "level = 'error' AND msg LIKE '%ab%'",
    )
    expect(sqlOf('`my col` = 1')).toContain('my col')
  })

  test('removes comments', () => {
    expect(sqlOf('a = 1 -- c')).toBe('a = 1')
    expect(sqlOf('a = 1 /* x */ AND b IN (1, 2)')).not.toContain('/*')
  })

  test('output is safe to put inside parentheses', () => {
    const sql = validateFilter('a = 1 OR b = 2 -- trailing')
    expect(sql.ok).toBe(true)
    if (sql.ok)
      expect(parseSql(`SELECT 1 WHERE (${sql.sql}) AND z = 1`).ok).toBe(true)
  })

  test('rejects anything that is not one boolean expression', () => {
    for (const filter of [
      '1=1; DROP TABLE t',
      '1=1) OR (1=1',
      '1 = 1 UNION ALL SELECT password FROM users',
      '1 SETTINGS max_threads = 1',
      '1 FORMAT JSON',
      '1 GROUP BY x',
      '1 ORDER BY x',
      '1 LIMIT 1',
    ]) {
      expect([filter, rejected(filter)]).toEqual([filter, true])
    }
  })

  test('allows subqueries', () => {
    expect(sqlOf('user_id IN (SELECT id FROM users WHERE active)')).toContain(
      'FROM users',
    )
  })

  test('rejects table functions at any depth', () => {
    expect(rejected("x IN (SELECT 1 FROM s3('u'))")).toBe(true)
    expect(rejected("x IN (SELECT 1 FROM merge('db', '.*'))")).toBe(true)
  })

  test('rejects system tables at any depth', () => {
    expect(rejected('x IN (SELECT name FROM system.users)')).toBe(true)
    expect(rejected('x IN (SELECT name FROM SYSTEM.users)')).toBe(true)
  })

  test('rejects forbidden scalar functions', () => {
    expect(rejected("file('x') = ''")).toBe(true)
  })

  test('fails closed when the post-parse walk throws', () => {
    const spy = spyOn(clickhouseParser, 'findNodes').mockImplementation(() => {
      throw new RangeError('Maximum call stack size exceeded')
    })
    try {
      const result = validateFilter("level = 'Error'")
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toContain('could not be validated')
    } finally {
      spy.mockRestore()
    }
  })
})
