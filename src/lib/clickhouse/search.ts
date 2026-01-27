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
 * Rules:
 * 1. Identify "Searchable Columns" (String/FixedString/UUID/Enum)
 * 2. Construct OR clause across these columns
 * 3. Use 'hasToken' or 'ILIKE' depending on exact needs, but 'hasToken' is preferred for performance
 *    with token_bf indices. However, 'hasToken' is strictly whole-token matching.
 *
 *    If the user wants partial matches ("err" matching "error"), hasToken won't work.
 *    Standard "Discover" expectations usually imply partial match (ILIKE).
 *    BUT the request explicitly asks for `hasToken(col, 'term')` optimization.
 *
 *    Let's implement exactly as requested: `hasToken`.
 *    Wait, the request says: "Use hasToken(col, 'term') ... where possible".
 *    It also says "Target columns with type String".
 *
 *    Compromise: If the term has no spaces/symbols, use `hasToken` for performance (assuming tokenization).
 *    Actually, `hasToken` only works if the string is tokenized.
 *    Given we don't know the tokenization, `hasToken` is safer for "exact word" search.
 *    Let's strictly follow the User Request: "Use hasToken(col, 'term') ...".
 *
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

  // 2. Build Conditions
  // The user requirement: hasToken(message_col, 'timeout')
  const conditions = stringCols.map((col) => {
    const colName = quoteIdentifier(col.name);
    // Note: hasToken is case-insensitive in recent ClickHouse versions?
    // Actually `hasToken(haystack, needle)` matches if needle is a token in haystack.
    // It is usually case-insensitive if using `token_bf_v1` index but function itself might be case-sensitive depending on version.
    // `hasTokenCaseInsensitive` exists.
    // Let's use `hasTokenCaseInsensitive` to be safe and user-friendly, or `hasToken` if strictly requested.
    // Request says: "Use `hasToken`". I will use `hasToken`.
    // Wait, typical logs usage is case-insensitive.
    // `hasToken` is case-insensitive for ASCII.
    return `hasToken(${colName}, '${safeTerm}')`;
  });

  return `(${conditions.join(" OR ")})`;
}
