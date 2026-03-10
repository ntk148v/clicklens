/**
 * ClickHouse Table-Related SQL Queries
 *
 * Centralized queries for table listing, metadata exploration,
 * column stats, parts, merges, mutations, replicas, dependencies,
 * and structure/data preview.
 */

import { escapeSqlString } from "@/lib/clickhouse/utils";

// =============================================================================
// RBAC Queries (used by tables/route.ts and databases/route.ts)
// =============================================================================

/** Get roles assigned to a user */
export const getUserRolesQuery = (safeUser: string) => `
SELECT granted_role_name as role
FROM system.role_grants
WHERE user_name = '${safeUser}'
`;

/** Check for global access (*.* grants) */
export const getGlobalAccessQuery = (grantFilter: string) => `
SELECT count() as cnt FROM system.grants
WHERE ${grantFilter}
AND (database IS NULL OR database = '*')
AND access_type IN ('SELECT', 'ALL')
`;

/** Check for database-level access (db.*) */
export const getDbAccessQuery = (
  grantFilter: string,
  safeDatabase: string,
) => `
SELECT count() as cnt FROM system.grants
WHERE ${grantFilter}
AND database = '${safeDatabase}'
AND (table IS NULL OR table = '*')
AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
`;

/** Get tables with global access (all or for specific db) */
export const getTablesQuery = (dbFilter: string) => `
SELECT
  database,
  name,
  engine,
  total_rows,
  total_bytes
FROM system.tables
${dbFilter}
ORDER BY database, name
`;

/** Get tables for a specific database */
export const getTablesForDbQuery = (safeDatabase: string) => `
SELECT
  database,
  name,
  engine,
  total_rows,
  total_bytes
FROM system.tables
WHERE database = '${safeDatabase}'
ORDER BY name
`;

/** Get allowed tables (specific table-level access) for a database */
export const getAllowedTablesInDbQuery = (
  grantFilter: string,
  safeDatabase: string,
) => `
SELECT DISTINCT table FROM system.grants
WHERE ${grantFilter}
AND database = '${safeDatabase}'
AND table IS NOT NULL
AND table != '*'
AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
`;

/** Get allowed tables across all databases */
export const getAllowedTablesAllDbsQuery = (grantFilter: string) => `
SELECT DISTINCT database, table FROM system.grants
WHERE ${grantFilter}
AND table IS NOT NULL
AND table != '*'
AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
`;

/** Get tables filtered by allowed table names (single database) */
export const getTablesFilteredByAccessQuery = (
  safeDatabase: string,
  allowedTablesSubquery: string,
) => `
SELECT
  database,
  name,
  engine,
  total_rows,
  total_bytes
FROM system.tables
WHERE database = '${safeDatabase}'
AND name IN (${allowedTablesSubquery})
ORDER BY name
`;

/** Get tables filtered by allowed (database, table) tuples */
export const getTablesFilteredByTupleQuery = (
  allowedTablesSubquery: string,
) => `
SELECT
  database,
  name,
  engine,
  total_rows,
  total_bytes
FROM system.tables
WHERE (database, name) IN (${allowedTablesSubquery})
ORDER BY database, name
`;

// =============================================================================
// Table Explorer: Overview
// =============================================================================

/** Get table overview metadata */
export const getTableOverviewQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT
  database,
  name,
  engine,
  total_rows,
  total_bytes,
  ifNull(total_marks, 0) as total_marks,
  ifNull(parts, 0) as parts,
  partition_key,
  sorting_key,
  primary_key,
  sampling_key,
  create_table_query
FROM system.tables
WHERE database = '${safeDatabase}' AND name = '${safeTable}'
`;

// =============================================================================
// Table Explorer: Column Stats
// =============================================================================

/** Get column storage stats from parts_columns */
export const getColumnStatsQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT
  column,
  any(type) AS type,
  sum(rows) AS rows,
  sum(column_bytes_on_disk) AS bytes_on_disk,
  sum(column_data_compressed_bytes) AS compressed_bytes,
  sum(column_data_uncompressed_bytes) AS uncompressed_bytes,
  if(sum(column_data_uncompressed_bytes) > 0,
     sum(column_data_compressed_bytes) / sum(column_data_uncompressed_bytes), 0
  ) AS compression_ratio
FROM system.parts_columns
WHERE database = '${safeDatabase}' AND table = '${safeTable}' AND active = 1
GROUP BY column
ORDER BY bytes_on_disk DESC
`;

/** Fallback: basic column info from system.columns (for views, empty tables) */
export const getColumnsFallbackQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT
  name AS column,
  type,
  0 AS rows,
  0 AS bytes_on_disk,
  0 AS compressed_bytes,
  0 AS uncompressed_bytes,
  0 AS compression_ratio
FROM system.columns
WHERE database = '${safeDatabase}' AND table = '${safeTable}'
ORDER BY position
`;

// =============================================================================
// Table Explorer: Parts
// =============================================================================

/** Get parts breakdown for a table (cluster-aware) */
export const getPartsQuery = (
  safeDatabase: string,
  safeTable: string,
  clusterName?: string,
) => {
  const tableSource = clusterName
    ? `clusterAllReplicas('${clusterName}', system.parts)`
    : "system.parts";
  return `
SELECT
  partition,
  name,
  part_type,
  active,
  rows,
  bytes_on_disk,
  data_compressed_bytes,
  data_uncompressed_bytes,
  marks,
  toString(modification_time) as modification_time,
  is_frozen
FROM ${tableSource}
WHERE database = '${safeDatabase}' AND table = '${safeTable}' AND active = 1
ORDER BY bytes_on_disk DESC
`;
};

// =============================================================================
// Table Explorer: Merges
// =============================================================================

/** Get active merges for a table */
export const getTableMergesQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT
  result_part_name,
  elapsed,
  progress,
  num_parts,
  source_part_names,
  total_size_bytes_compressed,
  bytes_read_uncompressed,
  bytes_written_uncompressed,
  rows_read,
  rows_written,
  columns_written,
  memory_usage,
  is_mutation,
  merge_type,
  merge_algorithm
FROM system.merges
WHERE database = '${safeDatabase}' AND table = '${safeTable}'
`;

// =============================================================================
// Table Explorer: Mutations
// =============================================================================

/** Get mutations for a table (cluster-aware) */
export const getTableMutationsQuery = (
  safeDatabase: string,
  safeTable: string,
  clusterName?: string,
) => {
  const tableSource = clusterName
    ? `clusterAllReplicas('${clusterName}', system.mutations)`
    : "system.mutations";
  const settings = clusterName ? "SETTINGS skip_unavailable_shards = 1" : "";
  const nodeField = clusterName ? "hostname() as node," : "";
  return `
SELECT
  ${nodeField}
  mutation_id,
  command,
  toString(create_time) as create_time,
  parts_to_do,
  is_done,
  latest_failed_part,
  toString(latest_fail_time) as latest_fail_time,
  latest_fail_reason
FROM ${tableSource}
WHERE database = '${safeDatabase}' AND table = '${safeTable}'
ORDER BY create_time DESC
LIMIT 100
${settings}
`;
};

// =============================================================================
// Table Explorer: Replicas
// =============================================================================

/** Get replication status for a table (cluster-aware) */
export const getTableReplicasQuery = (
  safeDatabase: string,
  safeTable: string,
  clusterName?: string,
) => {
  const tableSource = clusterName
    ? `clusterAllReplicas('${clusterName}', system.replicas)`
    : "system.replicas";
  const settings = clusterName ? "SETTINGS skip_unavailable_shards = 1" : "";
  const nodeField = clusterName ? "hostname() as node," : "";
  return `
SELECT
  ${nodeField}
  is_leader,
  is_readonly,
  is_session_expired,
  future_parts,
  parts_to_check,
  queue_size,
  inserts_in_queue,
  merges_in_queue,
  log_pointer,
  total_replicas,
  active_replicas,
  toString(last_queue_update) as last_queue_update,
  absolute_delay,
  zookeeper_path,
  replica_path,
  replica_name
FROM ${tableSource}
WHERE database = '${safeDatabase}' AND table = '${safeTable}'
${settings}
`;
};

// =============================================================================
// Table Explorer: Dependencies
// =============================================================================

/** Get all tables with dependency info for a database */
export const getTableDependenciesQuery = (safeDatabase: string) => `
SELECT
  database,
  name,
  engine,
  total_rows,
  total_bytes,
  dependencies_database,
  dependencies_table,
  create_table_query
FROM system.tables
WHERE database = '${safeDatabase}'
`;

/** Get all tables in the system (for validating external references) */
export const ALL_SYSTEM_TABLES_QUERY = `
SELECT database, name, engine
FROM system.tables
`;

// =============================================================================
// Table Structure & Data Preview
// =============================================================================

/** Get table column structure */
export const getTableStructureQuery = (
  safeDatabase: string,
  safeTable: string,
) => `
SELECT
  name,
  type,
  default_kind,
  default_expression,
  comment
FROM system.columns
WHERE database = '${safeDatabase}' AND table = '${safeTable}'
ORDER BY position
`;

/** Get table data preview */
export const getTableDataPreviewQuery = (
  safeDatabase: string,
  safeTable: string,
) => `SELECT * FROM \`${safeDatabase}\`.\`${safeTable}\` LIMIT 100`;

// =============================================================================
// Grant Filter Helper
// =============================================================================

/**
 * Build a grant filter clause for SQL queries that check user + role permissions.
 * Used by tables and databases routes for RBAC filtering.
 */
export const buildGrantFilter = (
  safeUser: string,
  userRoles: string[],
): string => {
  const quotedRoles = userRoles
    .map((r) => `'${escapeSqlString(r)}'`)
    .join(",");

  return quotedRoles
    ? `(user_name = '${safeUser}' OR role_name IN (${quotedRoles}))`
    : `user_name = '${safeUser}'`;
};
