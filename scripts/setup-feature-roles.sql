-- ============================================================================
-- ClickLens Feature Roles Setup Script
-- ============================================================================
-- This script creates predefined "feature roles" that enable specific
-- UI features in ClickLens. User-created roles can inherit from these.
--
-- Feature roles are prefixed with 'clicklens_' and should NOT be edited
-- by users. They are managed by ClickLens code only.
--
-- Run this script as a user with ACCESS MANAGEMENT privileges.
-- ============================================================================

-- Drop existing feature roles (for clean reinstall)
DROP ROLE IF EXISTS clicklens_table_explorer;
DROP ROLE IF EXISTS clicklens_query_monitor;
DROP ROLE IF EXISTS clicklens_cluster_monitor;
DROP ROLE IF EXISTS clicklens_user_admin;
DROP ROLE IF EXISTS clicklens_table_admin;

-- ============================================================================
-- clicklens_table_explorer
-- Enables: Browse databases, tables, and columns
-- ============================================================================
CREATE ROLE IF NOT EXISTS clicklens_table_explorer;
GRANT SHOW DATABASES ON *.* TO clicklens_table_explorer;
GRANT SHOW TABLES ON *.* TO clicklens_table_explorer;
GRANT SHOW COLUMNS ON *.* TO clicklens_table_explorer;
GRANT SHOW DICTIONARIES ON *.* TO clicklens_table_explorer;
GRANT SELECT ON system.tables TO clicklens_table_explorer;
GRANT SELECT ON system.columns TO clicklens_table_explorer;
GRANT SELECT ON system.databases TO clicklens_table_explorer;

-- ============================================================================
-- clicklens_query_monitor
-- Enables: View running queries, kill queries
-- ============================================================================
CREATE ROLE IF NOT EXISTS clicklens_query_monitor;
GRANT KILL QUERY ON *.* TO clicklens_query_monitor;
GRANT SELECT ON system.processes TO clicklens_query_monitor;
GRANT SELECT ON system.query_log TO clicklens_query_monitor;

-- ============================================================================
-- clicklens_cluster_monitor
-- Enables: View cluster health, metrics, settings
-- ============================================================================
CREATE ROLE IF NOT EXISTS clicklens_cluster_monitor;
GRANT SELECT ON system.clusters TO clicklens_cluster_monitor;
GRANT SELECT ON system.replicas TO clicklens_cluster_monitor;
GRANT SELECT ON system.replication_queue TO clicklens_cluster_monitor;
GRANT SELECT ON system.metrics TO clicklens_cluster_monitor;
GRANT SELECT ON system.events TO clicklens_cluster_monitor;
GRANT SELECT ON system.asynchronous_metrics TO clicklens_cluster_monitor;
GRANT SELECT ON system.settings TO clicklens_cluster_monitor;
GRANT SELECT ON system.disks TO clicklens_cluster_monitor;
GRANT SELECT ON system.parts TO clicklens_cluster_monitor;

-- ============================================================================
-- clicklens_user_admin
-- Enables: Manage users, roles, and access control
-- ============================================================================
CREATE ROLE IF NOT EXISTS clicklens_user_admin;
GRANT ACCESS MANAGEMENT ON *.* TO clicklens_user_admin;

-- ============================================================================
-- clicklens_table_admin
-- Enables: CREATE, DROP, ALTER, TRUNCATE tables
-- ============================================================================
CREATE ROLE IF NOT EXISTS clicklens_table_admin;
GRANT CREATE TABLE ON *.* TO clicklens_table_admin;
GRANT DROP TABLE ON *.* TO clicklens_table_admin;
GRANT ALTER TABLE ON *.* TO clicklens_table_admin;
GRANT TRUNCATE ON *.* TO clicklens_table_admin;
GRANT OPTIMIZE ON *.* TO clicklens_table_admin;

-- ============================================================================
-- Verification: List all clicklens feature roles
-- ============================================================================
SELECT name FROM system.roles WHERE name LIKE 'clicklens_%' ORDER BY name;
