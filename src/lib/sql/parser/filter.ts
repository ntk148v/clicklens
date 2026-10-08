import { findNodes, formatNode } from '@clickhouse/parser'
import { FORBIDDEN_FUNCTIONS } from './classify'
import { parseSql } from './parse'

export type FilterValidation =
  { ok: true; sql: string } | { ok: false; reason: string }

const NOT_ONE_EXPRESSION = 'Filter must be a single boolean expression'
const METADATA_KEYS = [
  'type',
  'location',
  'leadingComments',
  'trailingComments',
]

function hasOnlyKeys(node: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(node).every(
    (key) => METADATA_KEYS.includes(key) || allowed.includes(key),
  )
}

/** formatNode() prints attached comments, so remove them before formatting. */
function stripComments(node: unknown): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach(stripComments)
    return
  }
  const record = node as Record<string, unknown>
  delete record.leadingComments
  delete record.trailingComments
  for (const [key, value] of Object.entries(record)) {
    if (key !== 'parent') stripComments(value)
  }
}

/**
 * Validate a Discover filter. On success, `sql` is SQL regenerated from the
 * validated AST. Send `sql` to ClickHouse, never the raw filter.
 */
export function validateFilter(filter: string): FilterValidation {
  try {
    return validateFilterUnsafe(filter)
  } catch {
    // Fail closed: a walker error (e.g. stack overflow) must never allow a filter.
    return { ok: false, reason: 'Filter could not be validated' }
  }
}

function validateFilterUnsafe(filter: string): FilterValidation {
  const trimmed = filter.trim()
  if (!trimmed) return { ok: true, sql: '' }

  const result = parseSql(`SELECT 1 WHERE ${trimmed}`)
  if (!result.ok)
    return { ok: false, reason: `Syntax error: ${result.error.message}` }

  const { statements } = result
  const statement = statements[0]
  if (
    statements.length !== 1 ||
    statement.type !== 'SelectWithUnionQuery' ||
    !hasOnlyKeys(statement, ['selects']) ||
    statement.selects.length !== 1
  ) {
    return { ok: false, reason: NOT_ONE_EXPRESSION }
  }

  const select = statement.selects[0]
  if (
    select.type !== 'SelectQuery' ||
    !hasOnlyKeys(select, ['select', 'where']) ||
    !select.where
  ) {
    return { ok: false, reason: NOT_ONE_EXPRESSION }
  }

  if (
    findNodes(statements, 'TableExpression').some(
      (table) => table.table_function,
    )
  ) {
    return { ok: false, reason: 'Table functions are not allowed in filters' }
  }

  const forbidden = findNodes(statements, 'Function').find((fn) =>
    FORBIDDEN_FUNCTIONS.has(fn.name.toLowerCase()),
  )
  if (forbidden) {
    return {
      ok: false,
      reason: `Function "${forbidden.name}" is not allowed in filters`,
    }
  }

  const systemTable = findNodes(statements, 'TableIdentifier').some(
    (table) =>
      typeof table.database === 'string' &&
      table.database.toLowerCase() === 'system',
  )
  if (systemTable) {
    return { ok: false, reason: 'System tables are not allowed in filters' }
  }

  stripComments(select.where)
  return { ok: true, sql: formatNode(select.where) }
}
