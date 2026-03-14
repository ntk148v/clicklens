export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const DANGEROUS_KEYWORDS = [
  'DROP',
  'DELETE',
  'ALTER',
  'TRUNCATE',
  'INSERT',
  'UPDATE',
  'CREATE',
  'ATTACH',
  'DETACH',
  'RENAME',
  'KILL',
  'SYSTEM',
  'GRANT',
  'REVOKE',
  'OPTIMIZE',
  'CHECK',
  'REPAIR',
  'MODIFY',
] as const;

const DANGEROUS_PATTERNS = [
  /;.*\S/, // semicolons followed by more SQL (multiple statements) - catches ;SELECT, ; DROP, etc.
  /--/, // SQL comments that could hide malicious code
  /\/\*[\s\S]*?\*\//, // Multi-line comments
  /`[^`]*`/, // Backtick identifiers (could be used for injection)
  /``/, // Escaped backticks
  /\$\$/, // Dollar-quoted strings
  /\\x[0-9a-fA-F]+/, // Hex-encoded characters
  /\\u[0-9a-fA-F]{4}/, // Unicode escape sequences
  /%[0-9a-fA-F]{2}/, // URL-encoded characters
] as const;

export function validateSQL(sql: string): ValidationResult {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'SQL must be a non-empty string' };
  }

  const trimmedSql = sql.trim();

  if (trimmedSql.length === 0) {
    return { valid: false, error: 'SQL cannot be empty' };
  }

  // Check for dangerous keywords (case-insensitive)
  for (const keyword of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(trimmedSql)) {
      return {
        valid: false,
        error: `Dangerous operation not allowed: ${keyword}`,
      };
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmedSql)) {
      return {
        valid: false,
        error: 'Invalid SQL pattern detected',
      };
    }
  }

  // Check for multiple statements
  const statements = trimmedSql.split(';').filter((s) => s.trim());
  if (statements.length > 1) {
    return {
      valid: false,
      error: 'Multiple SQL statements are not allowed',
    };
  }

  // Check for suspicious function calls
  const suspiciousFunctions = [
    'eval',
    'exec',
    'system',
    'shell_exec',
    'passthru',
    'popen',
    'proc_open',
  ];
  for (const func of suspiciousFunctions) {
    const regex = new RegExp(`\\b${func}\\s*\\(`, 'i');
    if (regex.test(trimmedSql)) {
      return {
        valid: false,
        error: `Suspicious function call detected: ${func}`,
      };
    }
  }

  // Check for file operations
  const fileOperations = [
    'file',
    'readfile',
    'writefile',
    'load_file',
    'into outfile',
    'dumpfile',
  ];
  for (const op of fileOperations) {
    const regex = new RegExp(`\\b${op}\\b`, 'i');
    if (regex.test(trimmedSql)) {
      return {
        valid: false,
        error: `File operation not allowed: ${op}`,
      };
    }
  }

  return { valid: true };
}

export function validateFilter(filter: string): ValidationResult {
  if (!filter || typeof filter !== 'string') {
    return { valid: true }; // Empty filter is valid
  }

  const trimmedFilter = filter.trim();

  if (trimmedFilter.length === 0) {
    return { valid: true };
  }

  // Use the same validation as SQL but be more permissive for filters
  const result = validateSQL(trimmedFilter);

  // Allow certain keywords that are safe in WHERE clauses
  const allowedInFilter = ['AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL'];
  if (!result.valid && result.error) {
    const errorUpper = result.error.toUpperCase();
    for (const allowed of allowedInFilter) {
      if (errorUpper.includes(allowed)) {
        // If the error is about an allowed keyword, it might be a false positive
        // Do additional checks
        const dangerousKeywords = DANGEROUS_KEYWORDS.filter(
          (k) => !allowedInFilter.includes(k)
        );
        const hasDangerousKeyword = dangerousKeywords.some((keyword) => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(trimmedFilter);
        });

        if (!hasDangerousKeyword) {
          return { valid: true };
        }
      }
    }
  }

  return result;
}

export function sanitizeColumnName(column: string): string {
  if (!column || typeof column !== 'string') {
    throw new Error('Column name must be a non-empty string');
  }

  const trimmed = column.trim();

  if (trimmed.length === 0) {
    throw new Error('Column name must be a non-empty string');
  }

  // Check for dangerous patterns
  if (/[;'"`]/.test(trimmed)) {
    throw new Error('Column name contains invalid characters');
  }

  // Check for SQL keywords (case-insensitive)
  const sqlKeywords = [
    'SELECT',
    'FROM',
    'WHERE',
    'GROUP',
    'ORDER',
    'BY',
    'LIMIT',
    'OFFSET',
    'JOIN',
    'UNION',
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'CREATE',
  ];
  const upperTrimmed = trimmed.toUpperCase();
  if (sqlKeywords.includes(upperTrimmed)) {
    throw new Error(`Column name cannot be a SQL keyword: ${trimmed}`);
  }

  return trimmed;
}