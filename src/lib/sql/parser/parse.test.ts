import { describe, expect, test } from 'bun:test'
import { hasTrailingClauses, isSelectStatement, parseSql, span } from './parse'

function only(sql: string) {
  const result = parseSql(sql)
  if (!result.ok) throw new Error(result.error.message)
  return result.statements[0]
}

describe('sql/parser/parse', () => {
  test('parses one statement', () => {
    const result = parseSql('SELECT 1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.statements.length).toBe(1)
  })

  test('returns no statements for empty input', () => {
    expect(parseSql('')).toEqual({ ok: true, statements: [] })
  })

  test('drops empty statements between semicolons', () => {
    const result = parseSql('SELECT 1;;SELECT 2')
    expect(result.ok && result.statements.length).toBe(2)
  })

  test('returns the position of a syntax error', () => {
    const result = parseSql('SELECT (')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.offset).toBe(8)
      expect(result.error.line).toBe(1)
      expect(result.error.column).toBe(9)
    }
  })

  test('returns an error for very deep nesting and does not throw', () => {
    const sql = 'SELECT ' + '('.repeat(5000) + '1' + ')'.repeat(5000)
    const result = parseSql(sql)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('nested too deeply')
    expect(parseSql('SELECT 1').ok).toBe(true)
  })

  test('span returns string offsets', () => {
    const sql = "SELECT 'é', a FROM t"
    expect(span(only(sql))).toEqual({ start: 0, end: sql.length })
  })

  test('hasTrailingClauses detects FORMAT, SETTINGS and INTO OUTFILE', () => {
    expect(hasTrailingClauses(only('SELECT 1 FORMAT JSON'))).toBe(true)
    expect(
      hasTrailingClauses(only('SELECT 1 FORMAT JSON SETTINGS max_threads = 1')),
    ).toBe(true)
    expect(hasTrailingClauses(only("SELECT 1 INTO OUTFILE 'x'"))).toBe(true)
    expect(hasTrailingClauses(only('SELECT 1'))).toBe(false)
  })

  test('isSelectStatement', () => {
    expect(
      isSelectStatement(only('WITH c AS (SELECT 1) SELECT * FROM c')),
    ).toBe(true)
    expect(isSelectStatement(only('SELECT 1 UNION ALL SELECT 2'))).toBe(true)
    expect(isSelectStatement(only('SHOW TABLES'))).toBe(false)
    expect(isSelectStatement(only('EXPLAIN SELECT 1'))).toBe(false)
  })
})
