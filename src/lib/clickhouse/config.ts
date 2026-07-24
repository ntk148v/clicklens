/**
 * ClickHouse client configuration
 *
 * Environment Variables:
 * - CLICKHOUSE_CLUSTERS: JSON array of cluster definitions (canonical)
 * - CLICKHOUSE_HOST, CLICKHOUSE_PORT, CLICKHOUSE_SECURE, CLICKHOUSE_VERIFY:
 *   Legacy single-cluster env vars (DEPRECATED — use CLICKHOUSE_CLUSTERS instead)
 * - LENS_USER, LENS_PASSWORD: Legacy service user credentials (DEPRECATED)
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
 * Deprecation warning for legacy CLICKHOUSE_HOST/LENS_USER env vars.
 * Printed once per process, contains no secrets.
 */
const LEGACY_DEPRECATION_MESSAGE =
  "CLICKHOUSE_HOST, CLICKHOUSE_PORT, CLICKHOUSE_SECURE, CLICKHOUSE_VERIFY, " +
  "LENS_USER, and LENS_PASSWORD are deprecated. Migrate to CLICKHOUSE_CLUSTERS " +
  "before the next major release.";

let legacyDeprecationWarned = false;

/** @internal Reset deprecation warning flag for testing */
export function $$resetDeprecationWarning(): void {
  legacyDeprecationWarned = false;
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
 * Build the effective cluster registry.
 *
 * - If CLICKHOUSE_CLUSTERS is set to a non-empty value, use it exclusively.
 * - If CLICKHOUSE_CLUSTERS is an explicit empty array "[]", no clusters.
 * - If CLICKHOUSE_CLUSTERS is absent and legacy vars are complete,
 *   synthesize one "default" entry and emit a deprecation warning once.
 * - Otherwise, return empty.
 */
function getEffectiveClusterRegistry(): Map<string, ClusterDefinition> {
  const raw = process.env.CLICKHOUSE_CLUSTERS;
  // Registry is explicitly set (including empty array)
  if (raw !== undefined && raw !== null && raw.trim() !== "") {
    return parseClusterRegistry();
  }
  // Registry absent or blank — try legacy fallback
  const host = process.env.CLICKHOUSE_HOST;
  const lensUser = process.env.LENS_USER;
  if (!host || !lensUser) return new Map();

  if (!legacyDeprecationWarned) {
    legacyDeprecationWarned = true;
    console.warn(LEGACY_DEPRECATION_MESSAGE);
  }

  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const configuredPort = Number.parseInt(process.env.CLICKHOUSE_PORT ?? "", 10);

  const def: ClusterDefinition = {
    id: "default",
    label: "Default",
    host,
    port: Number.isFinite(configuredPort) ? configuredPort : secure ? 8443 : 8123,
    secure,
    verifySsl: process.env.CLICKHOUSE_VERIFY !== "false",
    lensUser,
    lensPassword: process.env.LENS_PASSWORD ?? "",
  };

  return new Map([["default", def]]);
}

/**
 * Get public-safe list of configured clusters (id + label only).
 */
export function getConfiguredClusters(): { id: string; label: string }[] {
  const registry = getEffectiveClusterRegistry();
  return [...registry.values()].map((c) => ({ id: c.id, label: c.label }));
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
  return getEffectiveClusterRegistry().has(clusterId);
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
 * Requires a clusterId — resolves from the effective cluster registry.
 */
export function getLensConfig(clusterId: string): ClickHouseConfig | null {
  const registry = getEffectiveClusterRegistry();
  const def = registry.get(clusterId);
  if (!def) return null;

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

/**
 * Get user config by combining a cluster definition with session credentials.
 * Requires a clusterId — resolves from the effective cluster registry.
 */
export function getUserConfig(
  clusterId: string,
  credentials: {
    username: string;
    password: string;
    database?: string;
  },
): ClickHouseConfig | null {
  const registry = getEffectiveClusterRegistry();
  const def = registry.get(clusterId);
  if (!def) return null;

  return {
    host: def.host,
    port: def.port,
    secure: def.secure,
    verifySsl: def.verifySsl,
    username: credentials.username,
    password: credentials.password,
    database: credentials.database || "default",
    clusterId: def.id,
  };
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
 * Check if lens user is configured (any cluster exists in the effective registry).
 */
export function isLensUserConfigured(): boolean {
  return getEffectiveClusterRegistry().size > 0;
}
