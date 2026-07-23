#!/bin/bash
set -e

clickhouse client -n <<-EOSQL
CREATE USER IF NOT EXISTS alpha_user IDENTIFIED BY 'alpha_pass';
GRANT SELECT, CREATE USER, ALTER USER, DROP USER, ROLE ADMIN ON *.* TO alpha_user WITH GRANT OPTION;
EOSQL

echo "Created alpha_user"
