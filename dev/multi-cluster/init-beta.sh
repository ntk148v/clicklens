#!/bin/bash
# Local demo user for ClickLens multi-cluster (CH 26.6+ compatible).
# After changing credentials, restart with fresh volumes:
#   docker compose -f docker-compose.multi-cluster.yml down -v
#   docker compose -f docker-compose.multi-cluster.yml up --build -d
set -e

clickhouse client -n <<-EOSQL
DROP USER IF EXISTS beta_user;
CREATE USER beta_user IDENTIFIED BY 'beta_pass';
GRANT SELECT ON system.* TO beta_user;
GRANT CREATE USER, ALTER USER, DROP USER ON * TO beta_user WITH GRANT OPTION;
GRANT CREATE ROLE, DROP ROLE ON * TO beta_user WITH GRANT OPTION;
GRANT REMOTE ON *.* TO beta_user;
EOSQL

echo "Created beta_user"
