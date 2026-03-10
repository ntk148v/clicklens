/**
 * ClickHouse Database-Related SQL Queries
 *
 * Centralized queries for database listing with RBAC filtering.
 */

// =============================================================================
// Database Listing
// =============================================================================

/** All databases, ordered by name */
export const ALL_DATABASES_QUERY = `
SELECT name FROM system.databases ORDER BY name
`;

/**
 * Databases with RBAC — unified CTE query.
 * Checks global access, then falls back to per-database grants.
 */
export const getDatabasesWithRbacQuery = (safeUser: string) => `
WITH (
    SELECT groupArray(granted_role_name)
    FROM system.role_grants
    WHERE user_name = '${safeUser}'
) AS user_roles,
(
    SELECT count() > 0
    FROM system.grants
    WHERE (user_name = '${safeUser}' OR has(user_roles, role_name))
      AND (database IS NULL OR database = '*')
      AND access_type IN ('SELECT', 'ALL')
) AS has_global_access
SELECT DISTINCT name
FROM (
    -- If they have global access, return all databases
    SELECT name
    FROM system.databases
    WHERE has_global_access

    UNION ALL

    -- Otherwise, return specific databases they have access to
    SELECT database AS name
    FROM system.grants
    WHERE (user_name = '${safeUser}' OR has(user_roles, role_name))
      AND database IS NOT NULL
      AND database != '*'
      AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
      AND NOT has_global_access

    UNION ALL

    -- Always include default if it exists
    SELECT 'default' AS name
)
WHERE name IN (SELECT name FROM system.databases)
ORDER BY name
`;
