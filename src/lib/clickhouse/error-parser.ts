export interface QuickFix {
  label: string;
  action: () => void;
}

export interface ParsedError {
  category: 'syntax' | 'timeout' | 'permission' | 'connection' | 'not_found' | 'unknown';
  message: string;
  suggestions: string[];
  quickFixes: QuickFix[];
  details?: string;
}

const ERROR_PATTERNS = {
  syntax: [
    /syntax error/i,
    /unexpected token/i,
    /missing/i,
    /mismatched/i,
  ],
  timeout: [
    /timeout/i,
    /deadline exceeded/i,
    /took too long/i,
  ],
  permission: [
    /access denied/i,
    /permission/i,
    /not authorized/i,
    /privilege/i,
  ],
  connection: [
    /connection refused/i,
    /network/i,
    /unreachable/i,
    /failed to connect/i,
  ],
  not_found: [
    /unknown column/i,
    /table doesn't exist/i,
    /column not found/i,
  ],
};

const SUGGESTIONS = {
  syntax: [
    "Check for unmatched parentheses in your query",
    "Verify all string literals are properly quoted",
    "Check column names match the schema",
  ],
  timeout: [
    "Reduce the time range",
    "Add more filters to limit results",
    "Increase query timeout in settings",
  ],
  permission: [
    "Check RBAC settings for your user",
    "Contact your administrator",
    "Verify you have access to this table",
  ],
  connection: [
    "Check ClickHouse server status",
    "Verify network connectivity",
    "Retry the connection",
  ],
  not_found: [
    "Verify the schema is up to date",
    "Check column name spelling",
    "Refresh the table schema",
  ],
};

export function parseError(error: string | Error): ParsedError {
  const errorMessage = typeof error === 'string' ? error : error.message;

  let category: ParsedError['category'] = 'unknown';
  for (const [cat, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(errorMessage))) {
      category = cat as ParsedError['category'];
      break;
    }
  }

  const details = extractDetails(errorMessage, category);
  const suggestions = category === 'unknown' ? [] : SUGGESTIONS[category];
  const quickFixes = generateQuickFixes(category, details);

  return {
    category,
    message: errorMessage,
    suggestions,
    quickFixes,
    details,
  };
}

function extractDetails(error: string, category: ParsedError['category']): string | undefined {
  if (category === 'not_found') {
    const columnMatch = error.match(/unknown column ['"]([^'"]+)['"]/i);
    if (columnMatch) return columnMatch[1];
    const tableMatch = error.match(/table ['"]([^'"]+)['"] doesn't exist/i);
    if (tableMatch) return tableMatch[1];
  }
  return undefined;
}

function generateQuickFixes(category: ParsedError['category'], details?: string): QuickFix[] {
  const fixes: QuickFix[] = [];

  if (category === 'connection') {
    fixes.push({
      label: 'Retry',
      action: () => {},
    });
  }

  if (category === 'not_found') {
    fixes.push({
      label: 'Refresh Schema',
      action: () => {},
    });
  }

  if (category === 'timeout') {
    fixes.push({
      label: 'Reduce Time Range',
      action: () => {},
    });
  }

  return fixes;
}