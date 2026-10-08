import { parse, ParseError, type Statement } from '@clickhouse/parser'

export type { Statement }

export interface SqlSyntaxError {
  message: string
  offset: number
  line: number
  column: number
}

export type ParseOutcome =
  { ok: true; statements: Statement[] } | { ok: false; error: SqlSyntaxError }

/**
 * Parse ClickHouse SQL. Never throws: syntax errors and stack overflows on
 * deeply nested input come back as `{ ok: false }`.
 */
export function parseSql(sql: string): ParseOutcome {
  try {
    const statements = parse(sql).filter(
      (statement) => (statement.type as string) !== 'EmptyQuery',
    )
    return { ok: true, statements }
  } catch (error) {
    if (error instanceof ParseError) {
      const { offset, line, column } = error.location.start
      return {
        ok: false,
        error: { message: error.message, offset, line, column },
      }
    }
    if (error instanceof RangeError) {
      return {
        ok: false,
        error: {
          message: 'Query is nested too deeply to parse',
          offset: 0,
          line: 1,
          column: 1,
        },
      }
    }
    throw error
  }
}

/** Source range of an AST node, as string indices. */
export function span(node: {
  location: { start: { offset: number }; end: { offset: number } }
}): { start: number; end: number } {
  return { start: node.location.start.offset, end: node.location.end.offset }
}

const TRAILING_CLAUSE_KEYS = ['format', 'settings', 'out_file'] as const

/**
 * True when the statement has FORMAT, SETTINGS or INTO OUTFILE at statement
 * level. The location of a SELECT stops before these clauses.
 */
export function hasTrailingClauses(statement: Statement): boolean {
  return TRAILING_CLAUSE_KEYS.some((key) => key in statement)
}

export function isSelectStatement(statement: Statement): boolean {
  const type = statement.type as string
  return (
    type === 'SelectWithUnionQuery' || type === 'SelectIntersectExceptQuery'
  )
}
