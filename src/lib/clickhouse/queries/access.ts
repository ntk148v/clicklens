/**
 * ClickHouse Access Control SQL Queries
 *
 * Centralized SELECT queries for grants, users, roles,
 * role-grants, and feature-roles.
 *
 * Note: DDL commands (GRANT, REVOKE, CREATE USER, etc.)
 * remain inline in their respective API routes.
 */

// =============================================================================
// Grants
// =============================================================================

/** List all grants ordered by user/role */
export const GRANTS_LIST_QUERY = `
SELECT
  user_name,
  role_name,
  access_type,
  database,
  table,
  column,
  is_partial_revoke,
  grant_option
FROM system.grants
ORDER BY
  user_name NULLS LAST,
  role_name NULLS LAST,
  access_type
`;

// =============================================================================
// Users
// =============================================================================

/** List all users */
export const USERS_LIST_QUERY = `
SELECT
  name,
  id,
  storage,
  auth_type,
  host_ip,
  host_names,
  host_names_regexp,
  host_names_like,
  default_roles_all,
  default_roles_list,
  default_roles_except,
  grantees_any,
  grantees_list,
  grantees_except,
  default_database
FROM system.users
ORDER BY name
`;

/** Get role grants to users (for building user -> roles mapping) */
export const USER_ROLE_GRANTS_QUERY = `
SELECT user_name, granted_role_name
FROM system.role_grants
WHERE user_name IS NOT NULL
`;

/** Get current roles assigned to a specific user */
export const getUserCurrentRolesQuery = (safeUsername: string) => `
SELECT granted_role_name
FROM system.role_grants
WHERE user_name = '${safeUsername}'
`;

// =============================================================================
// Roles
// =============================================================================

/** List all roles */
export const ROLES_LIST_QUERY = `
SELECT name, id, storage
FROM system.roles
ORDER BY name
`;

/** Role-to-role grants (which roles are granted to other roles) */
export const ROLE_GRANTS_LIST_QUERY = `
SELECT role_name, granted_role_name
FROM system.role_grants
`;

/** All privilege grants for roles */
export const ROLE_PRIVILEGES_QUERY = `
SELECT
  user_name,
  role_name,
  access_type,
  database,
  table,
  column,
  is_partial_revoke,
  grant_option
FROM system.grants
WHERE role_name IS NOT NULL
`;

/** Get roles inherited by a specific role */
export const getRoleInheritedRolesQuery = (safeRoleName: string) => `
SELECT granted_role_name
FROM system.role_grants
WHERE role_name = '${safeRoleName}'
`;

// =============================================================================
// Role Grants (all)
// =============================================================================

/** List all role grants */
export const ROLE_GRANTS_ALL_QUERY = `
SELECT
  user_name,
  role_name,
  granted_role_name,
  with_admin_option
FROM system.role_grants
ORDER BY
  user_name NULLS LAST,
  role_name NULLS LAST,
  granted_role_name
`;

// =============================================================================
// Feature Roles
// =============================================================================

/** Get installed feature roles by prefix */
export const getFeatureRolesQuery = (prefix: string) => `
SELECT name
FROM system.roles
WHERE name LIKE '${prefix}%'
`;

// =============================================================================
// Auth Helpers
// =============================================================================

/** Get current user name */
export const CURRENT_USER_QUERY = `SELECT currentUser() AS user`;
