/**
 * Metadata management for ClickLens
 * Handles creation and management of metadata tables in ClickHouse
 */

import { createClient } from "./client";
import { getLensConfig, isLensUserConfigured } from "./config";

const METADATA_DB = "clicklens_metadata";
const SAVED_QUERIES_TABLE = "saved_queries";

export const SAVED_QUERIES_SCHEMA = `
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
`;

/**
 * Ensure the metadata database and tables exist
 * This uses the Lens User (privileged) to create the structure
 */
export async function ensureMetadataInfrastructure() {
  if (!isLensUserConfigured()) {
    throw new Error("Lens user must be configured to manage metadata");
  }

  const config = getLensConfig();
  if (!config) return;

  const client = createClient(config);

  try {
    // Create database
    await client.command(`CREATE DATABASE IF NOT EXISTS ${METADATA_DB}`);

    // Create tables
    await client.command(SAVED_QUERIES_SCHEMA);

    return true;
  } catch (error) {
    console.error("Failed to initialize metadata infrastructure:", error);
    throw error;
  }
}

export { METADATA_DB, SAVED_QUERIES_TABLE };
