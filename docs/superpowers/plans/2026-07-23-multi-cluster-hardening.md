# Multi-Cluster Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authenticated ClickHouse operation, cache, and ClickHouse-cluster-name lookup resolve against the session-pinned ClickHouse cluster without leaking data or falling back to legacy configuration.

**Architecture:** Keep `CLICKHOUSE_CLUSTERS` as the single registry. Resolve a registered ID (including `"default"`) before legacy environment variables. Treat `ClickHouseConfig.clusterId` as the cache/isolation key and pass it through every cluster-name lookup. Keep the standalone compose file a local demo, but avoid committed credentials and document its fresh-volume requirement.

**Tech Stack:** Next.js 16 route handlers/proxy, TypeScript, Bun test, ClickHouse Docker image, iron-session.

## Global Constraints

- Preserve legacy `CLICKHOUSE_HOST` / `LENS_USER` behavior.
- Never expose cluster hosts, ports, lens usernames, or passwords from `/api/auth/clusters`.
- Do not add dependencies.
- Keep user-provided login credentials separate from lens/service credentials.
- Use `config.clusterId` for shared-cache isolation; do not key by a ClickHouse-internal cluster name.
- Do not commit non-demo secrets or production-safe cookie settings as defaults.

---

## Files and Responsibilities

- `src/lib/clickhouse/config.ts`: registry parsing and registered-versus-legacy resolution.
- `src/lib/clickhouse/config.test.ts`: registry precedence and error-sanitization tests.
- `src/lib/clickhouse/cluster.ts`: per-configured-cluster ClickHouse cluster-name detection cache.
- `src/lib/clickhouse/cluster.test.ts`: cache separation and override tests.
- `src/lib/auth/index.ts`: session-pinned user/lens configuration helpers.
- `src/app/api/auth/password/route.ts`: password verification and `ON CLUSTER` resolution using the session cluster.
- `src/app/api/clickhouse/schema/columns/route.ts`: session-pinned autocomplete connection.
- `src/app/api/clickhouse/**/route.ts`: cluster-scoped cache keys and `getClusterName` callers.
- `src/proxy.ts`: public login bootstrap endpoints only.
- `docker-compose.multi-cluster.yml`, `dev/multi-cluster/*.sh`, `env.sample`: safe, reproducible local multi-cluster demo configuration.

### Task 1: Fix registered `default` resolution and configuration errors

**Files:**

- Modify: `src/lib/clickhouse/config.ts:47-300`
- Modify: `src/lib/clickhouse/config.test.ts`
- Modify: `src/app/api/auth/clusters/route.ts`

**Consumes:** `ClusterDefinition`, `parseClusterRegistry()`, `getLensConfig()`, `getUserConfig()`.

**Produces:** `getLensConfig(clusterId)` and `getUserConfig(clusterId, credentials)` resolve _any_ registry ID first, including `"default"`; legacy config is only used when the ID is not a registry member and is exactly the implicit legacy default.

- [ ] **Step 1: Write failing registry-default and sanitized-error tests**

```ts
it("resolves an explicit default registry entry without legacy variables", () => {
  process.env.CLICKHOUSE_CLUSTERS = JSON.stringify([
    {
      id: "default",
      label: "Primary",
      host: "primary",
      port: 8123,
      lensUser: "lens",
      lensPassword: "secret",
    },
  ]);

  expect(getLensConfig("default")).toMatchObject({
    host: "primary",
    username: "lens",
    clusterId: "default",
  });
  expect(
    getUserConfig("default", { username: "alice", password: "pw" }),
  ).toMatchObject({ host: "primary", username: "alice", clusterId: "default" });
});

it("does not include registry secrets in parse errors", () => {
  process.env.CLICKHOUSE_CLUSTERS = "not-json-secret";
  expect(() => parseClusterRegistry()).toThrow(
    "CLICKHOUSE_CLUSTERS is not valid JSON",
  );
  expect(() => parseClusterRegistry()).not.toThrow("not-json-secret");
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `bun test src/lib/clickhouse/config.test.ts --filter "default registry|does not include registry secrets"`

Expected: the default-registry test fails because config resolution falls through to legacy env; the error test fails because the raw env value is interpolated.

- [ ] **Step 3: Resolve registry entries before legacy fallback**

```ts
function getRegisteredCluster(
  clusterId: string,
): ClusterDefinition | undefined {
  return parseClusterRegistry().get(clusterId);
}

export function getLensConfig(clusterId?: string): ClickHouseConfig | null {
  const def = clusterId ? getRegisteredCluster(clusterId) : undefined;
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
  // Only no ID or the implicit legacy default reaches this existing legacy block.
  // ... existing CLICKHOUSE_HOST/LENS_USER resolution
}
```

Use the same `def`-first branch in `getUserConfig`. Replace thrown messages that include `json`/`JSON.stringify(entry)` with messages that identify only the invalid field or array index.

- [ ] **Step 4: Keep the public route public but return a controlled configuration error**

```ts
export async function GET() {
  try {
    const clusters = getConfiguredClusters();
    return NextResponse.json({
      success: true,
      clusters,
      defaultClusterId: clusters[0]?.id ?? null,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Cluster configuration is invalid" },
      { status: 500 },
    );
  }
}
```

This route remains listed in `PUBLIC_ROUTES`; its error response must not contain registry contents.

- [ ] **Step 5: Run tests and commit**

Run: `bun test src/lib/clickhouse/config.test.ts --timeout 15000`

Expected: PASS.

```bash
git add src/lib/clickhouse/config.ts src/lib/clickhouse/config.test.ts src/app/api/auth/clusters/route.ts
git commit -m "fix: resolve registered default clusters before legacy config"
```

### Task 2: Make remaining session-authenticated routes cluster-aware

**Files:**

- Modify: `src/app/api/auth/password/route.ts:1-125`
- Modify: `src/app/api/clickhouse/schema/columns/route.ts:9-95`
- Test: `src/lib/auth/index.test.ts` (create if no suitable auth helper test exists)

**Consumes:** `getSessionClickHouseConfig()`, `getSessionLensConfig()`, hydrated `session.user.clusterId`.

**Produces:** Password verification and schema autocomplete always connect to the session's selected cluster.

- [ ] **Step 1: Add failing helper-level tests for session cluster selection**

Mock a hydrated session with `clusterId: "beta"` and registry entries `alpha`/`beta`; assert the config helper selects beta rather than requiring `CLICKHOUSE_HOST`.

```ts
expect(await getSessionClickHouseConfig()).toMatchObject({
  host: "beta-host",
  clusterId: "beta",
  username: "alice",
});
```

- [ ] **Step 2: Run the test to verify failure in legacy callers**

Run: `bun test src/lib/auth/index.test.ts --filter "selected cluster"`

Expected: PASS for the helper if already covered; route code inspection still shows direct legacy `getUserConfig({...})` calls that this task removes.

- [ ] **Step 3: Use session helpers in both routes**

In password verification replace:

```ts
const userUserConfig = getUserConfig({
  username: session.user.username,
  password: currentPassword,
});
```

with:

```ts
const userUserConfig = session.user.clusterId
  ? getUserConfig(session.user.clusterId, {
      username: session.user.username,
      password: currentPassword,
    })
  : getUserConfig({
      username: session.user.username,
      password: currentPassword,
    });
```

For the lens operation pass the pinned ID:

```ts
const clusterName = await getClusterName(adminClient, adminConfig.clusterId);
```

In schema columns, replace the direct `getUserConfig` call with:

```ts
const config = await getSessionClickHouseConfig();
```

and remove unused imports.

- [ ] **Step 4: Run TypeScript and relevant auth tests**

Run: `npx tsc --noEmit && bun test src/lib/auth/ --timeout 15000`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/password/route.ts src/app/api/clickhouse/schema/columns/route.ts src/lib/auth/index.test.ts
git commit -m "fix: bind password and schema routes to session cluster"
```

### Task 3: Complete cache isolation

**Files:**

- Modify: `src/app/api/clickhouse/tables/explorer/{dependencies,merges,mutations,parts,replicas}/route.ts`
- Modify: `src/app/api/clickhouse/monitoring/{dashboard,metrics,overview}/route.ts`
- Modify: any remaining route found by `rg 'getOrSet\(' src/app/api/clickhouse`
- Test: co-located route tests or a focused `src/lib/cache` key test.

**Consumes:** each route's session-derived `config.clusterId`.

**Produces:** every shared cache key starts with a non-empty stable cluster scope.

- [ ] **Step 1: Inventory all shared cache keys before editing**

Run:

```bash
rg -n -C 3 'getOrSet\(|tablesCache\.|queryCache\.' src/app/api/clickhouse
```

For each key, identify the route's resolved `config.clusterId`. Do not alter process-local caches that only hold per-request values.

- [ ] **Step 2: Write a failing collision test**

```ts
it("does not share explorer cache entries across clusters", async () => {
  const alphaKey = `table-explorer:alpha:default:events:parts`;
  const betaKey = `table-explorer:beta:default:events:parts`;
  expect(alphaKey).not.toBe(betaKey);
});
```

Prefer extracting one small pure key-builder only if at least three routes can use it; otherwise prefix each existing key inline to avoid a speculative abstraction.

- [ ] **Step 3: Prefix all shared cache keys**

Use the same shape in every route:

```ts
const cacheScope = config.clusterId ?? "legacy";
const cacheKey = `table-explorer:${cacheScope}:${database}:${table}:parts`;
```

For monitoring:

```ts
const cacheKey = `monitoring:${config.clusterId ?? "legacy"}:metrics`;
```

Do not use `getClusterName()` as the isolation key: unrelated configured endpoints can report the same ClickHouse cluster name.

- [ ] **Step 4: Run focused cache and route tests**

Run: `bun test src/lib/cache/ src/app/api/clickhouse/ --timeout 15000`

Expected: PASS. Add tests to any modified route that already has a co-located test; otherwise keep the collision test in the cache test suite.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/clickhouse src/lib/cache
git commit -m "fix: scope metadata and monitoring caches by configured cluster"
```

### Task 4: Make ClickHouse cluster-name detection per configured endpoint

**Files:**

- Modify: `src/lib/clickhouse/config.ts`
- Modify: `src/lib/clickhouse/cluster.ts`
- Modify: all `getClusterName(client)` callers listed by `rg -n 'getClusterName\(' src`
- Modify: `src/lib/clickhouse/cluster.test.ts`

**Consumes:** `ClickHouseConfig.clusterId`; optional registry `clickhouseCluster` value.

**Produces:** cluster-name caching and overrides cannot cross configured ClickHouse endpoints.

- [ ] **Step 1: Add tests for independent cache entries and overrides**

```ts
it("caches detected names separately for alpha and beta", async () => {
  alpha.query.mockResolvedValueOnce({ data: [{ cluster: "alpha_ch" }] });
  beta.query.mockResolvedValueOnce({ data: [{ cluster: "beta_ch" }] });
  expect(await getClusterName(alpha, "alpha")).toBe("alpha_ch");
  expect(await getClusterName(beta, "beta")).toBe("beta_ch");
});
```

Also test that legacy `CLICKHOUSE_CLUSTER` only overrides the legacy/no-ID call.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/lib/clickhouse/cluster.test.ts --timeout 15000`

Expected: a cache separation test fails for callers that omit `clusterId`; legacy global override currently applies to every ID.

- [ ] **Step 3: Add an optional per-registry ClickHouse cluster name**

```ts
export interface ClusterDefinition {
  // existing fields
  clickhouseCluster?: string;
}
```

Parse `clickhouseCluster` only when it is a non-empty string. Change the detector signature to accept a `ClickHouseConfig`, not an unconnected ID:

```ts
export async function getClusterName(
  client: ClickHouseClient,
  config?: Pick<ClickHouseConfig, "clusterId">,
): Promise<string | undefined>;
```

Resolve per-registry override by `config?.clusterId`; use `CLICKHOUSE_CLUSTER` only when `clusterId` is absent (legacy mode). Cache by `config?.clusterId ?? "legacy"`.

- [ ] **Step 4: Update every caller mechanically and verify none remain**

```bash
rg -n 'getClusterName\(client\)|getClusterName\(adminClient\)' src
```

Replace with `getClusterName(client, config)` or `getClusterName(adminClient, adminConfig)`. For services that do not have config/session context, preserve the no-second-argument legacy call deliberately.

- [ ] **Step 5: Run tests and commit**

Run: `bun test src/lib/clickhouse/cluster.test.ts --timeout 15000 && npx tsc --noEmit`

Expected: PASS.

```bash
git add src/lib/clickhouse/config.ts src/lib/clickhouse/cluster.ts src/lib/clickhouse/cluster.test.ts src
git commit -m "fix: isolate ClickHouse cluster-name detection by endpoint"
```

### Task 5: Make the standalone compose demo reproducible without committed secrets

**Files:**

- Modify: `docker-compose.multi-cluster.yml`
- Modify: `docker-compose.yml`
- Modify: `env.sample`
- Modify: `dev/multi-cluster/init-alpha.sh`
- Modify: `dev/multi-cluster/init-beta.sh`
- Modify: `.gitignore` only if a new ignored local env example is required.

**Consumes:** `CLICKHOUSE_CLUSTERS` registry format.

**Produces:** a local-only demo that creates two independently authenticated servers from user-provided env values, with instructions for resetting first-run volumes.

- [ ] **Step 1: Replace committed credentials with required interpolation**

```yaml
environment:
  SESSION_SECRET: ${SESSION_SECRET:?set SESSION_SECRET in .env.local}
  CLICKHOUSE_CLUSTERS: ${CLICKHOUSE_CLUSTERS:?set CLICKHOUSE_CLUSTERS in .env.local}
```

Keep `DISABLE_SECURE_COOKIES=true` confined to the local demo compose and annotate it as localhost-only. Do not ship a known secret in either compose file.

- [ ] **Step 2: Keep each demo user distinct and grant only what ClickLens exercises**

Keep the init scripts separate and make their IDs/passwords come from environment variables or clearly documented local defaults that are not represented as production credentials. Include only the ClickHouse privileges ClickLens needs; do not use `GRANT ALL`.

- [ ] **Step 3: Document first-run semantics**

Add to `env.sample`:

```bash
# The ClickHouse image only runs init scripts on a new data volume.
# After changing demo users/passwords: docker compose -f docker-compose.multi-cluster.yml down -v
# Then: docker compose -f docker-compose.multi-cluster.yml up --build
```

Document the test accounts as local demo values only, with Alpha and Beta using different usernames/passwords.

- [ ] **Step 4: Validate compose interpolation and fresh start instructions**

Run:

```bash
docker compose -f docker-compose.multi-cluster.yml config >/dev/null
```

Expected: exit 0 with `.env.local` populated. Then, only if the developer approves destruction of local volumes:

```bash
docker compose -f docker-compose.multi-cluster.yml down -v
docker compose -f docker-compose.multi-cluster.yml up --build -d
```

Verify both credentials with `POST /api/auth/login` against `alpha` and `beta`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.multi-cluster.yml env.sample dev/multi-cluster .gitignore
git commit -m "chore: make multi-cluster demo credentials local-only"
```

### Task 6: End-to-end regression coverage and final review

**Files:**

- Modify: `src/lib/clickhouse/config.test.ts`
- Modify: `src/lib/clickhouse/cluster.test.ts`
- Modify/create: focused tests for session config and cache-key separation.

- [ ] **Step 1: Add regression cases for all reviewed failure modes**

Cover:

```ts
// registry ID "default" works without CLICKHOUSE_HOST
// alpha and beta user/lens configs choose distinct hosts
// malformed registry error contains no JSON/password
// per-cluster cluster-name cache never returns alpha name for beta
// same database/table cache keys differ for alpha and beta
// password and schema routes use the selected session cluster
```

- [ ] **Step 2: Run the complete project checks**

Run:

```bash
bun run test
npx tsc --noEmit
bun run lint
```

Expected: all commands exit 0. Record any known pre-existing failure separately; do not label it as introduced by this work.

- [ ] **Step 3: Review the final diff against master**

Run:

```bash
git diff --check master...HEAD
git diff --stat master...HEAD
```

Expected: no whitespace errors; all changes are covered by one of the tasks above.

- [ ] **Step 4: Commit tests only if they were not committed with their tasks**

```bash
git add src/lib/clickhouse/config.test.ts src/lib/clickhouse/cluster.test.ts src/lib/auth
git commit -m "test: cover multi-cluster isolation regressions"
```

## Review Findings Covered

- Registered ID `"default"` is advertised but currently falls into legacy-only resolution.
- Password-change and schema-column routes bypass the session-pinned config.
- Several explorer and monitoring cache keys omit `clusterId`.
- Most `getClusterName` callers omit the configured cluster ID; the global override applies across all endpoints.
- Parser errors can disclose registry passwords in logs; the public clusters route should return a controlled error.
- Demo compose currently commits service credentials and a known session secret; ClickHouse init scripts require a fresh volume to apply changes.
- Existing tests primarily cover parsing; they do not cover the above runtime isolation paths.
