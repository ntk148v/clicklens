/**
 * Metadata management for ClickLens
 * Handles creation and management of metadata tables in ClickHouse
 */

import { createClient } from "./client";
import type { ClickHouseConfig } from "./config";
import { getClusterName } from "./cluster";
import { quoteIdentifier } from "./utils";

const METADATA_DB = "clicklens_metadata";
const SAVED_QUERIES_TABLE = "saved_queries";

export function getSavedQueriesSchema(onCluster: string = ""): string {
  return `
CREATE TABLE IF NOT EXISTS ${METADATA_DB}.${SAVED_QUERIES_TABLE} (
    id UUID,
    name String,
    sql String,
    description String DEFAULT '',
    created_by String,
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (created_by, created_at)
${onCluster}
`;
}

export const SAVED_QUERIES_SCHEMA = getSavedQueriesSchema();

/**
 * Ensure the metadata database and tables exist.
 * Accepts an already-resolved Lens config from the session.
 */
export async function ensureMetadataInfrastructure(config: ClickHouseConfig): Promise<boolean> {
  const client = createClient(config);

  try {
    const clusterName = await getClusterName(client, config.clusterId);
    const onCluster = clusterName
      ? ` ON CLUSTER ${quoteIdentifier(clusterName)}`
      : "";

    await client.command(
      `CREATE DATABASE IF NOT EXISTS ${METADATA_DB}${onCluster}`,
    );

    await client.command(getSavedQueriesSchema(onCluster));

    return true;
  } catch (error) {
    console.error("Failed to initialize metadata infrastructure:", error);
    throw error;
  }
}

export { METADATA_DB, SAVED_QUERIES_TABLE };
