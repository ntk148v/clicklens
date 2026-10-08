import {
  format,
  type FunctionNode,
  type SelectQueryNode,
} from '@clickhouse/parser'
import {
  hasTrailingClauses,
  isSelectStatement,
  parseSql,
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

/** Build `EXPLAIN <type> <query>`. An existing EXPLAIN prefix is replaced. */
export function toExplain(statementSql: string, type: string): string {
  const result = parseSql(statementSql)
  if (result.ok && result.statements.length === 1) {
    const [statement] = result.statements
    if (statement.type === 'Explain' && statement.query) {
      const { start, end } = span(statement.query)
      return `EXPLAIN ${type} ${statementSql.slice(start, end)}`
    }
  }
  return `EXPLAIN ${type} ${statementSql}`
}

export type RewriteResult =
  { ok: true; sql: string } | { ok: false; reason: string }

function singleSelect(statement: Statement): SelectQueryNode | null {
  if (
    statement.type !== 'SelectWithUnionQuery' ||
    statement.selects.length !== 1
  )
    return null
  const select = statement.selects[0]
  return select.type === 'SelectQuery' ? (select as SelectQueryNode) : null
}

/**
 * Add `condition` to the WHERE clause of a single top-level SELECT. The
 * statement is formatted again from the AST: text inserts at AST spans can
 * change operator precedence, because WHERE spans exclude parentheses.
 */
export function injectTimeRange(sql: string, condition: string): RewriteResult {
  const result = parseSql(sql)
  if (!result.ok)
    return {
      ok: false,
      reason: `Cannot parse the query: ${result.error.message}`,
    }
  if (result.statements.length !== 1) {
    return {
      ok: false,
      reason: 'The editor must contain exactly one statement',
    }
  }

  const [statement] = result.statements
  const select = singleSelect(statement)
  if (!select) return { ok: false, reason: 'The query must be a single SELECT' }
  if (!select.from)
    return { ok: false, reason: 'The query must have a FROM clause' }

  const conditionResult = parseSql(`SELECT 1 WHERE ${condition}`)
  const conditionSelect =
    conditionResult.ok && conditionResult.statements.length === 1
      ? singleSelect(conditionResult.statements[0])
      : null
  if (!conditionSelect?.where)
    return { ok: false, reason: 'Invalid time range condition' }

  select.where = select.where
    ? ({
        type: 'Function',
        name: 'and',
        arguments: [select.where, conditionSelect.where],
        is_operator: true,
      } as unknown as FunctionNode)
    : conditionSelect.where

  return { ok: true, sql: format([statement]) }
}
