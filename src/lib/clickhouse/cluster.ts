/**
 * Cluster detection and management
 */
import { ClickHouseClient } from "./clients/types";

// Cache the cluster name to avoid repeated queries
// Global cache is safe as we're in a server-side context where
// the application instance is long-lived or per-request
let cachedClusterName: string | undefined | null = null;

/**
 * Get the name of the first available cluster
 * Returns undefined if no cluster is found (single node setup)
 */
export async function getClusterName(
  client: ClickHouseClient
): Promise<string | undefined> {
  if (cachedClusterName !== null) {
    return cachedClusterName || undefined;
  }

  try {
    const response = await client.query<{ cluster: string }>(`
      SELECT cluster FROM system.clusters LIMIT 1
    `);

    if (response.data && response.data.length > 0) {
      cachedClusterName = response.data[0].cluster;
    } else {
      cachedClusterName = undefined; // No cluster found (single node)
    }
  } catch (error) {
    console.warn("Failed to detect cluster name:", error);
    cachedClusterName = undefined;
  }

  return cachedClusterName || undefined;
}

/**
 * Reset the cluster name cache
 * Useful for testing or if cluster configuration changes
 */
export function resetClusterCache() {
  cachedClusterName = null;
}
