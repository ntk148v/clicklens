# ClickHouse Cluster Registry Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `CLICKHOUSE_CLUSTERS` the canonical configuration mechanism for both one- and many-cluster deployments while temporarily translating complete legacy env configuration into a deprecated `default` registry entry.

**Architecture:** All runtime configuration is resolved from one effective cluster registry. A non-empty `CLICKHOUSE_CLUSTERS` value is authoritative; otherwise, a complete legacy configuration (`CLICKHOUSE_HOST` and `LENS_USER`) is translated into one `default` entry and emits one sanitized server-side deprecation warning per process. Every new authenticated session receives a concrete `clusterId`, and all ClickHouse clients receive an explicit cluster-derived configuration.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Bun Test, `@clickhouse/client`, Docker Compose, Prettier.

## Global Constraints

- `CLICKHOUSE_CLUSTERS` must support a one-entry array for single-cluster deployments and a multi-entry array for multi-cluster deployments.
- A non-empty registry takes precedence over all legacy environment variables; never merge a legacy `default` entry into it.
- Legacy fallback is temporary: only synthesize it when `CLICKHOUSE_CLUSTERS` is unset or blank and both `CLICKHOUSE_HOST` and `LENS_USER` are present.
- Log the deprecation warning server-side once per process; it must contain no hostnames, ports, usernames, passwords, or raw JSON.
- Never return registry internals from `/api/auth/clusters`; only `id` and `label` remain public.
- New login sessions must always store a configured `clusterId`; old sessions without one must require login again rather than being routed implicitly.
- Continue using only ClickHouse HTTP/HTTPS ports (8123/8443), never native TCP ports.
- Do not add dependencies.

---

## File Structure

| File                                                                                   | Responsibility                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/clickhouse/config.ts`                                                         | Build the effective registry, warn on legacy translation, and expose cluster-ID-only config APIs.   |
| `src/lib/clickhouse/config.test.ts`                                                    | Prove registry precedence, single-entry behavior, deprecated fallback, and explicit config lookups. |
| `src/lib/clickhouse/client.ts`                                                         | Require callers to supply a resolved `ClickHouseConfig`.                                            |
| `src/lib/auth/index.ts`                                                                | Reject unpinned sessions and resolve user/Lens configs using their session cluster ID.              |
| `src/lib/auth/session.ts`                                                              | Make persisted authenticated users carry a `clusterId`.                                             |
| `src/app/api/auth/login/route.ts`                                                      | Resolve a selected/default registry ID once and persist it in each new session.                     |
| `src/app/api/auth/clusters/route.ts`                                                   | Keep returning a public-safe registry list and configured default ID.                               |
| `src/lib/clickhouse/metadata.ts` and any compiler-discovered client callers            | Pass an explicit resolved config; remove implicit default-client paths.                             |
| `env.sample`, `docker-compose.yml`, `docker-compose.multi-cluster.yml`                 | Make the registry the documented and demo runtime input.                                            |
| `README.md`, `docs/pages/{index,getting-started,deployment,architecture,features}.mdx` | Document one-entry registry configuration and legacy-variable deprecation.                          |

## Task 1: Centralize Registry Resolution and Deprecation Warning

**Files:**

- Modify: `src/lib/clickhouse/config.ts:1-341`
- Modify: `src/lib/clickhouse/config.test.ts:1-480`

**Interfaces:**

- Produces: `getConfiguredClusters(): { id: string; label: string }[]`
- Produces: `getDefaultClusterId(): string | null`
- Produces: `isClusterConfigured(clusterId: string): boolean`
- Produces: `getLensConfig(clusterId: string): ClickHouseConfig | null`
- Produces: `getUserConfig(clusterId: string, credentials: UserCredentials): ClickHouseConfig | null`
- Retains: `isLensUserConfigured(): boolean`, implemented as an effective-registry availability check only; it must not resolve a default cluster.
- Removes: no-ID `getLensConfig()`, one-argument `getUserConfig(credentials)`, `getServerConnection()`, and `getDefaultConfig()` legacy APIs.

- [ ] **Step 1: Write failing registry-behavior tests**

Replace legacy fallback tests with table-driven tests that use a helper such as:

```ts
function setRegistry(entries: object[]) {
  process.env.CLICKHOUSE_CLUSTERS = JSON.stringify(entries);
}

const singleCluster = {
  id: "primary",
  label: "Primary",
  host: "primary.example.test",
  port: 8123,
  lensUser: "lens",
  lensPassword: "lens-password",
};
```

Add these exact cases:

```ts
test("uses a one-entry registry as the complete single-cluster configuration", () => {
  setRegistry([singleCluster]);

  expect(getConfiguredClusters()).toEqual([
    { id: "primary", label: "Primary" },
  ]);
  expect(getDefaultClusterId()).toBe("primary");
  expect(getLensConfig("primary")).toMatchObject({
    host: "primary.example.test",
    username: "lens",
    clusterId: "primary",
  });
  expect(
    getUserConfig("primary", { username: "alice", password: "user-password" }),
  ).toMatchObject({ username: "alice", clusterId: "primary" });
});

test("uses the registry exclusively when both config mechanisms are set", () => {
  process.env.CLICKHOUSE_HOST = "legacy.example.test";
  process.env.LENS_USER = "legacy-lens";
  setRegistry([singleCluster]);

  expect(getConfiguredClusters()).toEqual([
    { id: "primary", label: "Primary" },
  ]);
  expect(isClusterConfigured("default")).toBe(false);
  expect(getLensConfig("default")).toBeNull();
});

test("translates complete legacy configuration to a deprecated default cluster", () => {
  process.env.CLICKHOUSE_HOST = "legacy.example.test";
  process.env.CLICKHOUSE_PORT = "8443";
  process.env.CLICKHOUSE_SECURE = "true";
  process.env.CLICKHOUSE_VERIFY = "false";
  process.env.LENS_USER = "legacy-lens";
  process.env.LENS_PASSWORD = "legacy-password";

  expect(getConfiguredClusters()).toEqual([
    { id: "default", label: "Default" },
  ]);
  expect(getLensConfig("default")).toMatchObject({
    host: "legacy.example.test",
    port: 8443,
    secure: true,
    verifySsl: false,
    username: "legacy-lens",
    clusterId: "default",
  });
});

test("does not synthesize a legacy cluster for an explicit empty registry", () => {
  process.env.CLICKHOUSE_HOST = "legacy.example.test";
  process.env.LENS_USER = "legacy-lens";
  process.env.CLICKHOUSE_CLUSTERS = "[]";

  expect(getConfiguredClusters()).toEqual([]);
  expect(getDefaultClusterId()).toBeNull();
});

test("returns no configuration from partial legacy variables", () => {
  process.env.CLICKHOUSE_HOST = "legacy.example.test";

  expect(getConfiguredClusters()).toEqual([]);
  expect(getLensConfig("default")).toBeNull();
});
```

Add a warning test using `spyOn(console, "warn")`. It must invoke an effective-registry function twice with complete legacy vars and assert one call whose text includes `deprecated`, `CLICKHOUSE_CLUSTERS`, and `next major release`, but excludes `legacy.example.test`, `legacy-lens`, and `legacy-password`.

- [ ] **Step 2: Run the focused test file to verify failures**

Run:

```bash
bun test src/lib/clickhouse/config.test.ts
```

Expected: FAIL because registry functions still construct/merge the legacy `default` cluster directly and the no-ID APIs still exist.

- [ ] **Step 3: Implement one effective-registry function**

In `config.ts`, retain `parseClusterRegistry()` as validation for `CLICKHOUSE_CLUSTERS`, then add a private effective-registry layer. Use `undefined`/blank to mean “registry absent”; an explicit `[]` remains authoritative and disables legacy fallback:

```ts
const LEGACY_DEPRECATION_MESSAGE =
  "CLICKHOUSE_HOST, CLICKHOUSE_PORT, CLICKHOUSE_SECURE, CLICKHOUSE_VERIFY, " +
  "LENS_USER, and LENS_PASSWORD are deprecated. Migrate to CLICKHOUSE_CLUSTERS " +
  "before the next major release.";

let legacyDeprecationWarned = false;

function legacyClusterDefinition(): ClusterDefinition | null {
  const host = process.env.CLICKHOUSE_HOST;
  const lensUser = process.env.LENS_USER;
  if (!host || !lensUser) return null;

  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const configuredPort = Number.parseInt(process.env.CLICKHOUSE_PORT ?? "", 10);

  return {
    id: "default",
    label: "Default",
    host,
    port: Number.isFinite(configuredPort)
      ? configuredPort
      : secure
        ? 8443
        : 8123,
    secure,
    verifySsl: process.env.CLICKHOUSE_VERIFY !== "false",
    lensUser,
    lensPassword: process.env.LENS_PASSWORD ?? "",
  };
}

function getEffectiveClusterRegistry(): Map<string, ClusterDefinition> {
  const rawRegistry = process.env.CLICKHOUSE_CLUSTERS;
  if (rawRegistry?.trim()) return parseClusterRegistry();

  const legacy = legacyClusterDefinition();
  if (!legacy) return new Map();

  if (!legacyDeprecationWarned) {
    legacyDeprecationWarned = true;
    console.warn(LEGACY_DEPRECATION_MESSAGE);
  }
  return new Map([[legacy.id, legacy]]);
}
```

Build public cluster lists, defaults, configuration checks, Lens config, and user config solely from `getEffectiveClusterRegistry()`. Define a `UserCredentials` interface once and use only this signature:

```ts
export function getUserConfig(
  clusterId: string,
  credentials: UserCredentials,
): ClickHouseConfig | null;
```

Both Lens and user config objects must include `clusterId`. Keep `isLensUserConfigured(): boolean` as `getEffectiveClusterRegistry().size > 0`; it reports that a registry exists but never selects a cluster. Remove server-env connection helpers and legacy overloads rather than retaining dead compatibility APIs.

- [ ] **Step 4: Update configuration tests and imports to the explicit APIs**

Delete tests whose contract is “no ID defaults to `CLICKHOUSE_HOST`.” Update remaining URL/header tests to construct plain `ClickHouseConfig` fixtures directly. Ensure `beforeEach` clears `CLICKHOUSE_CLUSTERS` and all legacy vars; restore `console.warn` spies in `finally`/`mockRestore()`.

- [ ] **Step 5: Run focused validation**

Run:

```bash
bun test src/lib/clickhouse/config.test.ts
bun run lint -- src/lib/clickhouse/config.ts src/lib/clickhouse/config.test.ts
```

Expected: all configuration tests pass and lint exits 0.

- [ ] **Step 6: Commit the atomic configuration change**

```bash
git add src/lib/clickhouse/config.ts src/lib/clickhouse/config.test.ts
git commit -m "refactor(config): centralize ClickHouse cluster registry"
```

## Task 2: Require Explicit Cluster Resolution for Authentication and Clients

**Files:**

- Modify: `src/lib/auth/session.ts`
- Modify: `src/lib/auth/index.ts:58-128`
- Modify: `src/app/api/auth/login/route.ts:28-205`
- Modify: `src/app/api/auth/clusters/route.ts`
- Modify: `src/lib/clickhouse/client.ts:98-107`
- Modify: `src/lib/clickhouse/metadata.ts`
- Modify: `src/app/api/saved-queries/route.ts`
- Test: `src/lib/auth/storage.test.ts`
- Test: `src/lib/clickhouse/client.test.ts`
- Create: `src/app/api/auth/login/route.test.ts`

**Interfaces:**

- Consumes: Task 1 `getDefaultClusterId()`, `getUserConfig(clusterId, credentials)`, `getLensConfig(clusterId)`, `isLensUserConfigured(clusterId)`.
- Produces: all newly created authenticated sessions persist `user.clusterId: string`.
- Produces: `createClient(config: ClickHouseConfig): ClickHouseClient`; no implicit config resolution.

- [ ] **Step 1: Write failing tests for pinned-session and explicit-client behavior**

Add assertions for these behaviors:

```ts
test("login without clusterId pins a one-entry registry session to its only cluster", async () => {
  // Configure [{ id: "primary", ... }], POST valid login body without clusterId.
  // Mock ClickHouse version/auth probe and inspect createSession input.
  expect(mockCreateSession).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ clusterId: "primary" }),
  );
});

test("login rejects an unconfigured cluster ID", async () => {
  // Configure primary only, POST { clusterId: "missing", ... }.
  expect(response.status).toBe(400);
});

test("session helpers reject sessions without a cluster ID", async () => {
  // Hydrate an authenticated legacy-shaped session without clusterId.
  expect(await getSessionClickHouseConfig()).toBeNull();
  expect(await getSessionLensConfig()).toBeNull();
});

test("createClient requires an explicit config", () => {
  expect(() => createClient()).toThrow();
});
```

If TypeScript makes a zero-argument `createClient()` test impossible after the API change, replace its compile-time contract with:

```ts
const config: ClickHouseConfig = {
  host: "localhost",
  port: 8123,
  secure: false,
  verifySsl: true,
  username: "lens",
  password: "",
  database: "default",
  clusterId: "primary",
};
expect(createClient(config)).toBeDefined();
```

The absence of a zero-argument overload is then enforced by `bunx tsc --noEmit` in Step 5.

- [ ] **Step 2: Run focused tests to verify failures**

Run:

```bash
bun test src/lib/auth/storage.test.ts src/lib/clickhouse/client.test.ts src/app/api/auth/login/route.test.ts
```

Expected: FAIL because login still special-cases `default`, session helpers still fall back to no-ID configs, and `createClient` resolves its own default config.

- [ ] **Step 3: Make cluster identity mandatory at authentication boundaries**

In `session.ts`/the persisted session user type, make `clusterId: string` required for authenticated user records. In `login/route.ts`:

```ts
const clusterId = body.clusterId ?? getDefaultClusterId();
if (!clusterId || !isClusterConfigured(clusterId)) {
  return NextResponse.json(
    { success: false, error: "Selected cluster is not configured" },
    { status: 400 },
  );
}

const config = getUserConfig(clusterId, {
  username: body.username,
  password: body.password || "",
});
```

Remove the `clusterId !== "default"` branch and remove `config.host || process.env.CLICKHOUSE_HOST`; use the resolved `config.host` directly. Change the no-server error to:

```ts
"Server not configured. Set CLICKHOUSE_CLUSTERS.";
```

Retain omission of `clusterId` in the request for compatibility with a single configured registry entry, but the stored session must always contain the resolved value.

In `auth/index.ts`, remove all no-cluster fallback branches. A stored session without `clusterId` is invalid and returns `null`, causing existing auth guards to demand a new login. Resolve both user and Lens configs only with `session.user.clusterId`.

- [ ] **Step 4: Remove implicit default clients and migrate the metadata path**

Change the client API to:

```ts
export function createClient(config: ClickHouseConfig): ClickHouseClient {
  // Existing @clickhouse/client construction, using config only.
}
```

Delete the `config ?? getLensConfig()` resolution and its legacy-env error. Existing session-scoped routes already resolve a session Lens config before constructing their client; retain `isLensUserConfigured()` as a registry-availability guard only.

Change metadata initialization to accept the already-resolved Lens config:

```ts
export async function ensureMetadataInfrastructure(
  config: ClickHouseConfig,
): Promise<void> {
  const client = createClient(config);
  const clusterName = await getClusterName(client, config.clusterId);
  // Keep the existing idempotent database/table DDL.
}
```

In `src/app/api/saved-queries/route.ts`, obtain `const config = await getSessionLensConfig();`, return the existing configuration error response when it is null, construct `createClient(config)`, and call `await ensureMetadataInfrastructure(config)` for both GET and POST paths. Delete the metadata module's no-ID imports of `getLensConfig` and `isLensUserConfigured`.

Do not choose the first configured cluster inside a background/helper function: only the login boundary may select `getDefaultClusterId()` when the request omitted a selection.

- [ ] **Step 5: Run typecheck and targeted tests**

Run:

```bash
bunx tsc --noEmit
bun test src/lib/auth/storage.test.ts src/lib/clickhouse/client.test.ts src/app/api/auth/login/route.test.ts
bun run lint
```

Expected: typecheck and lint exit 0; focused tests pass. Any remaining call to the removed signatures is a compile failure and must be migrated before proceeding.

- [ ] **Step 6: Commit the explicit-resolution change**

```bash
git add src/lib/auth/session.ts src/lib/auth/storage.ts src/lib/auth/index.ts src/app/api/auth/login/route.ts src/app/api/auth/clusters/route.ts src/lib/clickhouse/client.ts src/lib/clickhouse/metadata.ts src/app/api/saved-queries/route.ts src/lib/auth/storage.test.ts src/lib/clickhouse/client.test.ts src/app/api/auth/login/route.test.ts
git diff --cached --check
git commit -m "refactor(auth): require a pinned ClickHouse cluster"
```

## Task 3: Verify Cluster Discovery, Registry Precedence, and Request Isolation

**Files:**

- Modify: `src/app/api/auth/clusters/route.test.ts` (create if absent)
- Modify: `src/lib/clickhouse/cluster.test.ts`
- Modify: any affected route test mocks that relied on no-ID `getLensConfig()` or `getUserConfig()`.

**Interfaces:**

- Consumes: Task 1 effective registry and Task 2 explicit `clusterId` config APIs.
- Produces: regression coverage that a one-entry registry is public-safe and legacy-derived configuration does not leak metadata or break per-cluster cluster-name caching.

- [ ] **Step 1: Write failing public-cluster endpoint tests**

Create/extend the clusters route test with:

```ts
test("returns only ID and label for a one-entry registry", async () => {
  process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
    {
      id: "primary",
      label: "Primary",
      host: "internal.example.test",
      port: 8443,
      lensUser: "lens",
      lensPassword: "secret",
    },
  ]);

  const response = await GET();
  expect(await response.json()).toEqual({
    success: true,
    clusters: [{ id: "primary", label: "Primary" }],
    defaultClusterId: "primary",
  });
});

test("does not add legacy default to an explicit registry", async () => {
  process.env.CLICKHOUSE_HOST = "legacy.example.test";
  process.env.LENS_USER = "legacy";
  process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
    {
      id: "primary",
      label: "Primary",
      host: "primary",
      lensUser: "lens",
      lensPassword: "secret",
    },
  ]);

  const response = await GET();
  const body = await response.json();
  expect(body.clusters).toEqual([{ id: "primary", label: "Primary" }]);
  expect(JSON.stringify(body)).not.toContain("legacy.example.test");
  expect(JSON.stringify(body)).not.toContain("secret");
});
```

Update `cluster.test.ts` so a legacy-derived `default` config remains cache-isolated with the literal `clusterId` `"default"`, and registry-specific `clickhouseCluster` overrides still take precedence.

- [ ] **Step 2: Run tests to verify failures**

Run:

```bash
bun test src/app/api/auth/clusters/route.test.ts src/lib/clickhouse/cluster.test.ts
```

Expected: FAIL until the endpoint and mocks use the new explicit registry semantics.

- [ ] **Step 3: Make test fixtures explicit and public-safe**

Update mocks in route tests to accept an ID argument and return configurations containing `clusterId`. Do not alter production endpoint response fields: preserve `{ success, clusters, defaultClusterId }`; only `id` and `label` may appear in `clusters`.

- [ ] **Step 4: Run focused regressions**

Run:

```bash
bun test src/app/api/auth/clusters/route.test.ts src/lib/clickhouse/cluster.test.ts
bun test src/lib/clickhouse/config.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit request-isolation coverage**

```bash
git add src/app/api/auth/clusters/route.test.ts src/lib/clickhouse/cluster.test.ts
git diff --cached --check
git commit -m "test(auth): cover canonical cluster registry behavior"
```

## Task 4: Migrate Samples, Compose, and Documentation to Registry-First Configuration

**Files:**

- Modify: `env.sample`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.multi-cluster.yml`
- Modify: `README.md`
- Modify: `docs/pages/index.mdx`
- Modify: `docs/pages/getting-started.mdx`
- Modify: `docs/pages/deployment.mdx`
- Modify: `docs/pages/architecture.mdx`
- Modify: `docs/pages/features.mdx`

**Interfaces:**

- Consumes: the Task 1 legacy deprecation wording and the one-entry registry schema.
- Produces: one documented connection format for new deployments, plus an explicit migration note for old deployments.

- [ ] **Step 1: Replace the sample configuration with a one-entry registry**

Remove the “single-cluster mode (legacy)” block from `env.sample`. Make the primary copy/paste configuration:

```bash
# Required: one entry for one ClickHouse cluster, more entries for more clusters.
# Uses the ClickHouse HTTP/HTTPS interface only (ports 8123/8443).
CLICKHOUSE_CLUSTERS='[
  {"id":"primary","label":"Primary","host":"localhost","port":8123,"lensUser":"lensuser","lensPassword":"change-me"}
]'
```

Keep `secure`, `verifySsl`, and `clickhouseCluster` as documented optional per-entry fields. Add a short deprecation migration note naming all six legacy variables and stating they are accepted temporarily only when `CLICKHOUSE_CLUSTERS` is not set, with removal in the next major release. Do not add working credentials or weaken production cookie defaults.

- [ ] **Step 2: Align Compose files with the canonical mechanism**

Ensure both Compose files define `CLICKHOUSE_CLUSTERS` and do not rely on `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`, `CLICKHOUSE_SECURE`, `CLICKHOUSE_VERIFY`, `LENS_USER`, or `LENS_PASSWORD` for ClickLens. Preserve `.env.local` interpolation and the fresh-volume note for the multi-cluster demo. Do not expose native ClickHouse TCP ports as application connection examples.

- [ ] **Step 3: Rewrite documentation examples and compatibility language**

Across README and docs pages:

- Use one `CLICKHOUSE_CLUSTERS` entry in all single-cluster Docker and Compose examples.
- State: “A single cluster is a one-entry registry; multi-cluster is the same variable with more entries.”
- Move old variables into one **Deprecated configuration migration** note with this mapping:

| Legacy variables                                                                                             | Replacement                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`, `CLICKHOUSE_SECURE`, `CLICKHOUSE_VERIFY`, `LENS_USER`, `LENS_PASSWORD` | One `CLICKHOUSE_CLUSTERS` entry with `host`, `port`, `secure`, `verifySsl`, `lensUser`, and `lensPassword` |

- State registry precedence clearly: when `CLICKHOUSE_CLUSTERS` is non-empty, legacy variables are ignored; an explicit `[]` configures no clusters.
- Remove claims that legacy single-cluster mode is the standard configuration. Retain a concise temporary deprecation note only.
- Keep public API/security documentation accurate: `/api/auth/clusters` returns only `id` and `label`; requests and caches remain pinned by `config.clusterId`.

- [ ] **Step 4: Format documentation and validate no obsolete primary examples remain**

Run:

```bash
npx prettier --write README.md env.sample docker-compose.yml docker-compose.multi-cluster.yml docs/pages/index.mdx docs/pages/getting-started.mdx docs/pages/deployment.mdx docs/pages/architecture.mdx docs/pages/features.mdx
rg -n "Single-Cluster Mode|Set CLICKHOUSE_HOST \+ LENS_USER|legacy single-env|falls back to legacy|CLICKHOUSE_HOST=.*your-clickhouse-host|LENS_USER=lensuser" README.md env.sample docker-compose*.yml docs/pages
```

Expected: Prettier succeeds. The search may find only the explicitly labeled deprecation-migration note; remove or rewrite any result presented as a normal setup instruction.

- [ ] **Step 5: Commit the migration documentation**

```bash
git add env.sample docker-compose.yml docker-compose.multi-cluster.yml README.md docs/pages/index.mdx docs/pages/getting-started.mdx docs/pages/deployment.mdx docs/pages/architecture.mdx docs/pages/features.mdx
git diff --cached --check
git commit -m "docs: make cluster registry the canonical configuration"
```

## Task 5: Full Verification and Deprecation-Path Smoke Test

**Files:**

- Modify only if verification exposes a real defect in Tasks 1-4.

**Interfaces:**

- Verifies all public application and configuration behavior from Tasks 1-4.

- [ ] **Step 1: Run the full static and unit test suite**

Run:

```bash
bunx tsc --noEmit
bun run lint
bun run test
```

Expected: TypeScript exits 0, lint exits 0, and the complete Bun test suite passes.

- [ ] **Step 2: Run canonical one-cluster smoke configuration**

Set a one-entry `CLICKHOUSE_CLUSTERS` value against the existing local/demo ClickHouse HTTP endpoint, start ClickLens, and verify:

```bash
curl -fsS http://localhost:3000/api/auth/clusters
```

Expected response shape:

```json
{
  "success": true,
  "clusters": [{ "id": "primary", "label": "Primary" }],
  "defaultClusterId": "primary"
}
```

Log in with a valid user and verify `/api/auth/session` reports the selected `clusterId`; then request databases and one monitoring/table endpoint to prove user and Lens paths use the same registry target.

- [ ] **Step 3: Run deprecated legacy fallback smoke configuration**

Start the app with `CLICKHOUSE_CLUSTERS` unset and complete legacy variables set. Verify one startup/process log warning exactly matching the sanitized deprecation message, then call `/api/auth/clusters` and confirm it returns only:

```json
{
  "success": true,
  "clusters": [{ "id": "default", "label": "Default" }],
  "defaultClusterId": "default"
}
```

Verify no log line or response includes the legacy host, username, or password. Stop the process after the smoke test.

- [ ] **Step 4: Verify registry precedence**

Start with a one-entry registry plus deliberately invalid legacy host/user values. Confirm `/api/auth/clusters` exposes only the registry ID/label and login attempts target the registry host, not the legacy host.

## Plan Self-Review

- **Spec coverage:** Task 1 implements one canonical effective registry, legacy translation, precedence, sanitized once-per-process warning, and explicit config APIs. Task 2 pins new sessions and removes implicit runtime resolution. Task 3 protects the public cluster list and cache/cluster-name isolation. Task 4 updates all listed examples and migration docs. Task 5 verifies both canonical and temporary legacy behavior.
- **Placeholder scan:** No deferred implementation placeholders; implementation snippets, test cases, paths, commands, and expected outcomes are included.
- **Type consistency:** All downstream tasks consume `getLensConfig(clusterId: string)`, `getUserConfig(clusterId, credentials)`, and explicit `createClient(config)`. New sessions persist `clusterId: string`; unpinned old sessions are rejected.
