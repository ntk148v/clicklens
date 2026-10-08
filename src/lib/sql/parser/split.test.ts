import { describe, expect, test } from 'bun:test'
import { splitStatements, statementAt } from './split'

const texts = (sql: string) => splitStatements(sql).map((s) => s.sql)

describe('sql/parser/split', () => {
  describe('splitStatements', () => {
    test('splits two statements', () => {
      expect(texts('SELECT 1; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2'])
    })

    test('returns offsets in the original text', () => {
      const [, second] = splitStatements('SELECT 1; SELECT 2')
      expect(second).toEqual({ sql: 'SELECT 2', start: 10, end: 18 })
    })

    test('does not split on a semicolon inside backticks', () => {
      expect(texts('SELECT 1; SELECT `a;b` FROM t')).toEqual([
        'SELECT 1',
        'SELECT `a;b` FROM t',
      ])
    })

    test('does not split on a semicolon inside strings or comments', () => {
      const result = texts("SELECT 'a;b' /* c;d */; SELECT 2 -- e;f")
      expect(result.length).toBe(2)
      expect(result[0]).toStartWith("SELECT 'a;b'")
      expect(result[1]).toStartWith('SELECT 2')
    })

    test('does not split on a semicolon inside a # comment', () => {
      const result = texts('SELECT 1 # x;y\n; SELECT 2')
      expect(result.length).toBe(2)
      expect(result[1]).toBe('SELECT 2')
    })

    test('keeps FORMAT and SETTINGS with their statement', () => {
      expect(
        texts('SELECT 1 FORMAT JSON; SELECT 2 SETTINGS max_threads = 1'),
      ).toEqual(['SELECT 1 FORMAT JSON', 'SELECT 2 SETTINGS max_threads = 1'])
    })

    test('drops empty statements', () => {
      expect(texts('SELECT 1;;SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
    })

    test('returns nothing for blank input', () => {
      expect(splitStatements('')).toEqual([])
      expect(splitStatements('  \n\t ')).toEqual([])
    })

    test('returns the whole trimmed text when it does not parse', () => {
      expect(splitStatements('  SELECT (  ')).toEqual([
        { sql: 'SELECT (', start: 2, end: 10 },
      ])
    })
  })

  describe('statementAt', () => {
    const sql = 'SELECT 1; SELECT 2'

    test('returns the statement that contains the cursor', () => {
      expect(statementAt(sql, 0)?.sql).toBe('SELECT 1')
      expect(statementAt(sql, 12)?.sql).toBe('SELECT 2')
      expect(statementAt(sql, sql.length)?.sql).toBe('SELECT 2')
    })

    test('returns the previous statement when the cursor is between statements', () => {
      expect(statementAt(sql, 9)?.sql).toBe('SELECT 1')
    })

    test('returns the first statement when the cursor is before it', () => {
      expect(statementAt('  SELECT 1', 0)?.sql).toBe('SELECT 1')
    })

    test('returns null for blank input', () => {
      expect(statementAt('', 0)).toBeNull()
    })
  })
})
