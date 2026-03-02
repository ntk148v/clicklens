#!/bin/bash
set +e

clickhouse client -n <<-EOSQL
GRANT ACCESS MANAGEMENT ON *.* ON CLUSTER cluster_1S_2R TO default;
GRANT SELECT ON *.* ON CLUSTER cluster_1S_2R TO default;
GRANT REMOTE ON *.* ON CLUSTER cluster_1S_2R TO default;

-- Create database
CREATE DATABASE IF NOT EXISTS logs;

-- Optimized syslog table
CREATE TABLE IF NOT EXISTS logs.syslog
(
    timestamp DateTime CODEC(DoubleDelta, ZSTD(3)),
    hostname String CODEC(ZSTD(1)),
    appname String CODEC(ZSTD(1)),
    procid UInt32 CODEC(ZSTD(1)),
    msgid String CODEC(ZSTD(1)),
    facility String CODEC(ZSTD(1)),
    severity String CODEC(ZSTD(1)),
    message String CODEC(ZSTD(3)),
    version UInt8 CODEC(ZSTD(1))
)
ON CLUSTER cluster_1S_2R
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, hostname, appname)
SETTINGS
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1,
    min_bytes_for_wide_part = 0;

-- Optimized http table
CREATE TABLE IF NOT EXISTS logs.http (
    timestamp DateTime CODEC(DoubleDelta, ZSTD(3)),
    host LowCardinality(String) CODEC(LZ4),
    method LowCardinality(String) CODEC(LZ4),
    protocol LowCardinality(String) CODEC(LZ4),
    status LowCardinality(String) CODEC(LZ4),
    bytes UInt32 CODEC(Delta, LZ4),
    request String CODEC(ZSTD(3)),
    referer String CODEC(ZSTD(3)),
    \`user-identifier\` String CODEC(LZ4)
)
ON CLUSTER cluster_1S_2R
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, host, status)
SETTINGS
    index_granularity = 8192,
    compress_marks = 1,
    compress_primary_key = 1,
    min_bytes_for_wide_part = 0;
EOSQL

echo "Database and tables created successfully with optimized compression settings"
