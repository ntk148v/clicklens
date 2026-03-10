/**
 * Centralized ClickHouse SQL Queries
 *
 * Re-exports all domain-based query modules for convenient access.
 * Monitoring queries remain in their existing location at
 * `@/lib/clickhouse/monitoring/queries`.
 */

export * from "./tables";
export * from "./databases";
export * from "./access";
export * from "./query-analysis";
export * from "./settings";
export * from "./schema";
export * from "./discover";
