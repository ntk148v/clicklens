# ClickLens Security Audit Report

**Date:** 2026-01-26  
**Auditor:** AI Security Analysis  
**Scope:** Full application security review

---

## Executive Summary

| Severity    | Count | Status          |
| ----------- | ----- | --------------- |
| 🔴 Critical | 0     | -               |
| 🟠 High     | 2     | Action Required |
| 🟡 Medium   | 4     | Recommended     |
| 🔵 Low      | 3     | Advisory        |

**Overall Assessment:** The application follows good security practices with iron-session authentication, role-based authorization, and ClickHouse-native permission enforcement. Key areas for improvement: rate limiting, security headers, and SQL query parameterization.

---

## Findings

### 🟠 HIGH-1: No Rate Limiting on Login Endpoint

**Location:** `src/app/api/auth/login/route.ts`

**Issue:** Login endpoint lacks rate limiting, enabling brute-force attacks.

**Recommendation:**

- Implement IP-based rate limiting (e.g., 5 attempts/minute)
- Add account lockout after N failed attempts
- Consider using middleware like `@upstash/ratelimit`

---

### 🟠 HIGH-2: Password Stored in Session

**Location:** `src/lib/auth/session.ts`

**Issue:** ClickHouse password stored in encrypted session cookie.

**Current Mitigation:** iron-session encrypts cookies with AES-256-GCM.

**Recommendation:**

- Consider token-based authentication with ClickHouse
- Document this design decision as acknowledged risk
- Note: Already documented at L7-9 as known limitation

---

### 🟡 MEDIUM-1: No Content Security Policy Headers

**Location:** `next.config.ts`

**Issue:** No CSP or security headers configured.

**Recommendation:** Add security headers in `next.config.ts`:

```typescript
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];
```

---

### 🟡 MEDIUM-2: SQL Injection Mitigation via String Escaping

**Location:** Multiple API routes

**Issue:** SQL injection mitigation relies on single-quote escaping rather than parameterized queries.

**Assessment:** While escaping prevents basic SQL injection, parameterized queries are preferred. ClickHouse permissions also limit damage from injection.

**Recommendation:**

- Create a utility function for consistent escaping
- Document escaping pattern in code guidelines

---

### 🟡 MEDIUM-3: Verbose Error Messages in Development

**Location:** API routes throughout `src/app/api/`

**Issue:** Error messages may leak implementation details.

**Recommendation:**

- Sanitize error messages in production
- Log detailed errors server-side
- Return generic messages to client

---

### 🟡 MEDIUM-4: SSL Certificate Verification Bypass Option

**Location:** `src/app/api/auth/login/route.ts`

**Issue:** `CLICKHOUSE_VERIFY=false` allows self-signed certificates, enabling MITM attacks.

**Assessment:** Necessary for development with self-signed certs.

**Recommendation:**

- Log warning when SSL verification is disabled
- Document security implications in README

---

### 🔵 LOW-1: CI/CD Test Credentials in Workflow

**Location:** `.github/workflows/base.yml`

**Issue:** Hardcoded test credentials in CI workflow.

**Assessment:** Acceptable for CI testing, but should not be used in production.

**Recommendation:** Add comment clarifying these are test-only values.

---

### 🔵 LOW-2: Session Cookie Secure Flag Escape Hatch

**Location:** `src/lib/auth/session.ts`

**Issue:** `DISABLE_SECURE_COOKIES` bypasses HTTPS requirement.

**Recommendation:** Log warning when this is enabled.

---

### 🔵 LOW-3: Docker Image Uses Latest Tag for Builder

**Location:** `Dockerfile`

**Issue:** `oven/bun:latest` may introduce breaking changes.

**Recommendation:** Pin to specific version, e.g., `oven/bun:1.0.0`.

---

## Positive Findings ✅

| Area                   | Finding                                                       |
| ---------------------- | ------------------------------------------------------------- |
| **Session Management** | iron-session with AES-256-GCM encryption                      |
| **Cookie Security**    | `httpOnly: true`, `sameSite: lax`, secure in production       |
| **Session Secret**     | 32+ char requirement enforced in production                   |
| **Authorization**      | Permission checks via `checkPermission()` on sensitive routes |
| **RBAC**               | Feature roles with ClickHouse-native enforcement              |
| **Docker**             | Non-root user `nextjs:1001`, multi-stage build                |
| **Telemetry**          | Next.js telemetry disabled                                    |
| **Auth on Routes**     | All 41 API routes check authentication                        |

---

## Recommendations Priority

| Priority | Action                                      | Effort |
| -------- | ------------------------------------------- | ------ |
| P1       | Add rate limiting to login                  | Medium |
| P2       | Add security headers (CSP, X-Frame-Options) | Low    |
| P3       | Create SQL escaping utility function        | Low    |
| P4       | Pin Docker base image versions              | Low    |
| P5       | Add production error sanitization           | Medium |
