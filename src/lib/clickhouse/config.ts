/**
 * ClickHouse client configuration
 *
 * Environment Variables:
 * - CLICKHOUSE_HOST: ClickHouse server hostname
 * - CLICKHOUSE_PORT: ClickHouse HTTP port (default: 8123, or 8443 for HTTPS)
 * - CLICKHOUSE_SECURE: "true" or "false" (default: "false") - use HTTPS
 * - CLICKHOUSE_VERIFY: "true" or "false" (default: "true") - verify SSL certificate
 * - LENS_USER: Service user for metadata queries
 * - LENS_PASSWORD: Service user password
 *
 * Note: ClickLens uses ClickHouse HTTP interface (ports 8123/8443).
 * The native TCP protocol (ports 9000/9440) is NOT supported.
 */

export interface ClusterDefinition {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  verifySsl: boolean;
  lensUser: string;
  lensPassword: string;
  /** Optional ClickHouse cluster name override for ON CLUSTER clauses */
  clickhouseCluster?: string;
}

export interface ClickHouseConfig {
  host: string;
  port: number;
  /** Use secure connection (HTTPS) */
  secure: boolean;
  /** Verify SSL certificate */
  verifySsl: boolean;
  username: string;
  password: string;
  database: string;
  /** ClickHouse query settings to apply to all queries */
  settings?: Record<string, unknown>;
  /** Cluster ID this config belongs to (for cache key isolation) */
  clusterId?: string;
}

/**
 * Parse CLICKHOUSE_CLUSTERS JSON env var into a map of cluster definitions.
 * Validates each entry, rejects duplicates and invalid fields.
 */
export function parseClusterRegistry(): Map<string, ClusterDefinition> {
  const json = process.env.CLICKHOUSE_CLUSTERS;
  if (!json) return new Map();

  let entries: unknown[];
  try {
    entries = JSON.parse(json);
  } catch {
    throw new Error("CLICKHOUSE_CLUSTERS is not valid JSON");
  }

  if (!Array.isArray(entries)) {
    throw new Error("CLICKHOUSE_CLUSTERS must be a JSON array");
  }

  const registry = new Map<string, ClusterDefinition>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid cluster entry at index ${registry.size}`);
    }

    const e = entry as Record<string, unknown>;

    if (!e.id || typeof e.id !== "string" || !e.id.trim()) {
      throw new Error(`Cluster entry missing 'id' at index ${registry.size}`);
    }
    const id = e.id.trim();
    if (/\s/.test(id)) {
      throw new Error(`Cluster ID must not contain whitespace: '${id}'`);
    }
    if (registry.has(id)) {
      throw new Error(`Duplicate cluster ID: '${id}'`);
    }

    if (!e.label || typeof e.label !== "string") {
      throw new Error(`Cluster '${id}' is missing 'label'`);
    }
    if (!e.host || typeof e.host !== "string") {
      throw new Error(`Cluster '${id}' is missing 'host'`);
    }
    if (!e.lensUser || typeof e.lensUser !== "string") {
      throw new Error(`Cluster '${id}' is missing 'lensUser'`);
    }
    if (!e.lensPassword || typeof e.lensPassword !== "string") {
      throw new Error(`Cluster '${id}' is missing 'lensPassword'`);
    }

    const secure = e.secure === true;
    const port =
      e.port !== undefined
        ? parseInt(String(e.port), 10)
        : secure
          ? 8443
          : 8123;

    registry.set(id, {
      id,
      label: String(e.label),
      host: String(e.host),
      port: isNaN(port) ? (secure ? 8443 : 8123) : port,
      secure,
      verifySsl: e.verifySsl !== false,
      lensUser: String(e.lensUser),
      lensPassword: String(e.lensPassword),
      clickhouseCluster: typeof e.clickhouseCluster === "string" && e.clickhouseCluster.trim()
        ? e.clickhouseCluster.trim()
        : undefined,
    });
  }

  return registry;
}

/**
 * Get public-safe list of configured clusters (id + label only).
 * Includes the legacy "default" cluster when CLICKHOUSE_HOST is set,
 * unless CLICKHOUSE_CLUSTERS explicitly defines a "default" entry.
 */
export function getConfiguredClusters(): { id: string; label: string }[] {
  const registry = parseClusterRegistry();
  const hasLegacy = !!process.env.CLICKHOUSE_HOST && !!process.env.LENS_USER;

  const clusters = [...registry.values()].map((c) => ({
    id: c.id,
    label: c.label,
  }));

  if (hasLegacy && !registry.has("default")) {
    clusters.unshift({ id: "default", label: "default" });
  }

  return clusters;
}

/**
 * Return the ID of the first configured cluster, or null if none.
 */
export function getDefaultClusterId(): string | null {
  const clusters = getConfiguredClusters();
  return clusters.length > 0 ? clusters[0].id : null;
}

/**
 * Check whether a given cluster ID is configured.
 */
export function isClusterConfigured(clusterId: string): boolean {
  if (clusterId === "default" && !!process.env.CLICKHOUSE_HOST) return true;
  return parseClusterRegistry().has(clusterId);
}

/**
 * Get server connection config from environment
 */
function getServerConnection(): Omit<
  ClickHouseConfig,
  "username" | "password" | "database"
> | null {
  const host = process.env.CLICKHOUSE_HOST;

  if (!host) {
    return null;
  }

  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const verifySsl = process.env.CLICKHOUSE_VERIFY !== "false"; // Default to true

  // Default ports for HTTP interface
  const defaultPort = secure ? 8443 : 8123;

  return {
    host,
    port: parseInt(process.env.CLICKHOUSE_PORT || String(defaultPort), 10),
    secure,
    verifySsl,
  };
}

/**
 * Build connection URL from config
 */
export function buildConnectionUrl(
  config: Omit<ClickHouseConfig, "username" | "password" | "database">
): string {
  const scheme = config.secure ? "https" : "http";
  return `${scheme}://${config.host}:${config.port}`;
}

/**
 * Get lens user config for metadata queries.
 * Resolves registered cluster IDs (including "default") from CLICKHOUSE_CLUSTERS first.
 * Falls back to legacy CLICKHOUSE_HOST / LENS_USER env vars when no ID or unknown ID.
 *
 * Lens user has read access to system.* tables
 */
export function getLensConfig(clusterId?: string): ClickHouseConfig | null {
  // Try registry first for any clusterId (including "default")
  if (clusterId) {
    const registry = parseClusterRegistry();
    const def = registry.get(clusterId);
    if (def) {
      return {
        host: def.host,
        port: def.port,
        secure: def.secure,
        verifySsl: def.verifySsl,
        username: def.lensUser,
        password: def.lensPassword,
        database: "default",
        clusterId: def.id,
      };
    }
    // Unknown registry ID — try legacy as fallback
  }

  // Fallback to legacy env
  const server = getServerConnection();
  const lensUser = process.env.LENS_USER;

  if (!server || !lensUser) {
    return null;
  }

  return {
    ...server,
    username: lensUser,
    password: process.env.LENS_PASSWORD || "",
    database: "default",
  };
}

/**
 * Overload signatures for getUserConfig
 */
export function getUserConfig(credentials: {
  username: string;
  password: string;
  database?: string;
}): ClickHouseConfig | null;
export function getUserConfig(
  clusterId: string,
  credentials: {
    username: string;
    password: string;
    database?: string;
  },
): ClickHouseConfig | null;

/**
 * Get user config by combining a cluster definition with session credentials.
 *
 * Two call signatures:
 * - `getUserConfig(clusterId, credentials)` — cluster-aware path
 * - `getUserConfig(credentials)` — legacy path using CLICKHOUSE_HOST env var
 */
export function getUserConfig(
  clusterIdOrCredentials:
    | string
    | { username: string; password: string; database?: string },
  credentials?: { username: string; password: string; database?: string },
): ClickHouseConfig | null {
  // Cluster-aware path — try registry first even for "default"
  if (typeof clusterIdOrCredentials === "string") {
    const clusterId = clusterIdOrCredentials;
    const creds = credentials!;
    if (clusterId) {
      const registry = parseClusterRegistry();
      const def = registry.get(clusterId);
      if (def) {
        return {
          host: def.host,
          port: def.port,
          secure: def.secure,
          verifySsl: def.verifySsl,
          username: creds.username,
          password: creds.password,
          database: creds.database || "default",
          clusterId: def.id,
        };
      }
      // Unknown registry ID or "default" without registry entry — fall through
    }
  }

  // Legacy path
  const server = getServerConnection();
  const creds = credentials ??
    (clusterIdOrCredentials as {
      username: string;
      password: string;
      database?: string;
    });

  if (!server) {
    return null;
  }

  return {
    ...server,
    username: creds.username,
    password: creds.password,
    database: creds.database || "default",
    clusterId: typeof clusterIdOrCredentials === "string" && clusterIdOrCredentials !== "default"
      ? clusterIdOrCredentials
      : undefined,
  };
}

/**
 * Get default configuration (legacy, for backward compatibility)
 */
export function getDefaultConfig(): ClickHouseConfig | null {
  return getLensConfig();
}

/**
 * Build auth headers for ClickHouse HTTP interface
 */
export function buildAuthHeaders(
  config: ClickHouseConfig
): Record<string, string> {
  return {
    "X-ClickHouse-User": config.username,
    "X-ClickHouse-Key": config.password,
    "X-ClickHouse-Database": config.database,
  };
}

/**
 * Check if lens user is configured
 */
export function isLensUserConfigured(): boolean {
  return (!!process.env.CLICKHOUSE_HOST && !!process.env.LENS_USER) || !!process.env.CLICKHOUSE_CLUSTERS;
}
