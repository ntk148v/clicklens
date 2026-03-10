/**
 * ClickHouse Schema SQL Queries
 *
 * Centralized queries for table engine lookups, column type checks,
 * and column listing.
 */

// =============================================================================
// Table Engine
// =============================================================================

/** Get the engine of a specific table */
export const getTableEngineQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT engine
FROM system.tables
WHERE database = '${safeDatabase}'
  AND name = '${safeTable}'
`;

// =============================================================================
// Column Metadata
// =============================================================================

/** Get the type of a specific column */
export const getColumnTypeQuery = (
  safeDatabase: string,
  safeTable: string,
  safeColumn: string,
) => `
SELECT type FROM system.columns
WHERE database = '${safeDatabase}'
  AND table = '${safeTable}'
  AND name = '${safeColumn}'
`;

/** Get column names and types for a table */
export const getColumnNamesQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT name, type FROM system.columns
WHERE database = '${safeDatabase}'
  AND table = '${safeTable}'
`;
