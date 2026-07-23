/**
 * Cluster detection and management
 */
import { ClickHouseClient } from "./clients/types";

const clusterCache = new Map<string, { name: string | undefined; at: number }>();
const CLUSTER_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getClusterName(
  client: ClickHouseClient,
  clusterId?: string,
): Promise<string | undefined> {
  const configuredCluster = process.env.CLICKHOUSE_CLUSTER?.trim();
  if (configuredCluster) {
    return configuredCluster;
  }

  const cacheKey = clusterId || "__legacy__";
  const cached = clusterCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CLUSTER_CACHE_TTL_MS) {
    return cached.name;
  }

  try {
    const response = await client.query<{ cluster: string }>(`
      SELECT cluster FROM system.clusters
      WHERE cluster NOT IN ('test')
        AND empty(database_replica_name)
      GROUP BY cluster
      ORDER BY cluster != 'default' DESC, cluster ASC
      LIMIT 1
    `);

    if (response.data && response.data.length > 0) {
      clusterCache.set(cacheKey, { name: response.data[0].cluster, at: Date.now() });
    } else {
      clusterCache.set(cacheKey, { name: undefined, at: Date.now() });
    }
  } catch (error) {
    console.warn("Failed to detect cluster name:", error);
    clusterCache.set(cacheKey, { name: undefined, at: Date.now() });
  }

  return clusterCache.get(cacheKey)?.name;
}

/**
 * Reset the cluster name cache
 * Useful for testing or if cluster configuration changes
 */
export function resetClusterCache() {
  clusterCache.clear();
}
