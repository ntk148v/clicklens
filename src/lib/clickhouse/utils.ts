/**
 * ClickHouse SQL Helper Functions
 */

/**
 * Quote an identifier (table name, column name, etc.)
 * wraps in backticks and escapes existing backticks
 */
export function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

/**
 * Escape a string literal for use in a SQL query
 * Escapes single quotes and backslashes
 */
export function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "''");
}
