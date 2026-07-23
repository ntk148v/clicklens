#!/bin/bash
# Local demo user for ClickLens multi-cluster.
# Sets up a non-admin user that can use ClickLens features.
# After changing credentials, restart with fresh volumes:
#   docker compose -f docker-compose.multi-cluster.yml down -v
#   docker compose -f docker-compose.multi-cluster.yml up --build -d
set -e

clickhouse client -n <<-EOSQL
DROP USER IF EXISTS alpha_user;
CREATE USER alpha_user IDENTIFIED BY 'alpha_pass';
GRANT SELECT ON system.* TO alpha_user;
GRANT CREATE USER, ALTER USER, DROP USER ON *.* TO alpha_user;
GRANT CREATE ROLE, DROP ROLE ON *.* TO alpha_user;
GRANT ADMIN OPTION ON *.* TO alpha_user;
EOSQL

echo "Created alpha_user"
