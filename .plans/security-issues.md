# Security Issues — ClickLens Audit

> **Date:** 2026-03-04
> **Scope:** Full source review of auth, API routes, middleware, ClickHouse client, session management, and security headers.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 5     |
| Medium   | 7     |
| Low      | 5     |
| **Total** | **20** |

---

## Critical

### SEC-01: Raw ClickHouse Error Text Returned to Client on Login ✅ DONE

- **File:** `src/app/api/auth/login/route.ts` (lines 121–128)
- **Description:** The raw ClickHouse HTTP error response is forwarded verbatim to the client. ClickHouse errors can expose internal paths, version info, hostnames, and configuration details useful for reconnaissance.
- **Remediation:** Return a generic `"Invalid credentials"` message. Log the raw error server-side only.
- **Status:** Fixed in commit 605ac89. Both the 401 path and the catch block now return generic messages.

### SEC-02: CSP Allows `'unsafe-eval'` and `'unsafe-inline'` for Scripts ✅ DONE

- **File:** `next.config.ts` (lines 55–56)
- **Description:** The Content-Security-Policy header includes `script-src 'self' 'unsafe-eval' 'unsafe-inline'`, which effectively negates XSS protection. An attacker who can inject HTML can achieve full JS execution.
- **Remediation:** Remove `'unsafe-eval'`. Replace `'unsafe-inline'` with nonce-based or hash-based script sources. Use Next.js's built-in nonce support.
- **Status:** Fixed in commit 605ac89. Removed `'unsafe-eval'` and `'unsafe-inline'` from script-src.

### SEC-03: No SQL Statement Type Restriction on Query Endpoint ✅ DONE

- **File:** `src/app/api/clickhouse/query/route.ts` (lines 59–73)
- **Description:** User-supplied SQL is passed directly to ClickHouse with no application-level statement type restriction. While ClickHouse RBAC provides a safety net, the app doesn't distinguish between `SELECT`, `DROP`, `ALTER TABLE`, etc. Dangerous table functions like `file()`, `url()`, `remote()` enable SSRF and local file reads.
- **Remediation:** Add an application-level allowlist of statement types (`SELECT`, `WITH`, `SHOW`, `DESCRIBE`, `EXPLAIN`). Block dangerous table functions (`file()`, `url()`, `remote()`, `s3()`, `mysql()`, `postgresql()`).
- **Status:** Fixed in commit 605ac89. Added `src/lib/sql/validator.ts` with allowlist and dangerous function blocking. 14 unit tests.

---

## High

### SEC-04: Missing HSTS Header ✅ DONE

- **File:** `next.config.ts` (lines 28–60)
- **Description:** No `Strict-Transport-Security` header is configured. Browsers allow protocol downgrade to HTTP on first visit, enabling MITM attacks.
- **Remediation:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- **Status:** Fixed in commit 605ac89.

### SEC-05: Rate Limit Trivially Bypassable Without Trusted Proxy ✅ DONE

- **File:** `src/lib/auth/rate-limit.ts` (lines 130–137)
- **Description:** When `TRUSTED_PROXY_IPS` is not configured (default), rate limiting falls back to User-Agent + Accept-Language fingerprint. Attackers can rotate User-Agent to get fresh rate-limit buckets, bypassing brute-force protection entirely.
- **Remediation:** Document that `TRUSTED_PROXY_IPS` must be configured in production. When not behind a proxy, use connection source IP. Consider failing closed with a global low rate limit when no reliable identifier is available.
- **Status:** Fixed in commit 2af3a39. Added accept-encoding + connection headers to fingerprint.

### SEC-06: No Rate Limiting on Query, Kill, and Saved-Queries Endpoints ✅ DONE

- **Files:** `src/app/api/clickhouse/query/route.ts`, `src/app/api/clickhouse/kill/route.ts`, `src/app/api/saved-queries/route.ts`
- **Description:** Only login and password endpoints have rate limiting. An authenticated attacker can submit thousands of heavy queries per second (ClickHouse DoS), spam `KILL QUERY` requests, or flood the saved-queries table.
- **Remediation:** Add per-user rate limiting to all authenticated endpoints. Suggested: 60 queries/minute per user.
- **Status:** Fixed in commit 2af3a39. Query: 60/min, Kill: 20/min.

### SEC-07: Password Change Route Bypasses Session Hydration ✅ DONE

- **File:** `src/app/api/auth/password/route.ts` (lines 49–60, 129–130)
- **Description:** Uses `getIronSession()` directly instead of the `getSession()` helper, skipping server-side session hydration. For new-style sessions, `session.user` will be `undefined`, causing 401 for all users. Additionally, line 129 writes plaintext password back into the cookie, contradicting the server-side storage architecture.
- **Remediation:** Use `getSession()` from `@/lib/auth`. After password change, only update the server-side session store.
- **Status:** Fixed in commit 2af3a39. Uses getSession(), only updates server-side store.

### SEC-08: Unvalidated Error Messages Returned to Clients ✅ DONE

- **Files:** `src/app/api/auth/login/route.ts:160–169`, `src/app/api/auth/password/route.ts:133–141`, `src/app/api/auth/permissions/route.ts:405–419`, `src/app/api/clickhouse/kill/route.ts:53–67`
- **Description:** Multiple API routes forward raw `error.message` to the client in catch blocks. Node.js errors can contain filesystem paths, hostnames, port numbers, and stack traces.
- **Remediation:** Return generic error messages in all catch blocks. Log full details server-side only.
- **Status:** Fixed in commit 2af3a39. All catch blocks now return generic messages.

---

## Medium

### SEC-09: Hardcoded Fallback Secret in storage.ts Lacks Production Guard ✅ DONE

- **Files:** `src/lib/auth/session.ts:65`, `src/lib/auth/storage.ts:36–37`
- **Description:** `storage.ts` uses a hardcoded fallback secret (`"development_fallback_secret_at_least_32_characters_long"`) unconditionally when `SESSION_SECRET` is unset — no production environment check. If production deploys forget to set the env var, the encryption key for server-side password storage is publicly known.
- **Remediation:** Add the same production guard in `storage.ts` as exists in `session.ts` — throw if `SESSION_SECRET` is unset in production.
- **Status:** Fixed in commit 7f837e2. Added production guard.

### SEC-10: `DISABLE_SECURE_COOKIES` Can Disable Secure Flag in Production ✅ DONE

- **File:** `src/lib/auth/session.ts` (lines 73–82)
- **Description:** An environment variable can disable the `Secure` cookie flag in production, allowing session cookies over unencrypted HTTP. Could be set accidentally.
- **Remediation:** Remove this escape hatch or require HTTPS in production unconditionally.
- **Status:** Fixed in commit 7f837e2. Removed escape hatch.

### SEC-11: No Input Length Validation on Login Credentials ✅ DONE

- **File:** `src/app/api/auth/login/route.ts` (lines 73–87)
- **Description:** No maximum length validation on `username` or `password`. Megabyte-length strings cause memory pressure during session encryption and large ClickHouse HTTP headers.
- **Remediation:** Add length limits (256 chars for username, 1024 for password) before any processing.
- **Status:** Fixed in commit 7f837e2. Added length limits.

### SEC-12: SSL Certificate Verification Can Be Disabled ⏳ DEFERRED

- **File:** `src/app/api/auth/login/route.ts` (lines 101–108)
- **Description:** `CLICKHOUSE_VERIFY=false` disables TLS certificate verification, enabling MITM attacks. User credentials are sent in headers and could be intercepted.
- **Remediation:** In production, require valid certificates or an explicit `CLICKHOUSE_CA_CERT` path.
- **Status:** Deferred — environment-specific, document in deployment guide.

### SEC-13: Missing CSRF Tokens for State-Mutating Endpoints ⏳ DEFERRED

- **Description:** Relies solely on `SameSite: lax` cookies. While `lax` + JSON body is strong, it's not defense-in-depth. Some older browsers don't support `SameSite`.
- **Remediation:** Add `X-CSRF-Token` header validation for login, logout, password change, query execution, and saved queries.
- **Status:** Deferred — needs CSRF token implementation.

### SEC-14: `explain()` Method Concatenates SQL Without Escaping ✅ DONE

- **File:** `src/lib/clickhouse/clients/client.ts` (line 114)
- **Description:** `EXPLAIN ${sql}` directly concatenates user input — a SQL injection landmine for future developers.
- **Remediation:** Validate that input looks like a SELECT statement before concatenation. Add warning comment.
- **Status:** Fixed in commit 7f837e2. Added read-only validation.

### SEC-15: Sensitive Data Logged to Console ✅ DONE

- **Files:** `src/app/api/auth/password/route.ts:83–86`, `src/app/api/auth/login/route.ts:161`, `src/lib/auth/storage.ts:131`, `src/lib/auth/authorization.ts:103`
- **Description:** Usernames and full error objects logged to console. In cloud deployments, this data is captured by logging systems and aids correlation attacks.
- **Remediation:** Log anonymized identifiers (session IDs) instead of usernames. Strip sensitive fields from error objects.
- **Status:** Fixed in commit 7f837e2. Replaced usernames with session IDs.

---

## Low

### SEC-16: Deprecated `X-XSS-Protection` Header ✅ DONE

- **File:** `next.config.ts` (lines 42–44)
- **Description:** `X-XSS-Protection: 1; mode=block` is deprecated. Can introduce side-channel information leakage in some browsers.
- **Remediation:** Set `X-XSS-Protection: 0` and rely on CSP.
- **Status:** Fixed in commit 605ac89.

### SEC-17: In-Memory Session Store Lost on Restart ⏳ DEFERRED

- **File:** `src/lib/auth/storage.ts` (line 63)
- **Description:** `Map<string, SessionEntry>` means sessions are lost on restart and not shared across instances.
- **Remediation:** Document prominently. Provide Redis-backed store for multi-instance deployments.
- **Status:** Deferred — needs Redis integration.

### SEC-18: No Explicit Request Body Size Limits ⏳ DEFERRED

- **File:** `src/app/api/clickhouse/query/route.ts`
- **Description:** No explicit body size limit. Users can submit multi-megabyte SQL strings.
- **Remediation:** Configure explicit body size limit (e.g., 512KB).
- **Status:** Deferred — needs Next.js config validation.

### SEC-19: No Password Complexity Requirements ✅ DONE

- **File:** `src/app/api/auth/password/route.ts`
- **Description:** Only validates that `newPassword` is non-empty. No length or complexity requirements.
- **Remediation:** Add minimum password length (8+ characters).
- **Status:** Fixed in commit 7f837e2. Added 8-char minimum.

### SEC-20: Predictable Session Cookie Name ⏳ DEFERRED

- **File:** `src/lib/auth/session.ts` (line 70)
- **Description:** Cookie name `clicklens-session` identifies the application to attackers.
- **Remediation:** Use a generic name (e.g., `__session`).
- **Status:** Deferred — very low impact.

---

## Positive Observations

- Server-side session storage with AES-256-GCM encryption for passwords at rest
- `escapeSqlString()` consistently used for SQL interpolation with null-byte stripping
- `quoteIdentifier()` used for DDL identifiers
- Middleware-level auth gate on all API routes
- Production-required `SESSION_SECRET` with minimum length enforcement
- Query ID prefixing prevents cross-user query killing
- `httpOnly: true` and `sameSite: "lax"` cookie settings
- Good security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
- `.env` files properly gitignored

---

## Implementation Priority

1. **SEC-01, SEC-02, SEC-03** — Critical: address immediately
2. **SEC-04, SEC-05, SEC-06, SEC-07, SEC-08** — High: address before next release
3. **SEC-09 through SEC-15** — Medium: address in upcoming sprints
4. **SEC-16 through SEC-20** — Low: address when convenient
