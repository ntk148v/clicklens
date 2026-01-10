/**
 * SQL Context Analyzer for intelligent autocompletion
 * Analyzes cursor position and query structure to provide contextual suggestions
 */

export type SQLContextType =
  | "DEFAULT"
  | "AFTER_SELECT"
  | "AFTER_FROM"
  | "AFTER_JOIN"
  | "AFTER_WHERE"
  | "AFTER_GROUP_BY"
  | "AFTER_ORDER_BY"
  | "AFTER_DOT"
  | "IN_FUNCTION"
  | "AFTER_DATABASE_KEYWORD";

export interface TableReference {
  database?: string;
  table: string;
  alias?: string;
}

export interface SQLContext {
  type: SQLContextType;
  tables: TableReference[];
  aliases: Map<string, string>; // alias -> fully qualified table name
  currentClause: string;
  precedingWord?: string;
  functionName?: string; // For function parameter hints
}

// Keywords that trigger table suggestions
const TABLE_KEYWORDS = ["from", "join", "into", "table", "update"];
const DATABASE_KEYWORDS = ["use", "database"];

/**
 * Parse table references with optional aliases from SQL
 * Handles: "table", "table alias", "table AS alias", "db.table", "db.table AS alias"
 */
export function parseTableAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>();

  // Match FROM/JOIN clauses with optional database prefix and alias
  // Pattern: FROM/JOIN [database.]table [AS] [alias]
  const fromJoinPattern =
    /(?:FROM|JOIN)\s+([`"]?\w+[`"]?\.)?([`"]?\w+[`"]?)(?:\s+(?:AS\s+)?([`"]?\w+[`"]?))?/gi;

  let match;
  while ((match = fromJoinPattern.exec(sql)) !== null) {
    const database = match[1]?.replace(/[`".]/g, "");
    const table = match[2]?.replace(/[`"]/g, "");
    const alias = match[3]?.replace(/[`"]/g, "");

    if (table) {
      const fullTableName = database ? `${database}.${table}` : table;

      // If there's an alias, map it to the table
      if (alias && !isKeyword(alias)) {
        aliases.set(alias.toLowerCase(), fullTableName);
      }
      // Also map the table name itself (for direct table.column access)
      aliases.set(table.toLowerCase(), fullTableName);
    }
  }

  return aliases;
}

/**
 * Check if a word is a SQL keyword (to avoid treating keywords as aliases)
 */
function isKeyword(word: string): boolean {
  const keywords = new Set([
    "where",
    "and",
    "or",
    "on",
    "using",
    "group",
    "order",
    "having",
    "limit",
    "offset",
    "union",
    "left",
    "right",
    "inner",
    "outer",
    "cross",
    "full",
    "natural",
    "join",
    "select",
    "from",
    "as",
  ]);
  return keywords.has(word.toLowerCase());
}

/**
 * Find the word immediately before a position (for dot completions)
 */
export function findPrecedingWord(
  text: string,
  pos: number
): string | undefined {
  // Get text before cursor, remove trailing dot if present
  const beforeCursor = text.slice(0, pos).replace(/\.\s*$/, "");

  // Find the last word before the dot
  const match = beforeCursor.match(/(\w+)\s*$/);
  return match?.[1];
}

/**
 * Find if we're inside a function call and which function
 */
function findFunctionContext(
  text: string
): { name: string; paramIndex: number } | undefined {
  // Find the last unclosed parenthesis
  let parenDepth = 0;
  let funcStart = -1;

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === ")") parenDepth++;
    else if (text[i] === "(") {
      if (parenDepth === 0) {
        funcStart = i;
        break;
      }
      parenDepth--;
    }
  }

  if (funcStart === -1) return undefined;

  // Extract function name before the opening paren
  const beforeParen = text.slice(0, funcStart);
  const funcMatch = beforeParen.match(/(\w+)\s*$/);
  if (!funcMatch) return undefined;

  // Count commas to determine parameter index
  const insideParen = text.slice(funcStart + 1);
  const paramIndex = (insideParen.match(/,/g) || []).length;

  return { name: funcMatch[1].toLowerCase(), paramIndex };
}

/**
 * Detect the current SQL clause based on cursor position
 */
function detectCurrentClause(textBeforeCursor: string): string {
  const upperText = textBeforeCursor.toUpperCase();

  // Check clauses in reverse order of typical appearance
  const clauses = [
    "LIMIT",
    "OFFSET",
    "HAVING",
    "ORDER BY",
    "GROUP BY",
    "WHERE",
    "PREWHERE",
    "ON",
    "JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "INNER JOIN",
    "CROSS JOIN",
    "ARRAY JOIN",
    "FROM",
    "INTO",
    "SELECT",
  ];

  for (const clause of clauses) {
    const lastIndex = upperText.lastIndexOf(clause);
    if (lastIndex !== -1) {
      return clause;
    }
  }

  return "SELECT";
}

/**
 * Analyze SQL context at a given cursor position
 */
export function analyzeContext(sql: string, cursorPos: number): SQLContext {
  const textBeforeCursor = sql.slice(0, cursorPos);
  const lowerText = textBeforeCursor.toLowerCase();

  // Parse all table references and aliases from the full query
  const aliases = parseTableAliases(sql);
  const tables: TableReference[] = [];

  aliases.forEach((fullName, alias) => {
    const parts = fullName.split(".");
    tables.push({
      database: parts.length > 1 ? parts[0] : undefined,
      table: parts.length > 1 ? parts[1] : parts[0],
      alias:
        alias !== fullName.split(".").pop()?.toLowerCase() ? alias : undefined,
    });
  });

  // Detect current clause
  const currentClause = detectCurrentClause(textBeforeCursor);

  // Default context
  const context: SQLContext = {
    type: "DEFAULT",
    tables,
    aliases,
    currentClause,
  };

  // Check for dot completion (alias. or table. or database.)
  if (textBeforeCursor.trimEnd().endsWith(".")) {
    const precedingWord = findPrecedingWord(textBeforeCursor, cursorPos);
    if (precedingWord) {
      context.type = "AFTER_DOT";
      context.precedingWord = precedingWord;
      return context;
    }
  }

  // Check for function context
  const funcContext = findFunctionContext(textBeforeCursor);
  if (funcContext) {
    context.type = "IN_FUNCTION";
    context.functionName = funcContext.name;
    return context;
  }

  // Get the last few words to determine context
  const words = lowerText.trim().split(/\s+/);
  const prevWord = words[words.length - 2] || "";

  // Check for specific keyword contexts
  if (TABLE_KEYWORDS.includes(prevWord)) {
    context.type = "AFTER_FROM";
    return context;
  }

  if (DATABASE_KEYWORDS.includes(prevWord)) {
    context.type = "AFTER_DATABASE_KEYWORD";
    return context;
  }

  // Context based on current clause
  switch (currentClause) {
    case "SELECT":
      context.type = "AFTER_SELECT";
      break;
    case "FROM":
    case "INTO":
      context.type = "AFTER_FROM";
      break;
    case "JOIN":
    case "LEFT JOIN":
    case "RIGHT JOIN":
    case "INNER JOIN":
    case "CROSS JOIN":
      context.type = "AFTER_JOIN";
      break;
    case "WHERE":
    case "PREWHERE":
    case "ON":
    case "HAVING":
      context.type = "AFTER_WHERE";
      break;
    case "GROUP BY":
      context.type = "AFTER_GROUP_BY";
      break;
    case "ORDER BY":
      context.type = "AFTER_ORDER_BY";
      break;
  }

  return context;
}

/**
 * Extract table name from a potentially qualified name (handles database.table)
 */
export function extractTableName(qualifiedName: string): {
  database?: string;
  table: string;
} {
  const parts = qualifiedName.split(".");
  if (parts.length === 2) {
    return { database: parts[0], table: parts[1] };
  }
  return { table: parts[0] };
}
