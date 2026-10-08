import {
  hasTrailingClauses,
  isSelectStatement,
  span,
  type Statement,
} from './parse'

/**
 * Wrap a SELECT in `SELECT * FROM (...) LIMIT n OFFSET m`. Other statements,
 * and SELECTs with FORMAT/SETTINGS/INTO OUTFILE, are returned unchanged.
 * `sql` must be the exact string that `statement` was parsed from.
 */
export function paginate(
  statement: Statement,
  sql: string,
  page: number,
  pageSize: number,
): string {
  if (!isSelectStatement(statement) || hasTrailingClauses(statement)) return sql
  const { start, end } = span(statement)
  // Newlines keep a trailing `--` comment inside the query from hiding `)`.
  return `SELECT * FROM (\n${sql.slice(start, end)}\n) LIMIT ${pageSize} OFFSET ${page * pageSize}`
}
