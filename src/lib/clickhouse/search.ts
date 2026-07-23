import { quoteIdentifier, escapeSqlString } from "./utils";

/**
 * Interface representing a column from system.columns
 */
export interface ColumnDefinition {
  name: string;
  type: string;
}

/**
 * Check if a column type matches generic String / FixedString
 * Ignores LowCardinality wrapper for the check.
 */
function isStringColumn(type: string): boolean {
  if (!type) return false;
  const normalized = type
    .replace("LowCardinality(", "")
    .replace(")", "")
    .trim();
  return (
    normalized.startsWith("String") ||
    normalized.startsWith("FixedString") ||
    normalized.startsWith("UUID") ||
    normalized.startsWith("Enum")
  );
}

/**
 * Build a "Smart Search" SQL condition
 *
 * 1. Identify "Searchable Columns" (String/FixedString/UUID/Enum)
 * 2. Construct OR clause across these columns
 * 3. Use hasTokenCaseInsensitive for whole-token matching (works with token_bf indices).
 *    For partial matching, users can use ILIKE in the filter directly.
 */
export function buildSmartSearchCondition(
  columns: ColumnDefinition[],
  searchTerm: string,
): string {
  if (!searchTerm || !searchTerm.trim()) {
    return "";
  }

  const safeTerm = escapeSqlString(searchTerm);

  // 1. Identify searchable columns
  const stringCols = columns.filter((c) => isStringColumn(c.type));

  if (stringCols.length === 0) {
    // Fallback: If no string columns, maybe try to match mapped column if we knew it,
    // but here we just return false (no match) or stay silent?
    // Returning "0" (false) to indicate no results is correct if explicit search is requested.
    return "0";
  }

  const conditions = stringCols.map((col) => {
    const colName = quoteIdentifier(col.name);
    return `hasTokenCaseInsensitive(${colName}, '${safeTerm}')`;
  });

  return `(${conditions.join(" OR ")})`;
}
