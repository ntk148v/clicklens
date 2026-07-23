#!/bin/bash
set -e

clickhouse client -n <<-EOSQL
CREATE USER IF NOT EXISTS beta_user IDENTIFIED BY 'beta_pass';
GRANT SELECT, CREATE USER, ALTER USER, DROP USER, ROLE ADMIN ON *.* TO beta_user WITH GRANT OPTION;
EOSQL

echo "Created beta_user"
