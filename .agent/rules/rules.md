---
trigger: always_on
glob:
description:
---

Below is a **practical, opinionated ruleset** you can use as **Antigravity / Cursor rules** (or a general AI coding constitution) for developing **Next.js with Bun**. The rules are written to guide both humans and AI assistants toward consistent, production-grade output.

---

## 1. Runtime and Tooling Rules

1. **Bun is the primary runtime**

   - Use `bun` for package management, scripts, and execution.
   - Do not introduce `npm`, `yarn`, or `pnpm` unless explicitly required.
   - Use `bun.lockb` as the single source of dependency truth.
   - Run `bun lint` and `bun run build` after change to validate.

2. **Node compatibility awareness**

   - Assume Bun implements Node APIs but verify edge cases (e.g., `fs`, `crypto`, streams).
   - Avoid undocumented Node internals.

3. **Scripts**

   - All scripts must be runnable via `bun run <script>`.
   - Prefer Bun-native tools (e.g., `bun test`) where stable.

---

## 2. Next.js Architecture Rules

1. **App Router only**

   - Use `/app` directory exclusively.
   - Do not create or modify `/pages`.

2. **Server-first mindset**

   - Default to **Server Components**.
   - Add `"use client"` only when required (state, effects, browser APIs).

3. **Colocation**

   - Route-specific components, hooks, and styles must live under their route segment.
   - Shared logic belongs in `/components`, `/lib`, or `/hooks`.

4. **No implicit behavior**

   - Explicitly define:

     - `dynamic`, `revalidate`, `fetchCache` when relevant
     - Metadata via `generateMetadata`

---

## 3. TypeScript Rules

1. **Strict mode always on**

   - No `any` without justification.
   - Prefer `unknown` with narrowing.

2. **Types over interfaces**

   - Use `type` unless extension is required.

3. **Server/client boundaries**

   - Never import server-only modules into client components.
   - Enforce with clear folder naming and comments if needed.

4. **Zod for runtime validation**

   - Validate external inputs (env, request bodies, search params).

---

## 4. Data Fetching and Side Effects

1. **Use the Next.js fetch layer**

   - Prefer `fetch()` with caching semantics over custom clients.
   - Document cache behavior inline.

2. **No data fetching in client components unless unavoidable**

   - If unavoidable, explain why in a comment.

3. **Async boundaries**

   - Use `Suspense` intentionally.
   - Avoid waterfall fetching.

---

## 5. Styling Rules

1. **Single styling strategy**

   - Choose one (e.g., Tailwind, CSS Modules).
   - Do not mix paradigms without explicit reason.

2. **No global leakage**

   - Global styles only in `app/globals.css`.

---

## 6. Performance Rules

1. **Bundle discipline**

   - Avoid large client dependencies.
   - Dynamically import non-critical client code.

2. **Images and fonts**

   - Always use `next/image` and `next/font`.

3. **No premature optimization**

   - Optimize only when measurable.

---

## 7. Security Rules

1. **Environment variables**

   - Access only via validated helpers.
   - Never expose secrets to client components.

2. **User input**

   - Treat all user input as untrusted.
   - Validate and sanitize before use.

3. **Auth boundaries**

   - Auth logic must run on the server.
   - Client components may only consume derived state.

---

## 8. Testing Rules (with Bun)

1. **Unit tests**

   - Use `bun test` for pure logic.
   - Test utilities in isolation.

2. **No framework mocking unless necessary**

   - Prefer integration-style tests for routes and actions.

---

## 9. Code Quality and Maintainability

1. **Explain non-obvious decisions**

   - Use comments for _why_, not _what_.

2. **Small, composable functions**

   - One responsibility per function.

3. **No dead code**

   - Remove unused exports, types, and components immediately.

---

## 10. Cursor / AI Assistant Behavior Rules

1. **Do not guess**

   - Ask for clarification if requirements are ambiguous.

2. **Prefer minimal diffs**

   - Modify only what is necessary.

3. **Respect existing patterns**

   - Follow the project’s established structure and conventions.

4. **Production bias**

   - All generated code should be production-ready, typed, and documented where necessary.

---

If you want, I can:

- Convert this into a **`.cursor/rules.md`** file
- Adapt it to **Edge Runtime** or **Server Actions–heavy** projects
- Add **team-enforcement rules** (linting, CI, PR standards)

State your preference.
