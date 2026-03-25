/**
 * Cache Key Generator
 *
 * Generates consistent cache keys from query parameters.
 */

import { createHash } from "crypto";

export interface QueryParams {
  database?: string;
  table?: string;
  filter?: string;
  columns?: string[];
  orderBy?: string;
  groupBy?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

function hashValue(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function normalizeParam(value: unknown): string {
  if (value === undefined || value === null) {
    return "none";
  }
  if (Array.isArray(value)) {
    return value.sort().join(",");
  }
  if (typeof value === "object") {
    return hashValue(JSON.stringify(value));
  }
  return String(value);
}

export function generateCacheKey(prefix: string, params: QueryParams): string {
  const parts: string[] = [prefix];

  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null) {
      parts.push(`${key}:${normalizeParam(value)}`);
    }
  }

  return parts.join(":");
}

export function generateQueryCacheKey(query: string, params: QueryParams = {}): string {
  const queryHash = hashValue(query);
  return generateCacheKey(`query:${queryHash}`, params);
}

export function generateSchemaCacheKey(database: string, table?: string): string {
  if (table) {
    return `schema:${database}:${table}`;
  }
  return `schema:${database}`;
}

export function generateTableCacheKey(
  database: string,
  table: string,
  viewType?: string,
): string {
  if (viewType) {
    return `table:${database}:${table}:${viewType}`;
  }
  return `table:${database}:${table}`;
}

export function generatePattern(prefix: string, database: string, table?: string): string {
  if (table) {
    return `${prefix}:${database}:${table}:*`;
  }
  return `${prefix}:${database}:*`;
}
