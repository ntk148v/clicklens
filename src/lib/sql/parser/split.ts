import { hasTrailingClauses, parseSql, span } from './parse'

export interface StatementSpan {
  sql: string
  start: number
  end: number
}

/**
 * Split editor text into statements. If the text does not parse, return it
 * as one statement so that the server reports the syntax error.
 */
export function splitStatements(sql: string): StatementSpan[] {
  if (!sql.trim()) return []

  const result = parseSql(sql)
  if (!result.ok) {
    const text = sql.trim()
    const start = sql.length - sql.trimStart().length
    return [{ sql: text, start, end: start + text.length }]
  }

  const { statements } = result
  return statements.map((statement, index) => {
    const { start, end } = span(statement)
    if (!hasTrailingClauses(statement)) {
      return { sql: sql.slice(start, end), start, end }
    }
    // The location stops before FORMAT/SETTINGS/INTO OUTFILE, so take the
    // text up to the next statement and drop the separator.
    const regionEnd =
      index + 1 < statements.length
        ? span(statements[index + 1]).start
        : sql.length
    const text = sql
      .slice(start, regionEnd)
      .trimEnd()
      .replace(/;$/, '')
      .trimEnd()
    return { sql: text, start, end: start + text.length }
  })
}

/** The statement at the cursor, or the previous one when the cursor is between statements. */
export function statementAt(sql: string, cursor: number): StatementSpan | null {
  const statements = splitStatements(sql)
  let current: StatementSpan | null = statements[0] ?? null
  for (const statement of statements) {
    if (statement.start > cursor) break
    current = statement
  }
  return current
}
