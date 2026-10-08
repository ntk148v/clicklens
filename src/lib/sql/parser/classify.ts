import { findNodes } from '@clickhouse/parser'
import { parseSql, type Statement } from './parse'

/** Functions that read or write outside the database. Lower-case. */
export const FORBIDDEN_FUNCTIONS: ReadonlySet<string> = new Set(
  [
    'file',
    'url',
    'remote',
    'remoteSecure',
    's3',
    's3Cluster',
    'gcs',
    'mysql',
    'postgresql',
    'jdbc',
    'odbc',
    'hdfs',
    'input',
    'generateRandom',
    'numbers',
    'zeros',
  ].map((name) => name.toLowerCase()),
)

const READ_ONLY_TYPES = new Set([
  'SelectWithUnionQuery',
  'SelectIntersectExceptQuery',
  'Explain',
  'DescribeQuery',
  'CheckQuery',
  'UseQuery',
])

export type ReadOnlyValidation =
  | { ok: true; statement: Statement }
  | {
      ok: false
      code: 'SYNTAX_ERROR' | 'MULTIPLE_STATEMENTS' | 'FORBIDDEN_STATEMENT'
      reason: string
    }

function isReadOnlyType(type: string): boolean {
  return READ_ONLY_TYPES.has(type) || /^(Show|SHOW|Exists)/.test(type)
}

export function validateReadOnlySql(sql: string): ReadOnlyValidation {
  try {
    return validateReadOnlySqlUnsafe(sql)
  } catch {
    // Fail closed: a walker error (e.g. stack overflow) must never allow a query.
    return {
      ok: false,
      code: 'FORBIDDEN_STATEMENT',
      reason: 'Statement could not be validated.',
    }
  }
}

function validateReadOnlySqlUnsafe(sql: string): ReadOnlyValidation {
  const result = parseSql(sql)
  if (!result.ok) {
    const { line, column, message } = result.error
    return {
      ok: false,
      code: 'SYNTAX_ERROR',
      reason: `Syntax error at line ${line}, column ${column}: ${message}`,
    }
  }

  const { statements } = result
  if (statements.length === 0) {
    return { ok: false, code: 'SYNTAX_ERROR', reason: 'Empty SQL statement' }
  }
  if (statements.length > 1) {
    return {
      ok: false,
      code: 'MULTIPLE_STATEMENTS',
      reason: 'Multiple statements are not allowed. Run them one at a time.',
    }
  }

  const [statement] = statements
  const type = statement.type as string
  if (!isReadOnlyType(type)) {
    return {
      ok: false,
      code: 'FORBIDDEN_STATEMENT',
      reason: `Statement type "${type}" is not allowed. Only read operations are permitted.`,
    }
  }

  const forbidden = findNodes(statements, 'Function').find((fn) =>
    FORBIDDEN_FUNCTIONS.has(fn.name.toLowerCase()),
  )
  if (forbidden) {
    return {
      ok: false,
      code: 'FORBIDDEN_STATEMENT',
      reason: `Function "${forbidden.name}" is not allowed.`,
    }
  }

  return { ok: true, statement }
}
