/**
 * SQL Statement Splitter
 * Splits SQL text into individual statements, respecting:
 * - String literals (single and double quotes)
 * - Comments (-- single line and block comments)
 * - Escaped quotes
 */

/**
 * Split SQL text into individual statements
 * @param sql The SQL text potentially containing multiple statements
 * @returns Array of individual SQL statements (trimmed, non-empty)
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Check for single-line comment (--)
    if (char === "-" && nextChar === "-") {
      const endOfLine = sql.indexOf("\n", i);
      if (endOfLine === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, endOfLine + 1);
      i = endOfLine + 1;
      continue;
    }

    // Check for multi-line comment (/* */)
    if (char === "/" && nextChar === "*") {
      const endComment = sql.indexOf("*/", i + 2);
      if (endComment === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, endComment + 2);
      i = endComment + 2;
      continue;
    }

    // Check for string literals
    if (char === "'" || char === '"') {
      const quote = char;
      current += char;
      i++;

      // Find the end of the string, handling escaped quotes
      while (i < sql.length) {
        const c = sql[i];
        current += c;

        if (c === quote) {
          // Check for escaped quote ('' or "")
          if (sql[i + 1] === quote) {
            current += sql[i + 1];
            i += 2;
            continue;
          }
          // End of string
          i++;
          break;
        }

        // Handle backslash escapes
        if (c === "\\" && i + 1 < sql.length) {
          current += sql[i + 1];
          i += 2;
          continue;
        }

        i++;
      }
      continue;
    }

    // Check for statement terminator
    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      i++;
      continue;
    }

    // Regular character
    current += char;
    i++;
  }

  // Add any remaining statement
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}
