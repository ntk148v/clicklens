/**
 * Cluster detection and management
 */
import { ClickHouseClient } from "./clients/types";

const CLUSTER_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedClusterName: string | undefined | null = null;
let cachedAt = 0;

export async function getClusterName(
  client: ClickHouseClient,
): Promise<string | undefined> {
  if (cachedClusterName !== null && Date.now() - cachedAt < CLUSTER_CACHE_TTL_MS) {
    return cachedClusterName || undefined;
  }

  try {
    const response = await client.query<{ cluster: string }>(`
      SELECT cluster FROM system.clusters
      WHERE cluster NOT IN ('test')
      ORDER BY cluster != 'default' DESC, cluster ASC
      LIMIT 1
    `);

    if (response.data && response.data.length > 0) {
      cachedClusterName = response.data[0].cluster;
    } else {
      cachedClusterName = undefined;
    }
    cachedAt = Date.now();
  } catch (error) {
    console.warn("Failed to detect cluster name:", error);
    cachedClusterName = undefined;
    cachedAt = Date.now();
  }

  return cachedClusterName || undefined;
}

/**
 * Reset the cluster name cache
 * Useful for testing or if cluster configuration changes
 */
export function resetClusterCache() {
  cachedClusterName = null;
  cachedAt = 0;
}
