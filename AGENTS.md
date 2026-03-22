# AGENTS.md - Codebase Guidelines for ClickLens

This file contains build, test, lint commands and coding standards for the ClickLens project. It serves as the authoritative reference for all agentic coding agents working in this repository.

---

## Build, Lint, and Test Commands

### Development & Production

```bash
bun run dev              # Start Next.js dev server (http://localhost:3000)
bun run build           # Build for production (.next/standalone)
bun run start           # Start production server
```

### Code Quality

```bash
bun run lint            # Run ESLint (Next.js + TypeScript rules)
bun run lint --fix      # Auto-fix linting issues
```

### Unit Tests (Bun Test)

```bash
bun run test                    # Run all tests in src/
bun run test src/path/to/file.test.ts  # Single test file
bun run test --filter "pattern"        # Filter by test name
bun run test:coverage             # With coverage report
```

Test files: `.test.ts`/`.test.tsx`, co-located with source.

### End-to-End Tests (Playwright)

```bash
bun run test:e2e       # Run all E2E tests (chromium, firefox, webkit)
bun run test:e2e:ui    # Playwright UI mode
```

### Pre-commit Hooks

- Husky + lint-staged: auto-lint `*.{ts,tsx,js,jsx}`, test `*.test.{ts,tsx}` on commit

---

## Code Style Guidelines

### TypeScript

- **Strict mode** enabled (`strict: true`)
- **Target**: ES2017, **Module**: ESNext with bundler resolution
- **Path alias**: `@/*` → `./src/*`
- **Exclude**: `**/*.test.ts`, `**/*.spec.ts`, `src/test-setup.ts`

### Imports (ES Modules Only)

Order (top to bottom, alphabetize within groups):

1. External packages
2. Next.js core (`next/server`, etc.)
3. Internal libs (`@/lib/...`)
4. UI components (`@/components/...`)
5. Relative imports from same directory

**Example:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";
import { formatQueryError } from "@/lib/errors";
import { StatCard } from "@/components/shared/StatCard";
import { validateSqlStatement } from "./validator";
```

### Naming Conventions

| Element             | Convention       | Example                               |
| ------------------- | ---------------- | ------------------------------------- |
| Components          | PascalCase       | `StatCard.tsx`, `QueryBar`            |
| Functions/variables | camelCase        | `getSessionConfig`, `handleSubmit`    |
| Constants           | UPPER_SNAKE_CASE | `MAX_ROWS`, `QUERY_TIMEOUT_MS`        |
| Types/interfaces    | PascalCase       | `QueryResult`, `UserSession`          |
| Test files          | `name.test.ts`   | `route.test.ts`, `Component.test.tsx` |
| Directories         | kebab-case       | `clickhouse/`, `query-analytics/`     |

### React/Next.js Patterns

- **Default**: Server components (no `"use client"` directive)
- **Add `"use client"`** only when using: state (`useState`, `useEffect`), browser APIs (`window`), event handlers, React context
- **App Router**: `app/` with layouts/pages, API routes in `app/api/`, loading.tsx, error.tsx
- **Styling**: Tailwind CSS utility classes only. Use Radix UI primitives. No inline styles or CSS modules.
- **Semantic tokens**: `foreground`, `background`, `primary`, `border`, etc.

### API Routes (Next.js App Router)

**Standard pattern:**

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF/authentication
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    // 2. Authorization
    const authError = await checkPermission("canExecuteQueries");
    if (authError) return authError;

    // 3. Validation
    const body = await request.json();
    if (!body.sql) {
      return NextResponse.json(
        { success: false, error: formatHttpError(400) },
        { status: 400 },
      );
    }

    // 4. Main logic
    const result = await processQuery(body.sql);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // 5. Centralized error handling
    const formatted = formatQueryError(error, undefined, true);
    return NextResponse.json(
      { success: false, error: formatted },
      { status: 500 },
    );
  }
}
```

**Error response format:**

```typescript
{
  success: false;
  error: {
    code: number;           // HTTP status or error code
    type: string;           // "SYNTAX", "SCHEMA", "PERMISSION", etc.
    message: string;        // Technical (sanitized in prod)
    userMessage: string;    // User-friendly
    hint?: string;          // Optional help
  };
}
```

**Streaming:** Use NDJSON for large datasets (>1000 rows) with backpressure handling. Headers: `Content-Type: application/x-ndjson; charset=utf-8`.

### Error Handling

- Use `formatQueryError` from `@/lib/errors` for ClickHouse errors
- Categorizes errors: SYNTAX, SCHEMA, TYPE, PERMISSION, RESOURCE, FUNCTION, SYSTEM, NETWORK, UNKNOWN
- Sanitizes sensitive data in production (file paths, IPs, credentials, stack traces)
- Logs full details server-side for debugging
- Provides user-friendly messages and hints

### Testing Patterns

**Bun Test (unit):**

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock modules
const mockFn = mock();
mock.module("@/lib/module", () => ({ fn: mockFn }));

describe("Feature", () => {
  beforeEach(() => {
    mockFn.mockReset();
    mockFn.mockResolvedValue("default");
  });

  it("handles success", async () => {
    mockFn.mockResolvedValue("result");
    const result = await myFunction();
    expect(result).toBe("result");
  });

  it("handles error", async () => {
    mockFn.mockRejectedValue(new Error("fail"));
    await expect(myFunction()).rejects.toThrow("fail");
  });
});
```

**Testing Library (components):** Use `@testing-library/react` + `@testing-library/jest-dom`. Setup in `src/test-setup.ts`.

**Playwright (E2E):** Tests in `e2e/`, config in `playwright.config.ts`. Base URL `http://localhost:3000`, auto-starts dev server.

---

## Additional Standards

### TypeScript Types

- **Avoid `any`**. Use `unknown` or explicit types.
- **No `@ts-ignore`/`@ts-expect-error`** without justification.
- **Prefer interfaces** for object shapes (props, request/response bodies).
- **Be explicit** for public APIs, use inference for local variables.

### Security

- Never log sensitive data (passwords, tokens, PII) in production
- Sanitize user inputs before ClickHouse (`validateSqlStatement`)
- Enable CSRF protection for state-changing routes
- Rate limit expensive operations (auth, queries)
- Security headers pre-configured in `next.config.ts` (HSTS, CSP, X-Frame-Options, etc.)

### Performance

- Stream large result sets (>1000 rows) with NDJSON + backpressure
- Debounce/throttle user input handlers (search, autocomplete)
- Use `useMemo`/`useCallback` sparingly (only after profiling)
- Cache expensive operations (ClickHouse metadata, RBAC checks)

### Code Organization

- **Feature-based grouping**: `src/app/api/clickhouse/query/route.ts`, `src/lib/clickhouse/client.ts`
- **Avoid generic folders**: `src/services/`, `src/controllers/`
- **Single responsibility**: Split files >300 lines
- **Barrel exports**: `export * from "./module"` for public APIs

### Git Workflow

- **Branches**: `feature/description`, `fix/issue-name`, `refactor/area`
- **Commits**: Imperative mood. "Add query cache" not "Added query cache"
- **One logical change per commit**
- **Pre-commit**: Husky runs lint-staged automatically

---

## Tool Configuration

| Tool       | Config File                       |
| ---------- | --------------------------------- |
| TypeScript | `tsconfig.json`                   |
| ESLint     | `eslint.config.mjs` (flat config) |
| Next.js    | `next.config.ts`                  |
| Playwright | `playwright.config.ts`            |
| Husky      | `.husky/`                         |

---

## Environment Variables

See `env.sample`:

- `NEXT_PUBLIC_APP_URL` - Frontend URL
- `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT` - DB connection
- `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` - Auth
- `SESSION_SECRET` - Session encryption
- `REDIS_URL` - Optional cache/rate-limit

---

## Key Decisions (Summary)

1. **Bun** - test runner & package manager (fast, built-in)
2. **Next.js 16** - App Router, server components by default
3. **TypeScript strict** - enforced across codebase
4. **Tailwind CSS v4** - utility-first styling
5. **Radix UI** - accessible primitives
6. **ESLint + next-config** - core-web-vitals + TypeScript
7. **Playwright** - E2E (chromium, firefox, webkit)
8. **Bun test** - unit tests colocated with source
9. **Husky + lint-staged** - pre-commit quality gates
10. **Streaming (NDJSON)** - backpressure for large data
11. **Centralized errors** (`@/lib/errors`) - environment-aware sanitization
12. **Path alias** `@` → `src` - clean imports

---

## Quick Reference

**Single test:** `bun test src/app/api/clickhouse/query/route.test.ts`
**Filter tests:** `bun test --filter "should batch rows"`
**Fix linting:** `bun run lint --fix`
**Dev server:** `bun run dev` → http://localhost:3000
**Build:** `bun run build` → `.next/standalone/`

Follow these guidelines to ensure consistency, maintainability, and security across the codebase.
