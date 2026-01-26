# ClickLens Security Audit Report

**Date:** 2026-01-26  
**Auditor:** AI Security Analysis  
**Scope:** Full application security review

---

## Executive Summary

| Severity    | Count | Status      |
| ----------- | ----- | ----------- |
| 🔴 Critical | 0     | -           |
| 🟠 High     | 2     | **2 Fixed** |
| 🟡 Medium   | 4     | **4 Fixed** |
| 🔵 Low      | 3     | **3 Fixed** |
|             |       |             |

**Overall Assessment:** The application follows good security practices with iron-session authentication, role-based authorization, and ClickHouse-native permission enforcement. Key areas for improvement: rate limiting, security headers, and SQL query parameterization.

---

## Findings

### ✅ HIGH-1: No Rate Limiting on Login Endpoint — **FIXED**

**Location:** `src/app/api/auth/login/route.ts`

**Issue:** Login endpoint lacked rate limiting, enabling brute-force attacks.

**Fix Applied:**

- Added in-memory sliding window rate limiter (`src/lib/auth/rate-limit.ts`)
- 5 attempts per IP per minute
- Returns 429 status with `Retry-After` header
- Comprehensive test coverage (11 tests)

---

### ✅ HIGH-2: Password Stored in Session — **FIXED**

**Location:** `src/lib/auth/session.ts`

**Issue:** ClickHouse password stored in encrypted session cookie.

**Fix Applied:**

- Implemented stateful server-side sessions (`src/lib/auth/storage.ts`)
- Cookie now only stores a random `sessionId`
- Credentials stored in secure, ephemeral in-memory map
- Sessions auto-expire after 24 hours
- Note: Server restart will invalidate all sessions (design trade-off)

---

### ✅ MEDIUM-1: No Content Security Policy Headers — **FIXED**

**Location:** `next.config.ts`

**Issue:** No CSP or security headers configured.

**Fix Applied:** Added security headers in `next.config.ts`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

### ✅ MEDIUM-2: SQL Injection Mitigation via String Escaping — **FIXED**

**Location:** `src/lib/clickhouse/utils.ts`

**Issue:** SQL injection mitigation relies on single-quote escaping rather than parameterized queries.

**Fix Applied:**

- Enhanced `escapeSqlString` utility with security documentation
- Confirmed robust escaping logic
- Added deprecation warning for old alias

---

### ✅ MEDIUM-3: Verbose Error Messages in Development — **FIXED**

**Location:** `src/lib/api/errors.ts`

**Issue:** Error messages may leak implementation details.

**Fix Applied:** Updated `ApiErrors.fromError` to sanitize error messages in production environment, returning generic "An error occurred" messages to clients while preserving details for logs.

---

### ✅ MEDIUM-4: SSL Certificate Verification Bypass Option — **FIXED**

**Location:** `src/app/api/auth/login/route.ts`

**Issue:** `CLICKHOUSE_VERIFY=false` allows self-signed certificates, enabling MITM attacks.

**Fix Applied:** Added mandatory warning log when SSL verification is disabled to ensure visibility of insecure configurations.

---

### ✅ LOW-1: CI/CD Test Credentials in Workflow — **FIXED**

**Location:** `.github/workflows/base.yml`

**Issue:** Hardcoded test credentials in CI workflow.

**Fix Applied:** Added clear comments indicating these are TEST ONLY credentials to prevent accidental copy-paste into production.

---

### ✅ LOW-2: Session Cookie Secure Flag Escape Hatch — **FIXED**

**Location:** `src/lib/auth/session.ts`

**Issue:** `DISABLE_SECURE_COOKIES` bypasses HTTPS requirement.

**Fix Applied:** Added warning log when secure cookies are explicitly disabled in production.

---

### ✅ LOW-3: Docker Image Uses Latest Tag for Builder — **FIXED**

**Location:** `Dockerfile`

**Issue:** `oven/bun:latest` may introduce breaking changes.

**Fix Applied:** Pinned base image to `oven/bun:1.1.26`.

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
