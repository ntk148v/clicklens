-- ClickLens RBAC Test Data
-- Run this script in ClickHouse to create sample users and roles for testing

-- Create sample roles
CREATE ROLE IF NOT EXISTS read_only;
CREATE ROLE IF NOT EXISTS analyst;
CREATE ROLE IF NOT EXISTS data_admin;

-- Grant permissions to roles
GRANT SELECT ON *.* TO read_only;
GRANT SELECT, INSERT ON *.* TO analyst;
GRANT SELECT, INSERT, ALTER, CREATE, DROP ON *.* TO data_admin;

-- Create sample users with different access levels

-- 1. Read-only user (can only view data)
CREATE USER IF NOT EXISTS viewer IDENTIFIED WITH sha256_password BY 'viewer123';
GRANT read_only TO viewer;

-- 2. Analyst user (can query and insert data)
CREATE USER IF NOT EXISTS analyst_user IDENTIFIED WITH sha256_password BY 'analyst123';
GRANT analyst TO analyst_user;

-- 3. Admin user (full access for testing)
CREATE USER IF NOT EXISTS test_admin IDENTIFIED WITH sha256_password BY 'admin123';
GRANT data_admin TO test_admin;
GRANT ACCESS MANAGEMENT ON *.* TO test_admin;  -- Can manage users/roles

-- View created users
SELECT name, auth_type, default_roles_list FROM system.users WHERE name IN ('viewer', 'analyst_user', 'test_admin');

-- View created roles
SELECT name FROM system.roles WHERE name IN ('read_only', 'analyst', 'data_admin');

-- View grants
SELECT user_name, role_name, access_type, database, table
FROM system.grants
WHERE user_name IN ('viewer', 'analyst_user', 'test_admin')
   OR role_name IN ('read_only', 'analyst', 'data_admin');

-- To clean up (run if you want to remove test data):
-- DROP USER IF EXISTS viewer;
-- DROP USER IF EXISTS analyst_user;
-- DROP USER IF EXISTS test_admin;
-- DROP ROLE IF EXISTS read_only;
-- DROP ROLE IF EXISTS analyst;
-- DROP ROLE IF EXISTS data_admin;
