const STRIP_COMMENTS_REGEX =
  /(?:\/\*[\s\S]*?\*\/|--[^\n]*\n?|\s+)/g;

const ALLOWED_STATEMENT_PREFIXES = [
  "SELECT",
  "WITH",
  "SHOW",
  "DESCRIBE",
  "DESC",
  "EXPLAIN",
  "EXISTS",
  "CHECK",
  "USE",
] as const;

const DANGEROUS_TABLE_FUNCTIONS = [
  "file",
  "url",
  "remote",
  "remoteSecure",
  "s3",
  "s3Cluster",
  "gcs",
  "mysql",
  "postgresql",
  "jdbc",
  "odbc",
  "hdfs",
  "input",
  "generateRandom",
  "numbers",
  "zeros",
] as const;

const DANGEROUS_FUNCTION_REGEX = new RegExp(
  `\\b(${DANGEROUS_TABLE_FUNCTIONS.join("|")})\\s*\\(`,
  "i",
);

export type SqlValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateSqlStatement(sql: string): SqlValidationResult {
  const stripped = sql.replace(STRIP_COMMENTS_REGEX, " ").trim();
  if (!stripped) {
    return { valid: false, reason: "Empty SQL statement" };
  }

  const firstWord = stripped.split(/\s/)[0]?.toUpperCase();
  const isAllowed = ALLOWED_STATEMENT_PREFIXES.some(
    (prefix) => firstWord === prefix,
  );

  if (!isAllowed) {
    return {
      valid: false,
      reason: `Statement type "${firstWord}" is not allowed. Only read operations are permitted.`,
    };
  }

  if (DANGEROUS_FUNCTION_REGEX.test(stripped)) {
    const match = stripped.match(DANGEROUS_FUNCTION_REGEX);
    return {
      valid: false,
      reason: `Table function "${match?.[1]}" is not allowed for security reasons.`,
    };
  }

  return { valid: true };
}
