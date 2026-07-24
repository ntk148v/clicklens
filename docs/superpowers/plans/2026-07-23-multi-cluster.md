# Multiple ClickHouse Clusters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple admin-configured ClickHouse endpoints; users select one at login and remain pinned to it for their session.

**Architecture:** Parse a server-only `CLICKHOUSE_CLUSTERS` JSON environment variable, with the current `CLICKHOUSE_*` variables retained as a one-cluster fallback. Store only the selected cluster ID with the encrypted server-side session data. Resolve every user/lens client from that ID—never from a client-supplied host.

**Tech Stack:** Next.js App Router, TypeScript, Bun, iron-session, @clickhouse/client

## Global Constraints

- `CLICKHOUSE_CLUSTERS` JSON must not contain duplicate IDs, empty IDs, or invalid port ranges
- Legacy `CLICKHOUSE_HOST` / `LENS_USER` / etc. variables continue to work as before (implicit `"default"` cluster)
- The cluster ID flows from login, through the server-side session, to every config resolver — never from request body or query param after login
- Changing or removing a configured cluster ID invalidates affected sessions; user must re-login
- No new npm dependencies beyond what's already in package.json
- All existing tests must continue to pass

---

### Task A: Cluster registry and scoped config resolution

**Files:**

- Modify: `src/lib/clickhouse/config.ts`
- Modify: `src/lib/clickhouse/config.test.ts`
- Modify: `src/lib/clickhouse/index.ts`
- Modify: `env.sample`
- Create: — (no new files)

**Interfaces (new / changed):**

```typescript
// New exported types from config.ts
export interface ClusterDefinition {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  verifySsl: boolean;
  lensUser: string;
  lensPassword: string;
}

// Changed/added exported functions from config.ts
export function parseClusterRegistry(): Map<string, ClusterDefinition>;
export function getConfiguredClusters(): { id: string; label: string }[];
export function getLensConfig(clusterId?: string): ClickHouseConfig | null;
export function getUserConfig(
  clusterId: string,
  credentials: { username: string; password: string; database?: string },
): ClickHouseConfig | null;
export function isClusterConfigured(clusterId: string): boolean;
export function getDefaultClusterId(): string;
// getServerConnection() still exists, now also reads from CLICKHOUSE_CLUSTERS
```

**How it works:**

1. `parseClusterRegistry()` reads `CLICKHOUSE_CLUSTERS` from env. It's a JSON array of `{ id, label, host, port?, secure?, verifySsl?, lensUser, lensPassword }`. Returns a `Map<string, ClusterDefinition>`.

2. `getDefaultClusterId()` returns the single entry's ID if exactly one cluster exists, or `"default"` (the legacy fallback name), or `null` if none.

3. `getLensConfig(clusterId?)` — when called without arguments, falls back to legacy `CLICKHOUSE_HOST` + `LENS_USER`. When called with a clusterId, resolves from the registry. If the legacy env vars are also set, they're treated as the `"default"` cluster.

4. `getUserConfig(clusterId, credentials)` — requires clusterId; resolves the ClusterDefinition from registry and merges with user credentials.

5. `getConfiguredClusters()` — returns public-safe `{ id, label }[]` for the login UI.

6. Legacy `getDefaultConfig()` and `getUserConfig(credentials)` (no clusterId) still work for backward compatibility, delegating to the legacy env vars.

**Validation rules in parseClusterRegistry:**

- Must be valid JSON array or null/undefined (skip)
- Each entry: `id` required (non-empty string, no whitespace), `label` required, `host` required, `lensUser` required, `lensPassword` required
- `port`: if absent, defaults to 8123 (or 8443 when `secure: true`)
- `secure`: defaults to `false`
- `verifySsl`: defaults to `true`
- Duplicate `id` values throw at startup

- [ ] **Step 1: Write failing tests for the new cluster registry functions**

  ```typescript
  // Add to src/lib/clickhouse/config.test.ts
  import { describe, test, expect, beforeEach, afterEach } from "bun:test";
  import {
    parseClusterRegistry,
    getConfiguredClusters,
    getLensConfig,
    getUserConfig,
    isClusterConfigured,
    getDefaultClusterId,
  } from "./config";

  describe("multi-cluster registry", () => {
    const origEnv = { ...process.env };

    afterEach(() => {
      Object.assign(process.env, origEnv);
    });

    test("returns empty when CLICKHOUSE_CLUSTERS is not set and no legacy env", () => {
      delete process.env.CLICKHOUSE_CLUSTERS;
      delete process.env.CLICKHOUSE_HOST;
      expect(getConfiguredClusters()).toEqual([]);
      expect(getDefaultClusterId()).toBeNull();
    });

    test("legacy env vars work as implicit default cluster", () => {
      process.env.CLICKHOUSE_HOST = "ch1.example.com";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "pass";
      const clusters = getConfiguredClusters();
      expect(clusters).toHaveLength(1);
      expect(clusters[0].id).toBe("default");
      expect(clusters[0].label).toBe("default");
    });

    test("parses CLICKHOUSE_CLUSTERS JSON correctly", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        {
          id: "prod",
          label: "Production",
          host: "prod.example.com",
          lensUser: "lens",
          lensPassword: "secret",
        },
        {
          id: "staging",
          label: "Staging",
          host: "staging.example.com",
          port: 8443,
          secure: true,
          lensUser: "lens",
          lensPassword: "secret",
        },
      ]);
      const clusters = getConfiguredClusters();
      expect(clusters).toHaveLength(2);
      expect(clusters[0].id).toBe("prod");
      expect(clusters[1].id).toBe("staging");
    });

    test("getLensConfig with clusterId returns correct config", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        {
          id: "prod",
          label: "Prod",
          host: "prod.example.com",
          lensUser: "lens",
          lensPassword: "sekret",
        },
      ]);
      const config = getLensConfig("prod");
      expect(config).not.toBeNull();
      expect(config!.host).toBe("prod.example.com");
      expect(config!.username).toBe("lens");
      expect(config!.password).toBe("sekret");
      expect(config!.port).toBe(8123);
    });

    test("getUserConfig merges cluster definition with user credentials", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        {
          id: "prod",
          label: "Prod",
          host: "prod.example.com",
          lensUser: "lens",
          lensPassword: "x",
        },
      ]);
      const config = getUserConfig("prod", {
        username: "alice",
        password: "alicepass",
        database: "mydb",
      });
      expect(config).not.toBeNull();
      expect(config!.host).toBe("prod.example.com");
      expect(config!.username).toBe("alice");
      expect(config!.password).toBe("alicepass");
      expect(config!.database).toBe("mydb");
    });

    test("getUserConfig without legacy env returns null for unknown cluster", () => {
      expect(
        getUserConfig("nonexistent", { username: "u", password: "p" }),
      ).toBeNull();
    });

    test("rejects duplicate cluster IDs", () => {
      process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
        {
          id: "prod",
          label: "Prod",
          host: "a.com",
          lensUser: "l",
          lensPassword: "p",
        },
        {
          id: "prod",
          label: "Dupe",
          host: "b.com",
          lensUser: "l",
          lensPassword: "p",
        },
      ]);
      expect(() => parseClusterRegistry()).toThrow(/duplicate.*prod/i);
    });

    test("getDefaultClusterId returns default for legacy-only config", () => {
      process.env.CLICKHOUSE_HOST = "ch.local";
      process.env.LENS_USER = "lens";
      process.env.LENS_PASSWORD = "p";
      expect(getDefaultClusterId()).toBe("default");
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `bun test src/lib/clickhouse/config.test.ts --filter "multi-cluster" --timeout 10000`
  Expected: FAIL — functions not defined yet

- [ ] **Step 3: Implement the cluster registry in config.ts**

  Add to `src/lib/clickhouse/config.ts`:

  ```typescript
  export interface ClusterDefinition {
    id: string;
    label: string;
    host: string;
    port: number;
    secure: boolean;
    verifySsl: boolean;
    lensUser: string;
    lensPassword: string;
  }

  let parsedRegistry: Map<string, ClusterDefinition> | null = null;

  export function parseClusterRegistry(): Map<string, ClusterDefinition> {
    if (parsedRegistry) return parsedRegistry;
    parsedRegistry = new Map();

    const json = process.env.CLICKHOUSE_CLUSTERS;
    if (json) {
      let entries: unknown[];
      try {
        entries = JSON.parse(json);
      } catch {
        throw new Error(`CLICKHOUSE_CLUSTERS is not valid JSON: ${json}`);
      }
      if (!Array.isArray(entries)) {
        throw new Error("CLICKHOUSE_CLUSTERS must be a JSON array");
      }
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") {
          throw new Error(
            `Invalid cluster entry in CLICKHOUSE_CLUSTERS: ${JSON.stringify(entry)}`,
          );
        }
        const e = entry as Record<string, unknown>;
        if (!e.id || typeof e.id !== "string" || !e.id.trim()) {
          throw new Error(
            `Cluster entry missing 'id': ${JSON.stringify(entry)}`,
          );
        }
        const id = e.id.trim();
        if (/\s/.test(id)) {
          throw new Error(`Cluster ID must not contain whitespace: '${id}'`);
        }
        if (parsedRegistry.has(id)) {
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
        parsedRegistry.set(id, {
          id,
          label: String(e.label),
          host: String(e.host),
          port: e.port ? parseInt(String(e.port), 10) : secure ? 8443 : 8123,
          secure,
          verifySsl: e.verifySsl !== false,
          lensUser: String(e.lensUser),
          lensPassword: String(e.lensPassword),
        });
      }
    }
    return parsedRegistry;
  }

  export function getConfiguredClusters(): { id: string; label: string }[] {
    const registry = parseClusterRegistry();
    const hasLegacy = !!process.env.CLICKHOUSE_HOST && !!process.env.LENS_USER;

    const clusters = [...registry.values()].map((c) => ({
      id: c.id,
      label: c.label,
    }));

    // Inject the legacy "default" cluster only if CLICKHOUSE_CLUSTERS didn't already define it
    if (hasLegacy && !registry.has("default")) {
      clusters.unshift({ id: "default", label: "default" });
    }
    // Even without CLICKHOUSE_CLUSTERS, if legacy env is set, show the default cluster
    if (clusters.length === 0 && hasLegacy) {
      clusters.push({ id: "default", label: "default" });
    }
    return clusters;
  }

  export function getDefaultClusterId(): string | null {
    const clusters = getConfiguredClusters();
    if (clusters.length === 0) return null;
    return clusters[0].id;
  }

  export function isClusterConfigured(clusterId: string): boolean {
    if (clusterId === "default" && !!process.env.CLICKHOUSE_HOST) return true;
    return parseClusterRegistry().has(clusterId);
  }
  ```

  Then update `getLensConfig()` to accept an optional `clusterId`:

  ```typescript
  export function getLensConfig(clusterId?: string): ClickHouseConfig | null {
    if (clusterId && clusterId !== "default") {
      const registry = parseClusterRegistry();
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
      };
    }
    // Fallback to legacy env
    const server = getServerConnection();
    const lensUser = process.env.LENS_USER;
    if (!server || !lensUser) return null;
    return {
      ...server,
      username: lensUser,
      password: process.env.LENS_PASSWORD || "",
      database: "default",
    };
  }
  ```

  And update `getUserConfig()`:

  ```typescript
  export function getUserConfig(
    clusterId: string,
    credentials: { username: string; password: string; database?: string },
  ): ClickHouseConfig | null {
    if (clusterId && clusterId !== "default") {
      const registry = parseClusterRegistry();
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
      };
    }
    // Legacy path
    const server = getServerConnection();
    if (!server) return null;
    return {
      ...server,
      username: credentials.username,
      password: credentials.password,
      database: credentials.database || "default",
    };
  }
  ```

  Keep `getDefaultConfig()` and the two-arg `getUserConfig({username, password, database})` overload for backward compat.

  Also add `resetClusterRegistry` for testing:

  ```typescript
  export function resetClusterRegistry(): void {
    parsedRegistry = null;
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run: `bun test src/lib/clickhouse/config.test.ts --timeout 15000`
  Expected: ALL PASS (including existing legacy tests)

- [ ] **Step 5: Update index.ts exports**

  Add to `src/lib/clickhouse/index.ts`:

  ```typescript
  export {
    getConfiguredClusters,
    getDefaultClusterId,
    isClusterConfigured,
    parseClusterRegistry,
    ClusterDefinition,
    resetClusterRegistry,
  } from "./config";
  ```

- [ ] **Step 6: Update env.sample**

  Add to `env.sample`:

  ```bash
  # Multiple ClickHouse Clusters (optional JSON array)
  # Overrides CLICKHOUSE_HOST/CLICKHOUSE_PORT/CLICKHOUSE_SECURE/CLICKHOUSE_VERIFY
  # when set. Each entry is: { "id", "label", "host", "port"?, "secure"?, "verifySsl"?, "lensUser", "lensPassword" }
  # CLICKHOUSE_CLUSTERS='[{"id":"prod","label":"Production","host":"prod.example.com","lensUser":"lens","lensPassword":"secret"}]'
  ```

- [ ] **Step 7: Run full test suite**

  Run: `bun run test`
  Expected: 761 pass (or more)

- [ ] **Step 8: Commit**

  ```bash
  git add src/lib/clickhouse/config.ts src/lib/clickhouse/config.test.ts src/lib/clickhouse/index.ts env.sample
  git commit -m "feat: add cluster registry for multiple ClickHouse endpoints

  Introduce CLICKHOUSE_CLUSTERS JSON env var for configuring multiple
  ClickHouse clusters. Legacy CLICKHOUSE_HOST/CLICKHOUSE_PORT/LENS_USER
  env vars continue to work as the implicit 'default' cluster.

  New exports from config.ts: parseClusterRegistry, getConfiguredClusters,
  getDefaultClusterId, isClusterConfigured, getLensConfig(clusterId),
  getUserConfig(clusterId, credentials), resetClusterRegistry."
  ```

---

### Task B: Persist cluster ID in server-side sessions

**Files:**

- Modify: `src/lib/auth/storage.ts`
- Modify: `src/lib/auth/session.ts`
- Modify: `src/lib/auth/index.ts`
- Create: `src/lib/auth/st
