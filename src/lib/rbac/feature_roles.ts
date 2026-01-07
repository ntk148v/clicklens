/**
 * Feature Roles for ClickLens RBAC
 *
 * Feature roles are ClickHouse roles prefixed with 'clicklens_' that enable
 * specific UI features. They are stored in ClickHouse and auto-created on startup.
 *
 * User-created roles can inherit from feature roles using native ClickHouse
 * role inheritance (GRANT role TO role).
 */

/** Prefix for all feature roles */
export const FEATURE_ROLE_PREFIX = "clicklens_";

/**
 * Feature role definition
 */
export interface FeatureRole {
  id: string; // ClickHouse role name (e.g., 'clicklens_table_explorer')
  name: string; // Display name
  description: string;
  details: string; // Extended description for view mode
  grants: string[]; // SQL GRANT statements to execute
}

/**
 * Predefined feature roles with their privileges
 */
export const FEATURE_ROLES: FeatureRole[] = [
  {
    id: "clicklens_table_explorer",
    name: "Table Explorer",
    description: "Browse databases, tables, parts, and replication status",
    details:
      "Grants SHOW DATABASES, SHOW TABLES, SHOW COLUMNS, SHOW DICTIONARIES globally. " +
      "Also grants SELECT on system tables for schema browsing, parts, columns, replicas, mutations, and merges.",
    grants: [
      "GRANT SHOW DATABASES ON *.* TO `clicklens_table_explorer`",
      "GRANT SHOW TABLES ON *.* TO `clicklens_table_explorer`",
      "GRANT SHOW COLUMNS ON *.* TO `clicklens_table_explorer`",
      "GRANT SHOW DICTIONARIES ON *.* TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.tables TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.columns TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.databases TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.parts TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.parts_columns TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.replicas TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.mutations TO `clicklens_table_explorer`",
      "GRANT SELECT ON system.merges TO `clicklens_table_explorer`",
    ],
  },
  {
    id: "clicklens_query_monitor",
    name: "Query Monitor",
    description: "View and kill running queries, analyze query performance",
    details:
      "Grants KILL QUERY globally to terminate running queries. " +
      "Also grants SELECT on system.processes, system.query_log, and system.query_cache for monitoring.",
    grants: [
      "GRANT KILL QUERY ON *.* TO `clicklens_query_monitor`",
      "GRANT SELECT ON system.processes TO `clicklens_query_monitor`",
      "GRANT SELECT ON system.query_log TO `clicklens_query_monitor`",
      "GRANT SELECT ON system.query_cache TO `clicklens_query_monitor`",
    ],
  },
  {
    id: "clicklens_cluster_monitor",
    name: "Cluster Monitor",
    description: "View cluster health, metrics, and settings",
    details:
      "Grants SELECT on system tables for cluster monitoring: clusters, replicas, " +
      "replication_queue, metrics, events, asynchronous_metrics, settings, disks, parts.",
    grants: [
      "GRANT SELECT ON system.clusters TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.replicas TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.replication_queue TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.metrics TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.events TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.asynchronous_metrics TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.settings TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.disks TO `clicklens_cluster_monitor`",
      "GRANT SELECT ON system.parts TO `clicklens_cluster_monitor`",
    ],
  },
  {
    id: "clicklens_user_admin",
    name: "User Administration",
    description: "Manage users, roles, and access control",
    details:
      "Grants ACCESS MANAGEMENT globally. This includes creating, altering, and dropping " +
      "users, roles, row policies, quotas, and settings profiles.",
    grants: ["GRANT ACCESS MANAGEMENT ON *.* TO `clicklens_user_admin`"],
  },
  {
    id: "clicklens_table_admin",
    name: "Table Administration",
    description: "CREATE, DROP, ALTER, and TRUNCATE tables",
    details:
      "Grants CREATE TABLE, DROP TABLE, ALTER TABLE, TRUNCATE, and OPTIMIZE globally. " +
      "Use with data privileges to restrict to specific databases.",
    grants: [
      "GRANT CREATE TABLE ON *.* TO `clicklens_table_admin`",
      "GRANT DROP TABLE ON *.* TO `clicklens_table_admin`",
      "GRANT ALTER TABLE ON *.* TO `clicklens_table_admin`",
      "GRANT TRUNCATE ON *.* TO `clicklens_table_admin`",
      "GRANT OPTIMIZE ON *.* TO `clicklens_table_admin`",
    ],
  },
];

/**
 * Get feature role by ID
 */
export function getFeatureRole(id: string): FeatureRole | undefined {
  return FEATURE_ROLES.find((r) => r.id === id);
}

/**
 * Check if a role name is a feature role
 */
export function isFeatureRole(roleName: string): boolean {
  return roleName.startsWith(FEATURE_ROLE_PREFIX);
}

/**
 * Data privilege types for database/table access
 */
export const DATA_PRIVILEGES = [
  { id: "SELECT", name: "SELECT", description: "Read data" },
  { id: "INSERT", name: "INSERT", description: "Insert data" },
  { id: "ALTER", name: "ALTER", description: "Modify schema" },
  { id: "CREATE", name: "CREATE", description: "Create tables" },
  { id: "DROP TABLE", name: "DROP TABLE", description: "Drop tables" },
] as const;

export type DataPrivilegeType = (typeof DATA_PRIVILEGES)[number]["id"];

/**
 * Data privilege grant structure
 */
export interface DataPrivilege {
  database: string; // '*' for all databases, but NOT 'system'
  table: string; // '*' for all tables
  privileges: DataPrivilegeType[];
}

/**
 * Check if a database name is restricted (cannot grant privileges on it)
 */
export function isRestrictedDatabase(database: string): boolean {
  const restricted = ["system", "information_schema", "INFORMATION_SCHEMA"];
  return restricted.includes(database);
}

/**
 * Check if a list of grants satisfies a feature role's requirements
 * This helps identify "effective" feature roles for custom roles that don't explicitly inherit them.
 */
export function checkConfiguredFeature(
  featureId: string,
  grants: {
    access_type: string;
    database?: string;
    table?: string;
  }[]
): boolean {
  // Define criteria for each feature role
  const criteria: Record<
    string,
    (g: { access_type: string; database?: string; table?: string }) => boolean
  > = {
    clicklens_table_explorer: (g) =>
      // Needs SHOW tables/databases OR SELECT on system schema
      (g.access_type === "SHOW" && (!g.database || g.database === "*")) ||
      (g.access_type === "SELECT" &&
        g.database === "system" &&
        g.table === "tables"),

    clicklens_query_monitor: (g) =>
      // Needs KILL QUERY or SELECT on processes
      (g.access_type === "KILL QUERY" && (!g.database || g.database === "*")) ||
      (g.access_type === "SELECT" &&
        g.database === "system" &&
        g.table === "processes"),

    clicklens_cluster_monitor: (g) =>
      // Needs SELECT on system cluster tables
      g.access_type === "SELECT" &&
      g.database === "system" &&
      ["clusters", "replicas", "disks"].includes(g.table || ""),

    clicklens_user_admin: (g) =>
      // Needs ACCESS MANAGEMENT
      g.access_type === "ACCESS MANAGEMENT",

    clicklens_table_admin: (g) =>
      // Needs generic table DDL
      ["CREATE TABLE", "DROP TABLE", "ALTER TABLE"].includes(g.access_type) &&
      (!g.database || g.database === "*"),
  };

  const check = criteria[featureId];
  if (!check) return false;

  return grants.some(check);
}
