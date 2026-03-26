# ClickLens Performance & UI Refactor

## TL;DR

> **Quick Summary**: Refactor ClickLens Discover and SQL Console pages to eliminate performance bottlenecks through virtualization, hybrid query execution, hybrid caching, and state management migration to Zustand.
>
> **Deliverables**:
> - Virtualized result tables using @tanstack/react-virtual
> - Hybrid query execution (stream data + parallel count/aggs)
> - Hybrid caching (in-memory LRU + Redis)
> - Approximate counts for histograms with exact count option
> - Zustand state management replacing hooks
> - Comprehensive test suite (TDD approach)
>
> **Estimated Effort**: XL (Large-scale refactor)
> **Parallel Execution**: YES - 6 waves with 5-8 tasks each
> **Critical Path**: Foundation → State migration → Virtualization → Query optimization → Caching → Integration

---

## Context

### Original Request
Improve performance and UI for ClickLens Discover and SQL Console pages. Queries hang or take excessive time. Both query execution and UI responsiveness are issues. User wants Telescope-like smooth UI experience but prefers to use ClickHouse SQL directly (no extra QL layer like FlyQL). Must maintain existing RBAC logic and optimize resource usage.

### Interview Summary

**Key Discussions**:
- **Virtualization**: @tanstack/react-virtual chosen (integrates with existing TanStack Table)
- **Query Strategy**: Hybrid approach - Stream data immediately, run count/aggs in parallel
- **Caching**: Hybrid Cache - In-memory LRU for session + Redis for cross-session
- **Count Queries**: Hybrid - Approximate (HLL) for histogram, exact only when explicitly requested
- **State Management**: Zustand chosen (better tooling, time-travel debugging, lighter than Redux)
- **Test Strategy**: TDD (RED-GREEN-REFACTOR cycle)

**Research Findings**:
- **ClickLens Current Issues**: No virtualization, inefficient count queries, streaming without limits, no query result caching
- **Telescope**: Request cancellation, client-side limits, time-range first filtering, NO virtual scrolling
- **ch-ui**: Streaming with NDJSON, virtual scrolling (34px row height), JSONCompact format, query guardrails
- **Kibana**: Query splitting (3 parallel requests), virtualization (9x gain), session-based cache, progressive loading

### Metis Review

**Identified Gaps (addressed in plan)**:
- **Performance Targets**: Added specific benchmarks (query time < 5s, render time < 100ms, 60fps scroll)
- **Scope Boundaries**: Explicit guardrails for RBAC, no QL layer, backward compatibility
- **Edge Cases**: Comprehensive handling for query cancellation, dynamic row heights, cache failures, state conflicts
- **Acceptance Criteria**: Performance, functional, compatibility, reliability, and migration criteria
- **Guardrails**: Performance regression prevention, backward compatibility, security preservation, incremental deployment

---

## Work Objectives

### Core Objective
Eliminate performance bottlenecks in Discover and SQL Console pages by implementing virtualization, hybrid query execution, hybrid caching, and modern state management while maintaining RBAC and backward compatibility.

### Concrete Deliverables
- Virtualized ResultGrid and DiscoverGrid components
- Hybrid query execution with streaming + parallel count/aggs
- Hybrid caching layer (in-memory LRU + Redis)
- Approximate count queries with exact count option
- Zustand stores for Discover and SQL Console state
- Comprehensive test suite with >80% coverage
- Performance benchmarks and regression tests

### Definition of Done
- [ ] All performance targets met (query time < 5s, render time < 100ms, 60fps scroll)
- [ ] All existing functionality preserved (backward compatibility)
- [ ] RBAC rules still apply to all queries
- [ ] Test coverage > 80% for new code
- [ ] Zero memory leaks after 1000+ queries
- [ ] Cache hit rate > 30% for repeated queries
- [ ] Deployment supports incremental rollout with rollback

### Must Have
- Virtualization for result tables (vertical only, fixed row height)
- Hybrid query execution (stream data + parallel count/aggs)
- Hybrid caching (in-memory LRU + Redis)
- Approximate counts for histograms
- Exact count option available
- Zustand state management for query-related state
- TDD approach with comprehensive tests
- RBAC preservation
- Backward compatibility

### Must NOT Have (Guardrails)
- **NO extra QL layer** - Use ClickHouse SQL directly
- **NO breaking changes** to existing API contracts
- **NO removal of features** without explicit user approval
- **NO experimental/unstable APIs**
- **NO caching of sensitive data** (PII, credentials)
- **NO increase in initial page load time** beyond current baseline
- **NO memory leaks** in virtualization
- **NO deployment without performance benchmarks**

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: YES (bun test, existing test setup)
- **Automated tests**: YES (TDD)
- **Framework**: bun test
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: Use interactive_bash (tmux) — Run command, send keystrokes, validate output
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Use Bash (bun/node REPL) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.
> Each wave completes before the next begins.
> Target: 5-8 tasks per wave. Fewer than 3 per wave (except final) = under-splitting.

```
Wave 1 (Start Immediately — foundation + testing infrastructure):
├── Task 1: Performance baseline measurement [quick]
├── Task 2: Test infrastructure setup [quick]
├── Task 3: Zustand installation + configuration [quick]
├── Task 4: @tanstack/react-virtual installation + configuration [quick]
├── Task 5: Hybrid cache infrastructure (in-memory LRU) [quick]
├── Task 6: Hybrid cache infrastructure (Redis integration) [quick]
└── Task 7: Type definitions for new architecture [quick]

Wave 2 (After Wave 1 — state management migration, MAX PARALLEL):
├── Task 8: Discover Zustand store - query state [deep]
├── Task 9: Discover Zustand store - data state [deep]
├── Task 10: Discover Zustand store - UI state [quick]
├── Task 11: SQL Console Zustand store - query state [deep]
├── Task 12: SQL Console Zustand store - data state [deep]
├── Task 13: SQL Console Zustand store - UI state [quick]
└── Task 14: State migration utilities (hooks → Zustand) [unspecified-high]

Wave 3 (After Wave 2 — virtualization implementation, MAX PARALLEL):
├── Task 15: Virtualized ResultGrid component [visual-engineering]
├── Task 16: Virtualized DiscoverGrid component [visual-engineering]
├── Task 17: Row height measurement and configuration [quick]
├── Task 18: Virtualization accessibility (keyboard nav, ARIA) [visual-engineering]
├── Task 19: Virtualization edge cases (dynamic content, copy-paste) [deep]
└── Task 20: Virtualization performance benchmarks [quick]

Wave 4 (After Wave 3 — query optimization, MAX PARALLEL):
├── Task 21: Hybrid query execution - streaming data [deep]
├── Task 22: Hybrid query execution - parallel count [deep]
├── Task 23: Hybrid query execution - parallel aggregations [deep]
├── Task 24: Approximate count queries (HLL) [deep]
├── Task 25: Exact count query option [quick]
├── Task 26: Query cancellation with AbortController [deep]
└── Task 27: Query timeout handling [quick]

Wave 5 (After Wave 4 — caching layer, MAX PARALLEL):
├── Task 28: In-memory LRU cache implementation [deep]
├── Task 29: Redis cache integration [deep]
├── Task 30: Cache key generation (hash of query + params) [quick]
├── Task 31: Cache invalidation strategies [deep]
├── Task 32: Cache fallback (Redis unavailable) [quick]
└── Task 33: Cache warming for frequent queries [quick]

Wave 6 (After Wave 5 — integration + migration, MAX PARALLEL):
├── Task 34: Discover page migration to new architecture [deep]
├── Task 35: SQL Console page migration to new architecture [deep]
├── Task 36: API route updates for hybrid queries [deep]
├── Task 37: RBAC integration with new architecture [quick]
├── Task 38: Error handling and graceful degradation [deep]
└── Task 39: Loading states and progress indicators [visual-engineering]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T8-10 → T15-16 → T21-23 → T28-29 → T34-36 → F1-F4 → user okay
Parallel Speedup: ~75% faster than sequential
Max Concurrent: 7 (Waves 1, 2, 3, 4, 5)
```

### Dependency Matrix (abbreviated — show ALL tasks in your generated plan)

- **1-7**: — — 8-14, 1
- **8-10**: 3, 7 — 14, 34, 2
- **11-13**: 3, 7 — 14, 35, 2
- **14**: 8-13 — 34, 35, 2
- **15-16**: 4, 7 — 34, 35, 3
- **17**: 15, 16 — 34, 35, 1
- **18**: 15, 16 — 34, 35, 1
- **19**: 15, 16 — 34, 35, 2
- **20**: 15, 16 — 34, 35, 1
- **21-23**: 8-10, 14 — 34, 36, 3
- **24**: 21, 22 — 34, 36, 2
- **25**: 21, 22 — 34, 36, 1
- **26**: 21, 22 — 34, 35, 36, 2
- **27**: 21, 22 — 34, 35, 36, 1
- **28-29**: 5, 6, 7 — 34, 35, 36, 2
- **30**: 28, 29 — 34, 35, 36, 1
- **31**: 28, 29 — 34, 35, 36, 2
- **32**: 29 — 34, 35, 36, 1
- **33**: 28, 29 — 34, 35, 36, 1
- **34**: 8-10, 14, 15-20, 21-27, 28-33 — F1-F4, 4
- **35**: 11-13, 14, 15-20, 21-27, 28-33 — F1-F4, 4
- **36**: 21-27, 28-33 — 34, 35, F1-F4, 3
- **37**: 34, 35, 36 — F1-F4, 1
- **38**: 34, 35, 36 — F1-F4, 2
- **39**: 34, 35 — F1-F4, 1

> This is abbreviated for reference. YOUR generated plan must include the FULL matrix for ALL tasks.

### Agent Dispatch Summary

- **1**: **7** — T1-T7 → `quick`
- **2**: **7** — T8-T10 → `deep`, T11-T13 → `deep`, T14 → `unspecified-high`
- **3**: **6** — T15-T16 → `visual-engineering`, T17 → `quick`, T18 → `visual-engineering`, T19 → `deep`, T20 → `quick`
- **4**: **7** — T21-T23 → `deep`, T24 → `deep`, T25 → `quick`, T26 → `deep`, T27 → `quick`
- **5**: **6** — T28-T29 → `deep`, T30 → `quick`, T31 → `deep`, T32 → `quick`, T33 → `quick`
- **6**: **6** — T34-T35 → `deep`, T36 → `deep`, T37 → `quick`, T38 → `deep`, T39 → `visual-engineering`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

### Task Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE 1: Foundation (Tasks 1-7) - NO DEPENDENCIES                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T1: Performance Baseline Measurement    ──────────────────────────────────────────────────────────────────┐   │
│  T2: Test Infrastructure Setup          ──────────────────────────────────────────────────────────────────┤   │
│  T3: Zustand Installation + Config      ──────────────────────────────────────────────────────────────────┤   │
│  T4: @tanstack/react-virtual Install    ──────────────────────────────────────────────────────────────────┤   │
│  T5: Hybrid Cache (In-Memory LRU)       ──────────────────────────────────────────────────────────────────┤   │
│  T6: Hybrid Cache (Redis Integration)   ──────────────────────────────────────────────────────────────────┤   │
│  T7: Type Definitions                  ──────────────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE 2: State Management (Tasks 8-14) - DEPENDS ON: T3, T7                                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T3, T7 ──┬── T8: Discover Query State Store ────────────────────────────────────────────────────────────┐   │
│           │                                                                                               │   │
│           ├── T9: Discover Data State Store ────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T10: Discover UI State Store ────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T11: SQL Query State Store ──────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T12: SQL Data State Store ──────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T13: SQL UI State Store ────────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           └── T14: State Migration Utilities ──────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE 3: Virtualization (Tasks 15-20) - DEPENDS ON: T4, T7                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T4, T7 ──┬── T15: Virtualized ResultGrid ───────────────────────────────────────────────────────────────┐   │
│           │                                                                                               │   │
│           ├── T16: Virtualized DiscoverGrid ────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T17: Row Height Measurement ──────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T18: Virtualization Accessibility ─────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── T19: Virtualization Edge Cases ────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           └── T20: Virtualization Benchmarks ────────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE 4: Query Optimization (Tasks 21-27) - DEPENDS ON: T8-10, T14                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T8-10, T14 ──┬── T21: Hybrid Query Streaming ────────────────────────────────────────────────────────────┐   │
│               │                                                                                             │   │
│               ├── T22: Parallel Count Queries ────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T23: Parallel Aggregation Queries ──────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T24: Approximate Count (HLL) ────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T25: Exact Count Option ────────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T26: Query Cancellation ──────────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               └── T27: Query Timeout Handling ──────────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE 5: Caching Layer (Tasks 28-33) - DEPENDS ON: T5, T6, T7                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T5, T6, T7 ──┬── T28: In-Memory LRU Cache ──────────────────────────────────────────────────────────────┐   │
│               │                                                                                             │   │
│               ├── T29: Redis Cache Integration ────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T30: Cache Key Generation ────────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T31: Cache Invalidation ──────────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               ├── T32: Redis Fallback ──────────────────────────────────────────────────────────────────────┤   │
│               │                                                                                             │   │
│               └── T33: Cache Warming ────────────────────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE 6: Integration (Tasks 34-39) - DEPENDS ON: T8-14, T15-20, T21-27, T28-33                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T8-14, T15-20, T21-27, T28-33 ──┬── T34: Discover Page Migration ──────────────────────────────────────┐   │
│                                  │                                                                                   │   │
│                                  ├── T35: SQL Console Migration ────────────────────────────────────────────┤   │
│                                  │                                                                                   │   │
│                                  ├── T36: API Route Updates ──────────────────────────────────────────────────┤   │
│                                  │                                                                                   │   │
│                                  ├── T37: RBAC Integration ────────────────────────────────────────────────────┤   │
│                                  │                                                                                   │   │
│                                  ├── T38: Error Handling ────────────────────────────────────────────────────────┤   │
│                                  │                                                                                   │   │
│                                  └── T39: Loading States ────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WAVE FINAL: Verification (Tasks F1-F4) - DEPENDS ON: T34-39                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                 │
│  T34-39 ──┬── F1: Plan Compliance Audit ─────────────────────────────────────────────────────────────────┐   │
│           │                                                                                               │   │
│           ├── F2: Code Quality Review ────────────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           ├── F3: Real Manual QA ──────────────────────────────────────────────────────────────────────────┤   │
│           │                                                                                               │   │
│           └── F4: Scope Fidelity Check ────────────────────────────────────────────────────────────────────┤   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Parallel Execution Graph

```
WAVE 1 (7 tasks, NO dependencies):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ T1 │ T2 │ T3 │ T4 │ T5 │ T6 │ T7 │  ← All run in parallel                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
WAVE 2 (7 tasks, DEPENDS ON: T3, T7):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ T8 │ T9 │ T10│ T11│ T12│ T13│ T14│  ← All run in parallel                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
WAVE 3 (6 tasks, DEPENDS ON: T4, T7):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ T15│ T16│ T17│ T18│ T19│ T20│  ← All run in parallel                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
WAVE 4 (7 tasks, DEPENDS ON: T8-10, T14):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ T21│ T22│ T23│ T24│ T25│ T26│ T27│  ← All run in parallel                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
WAVE 5 (6 tasks, DEPENDS ON: T5, T6, T7):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ T28│ T29│ T30│ T31│ T32│ T33│  ← All run in parallel                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
WAVE 6 (6 tasks, DEPENDS ON: T8-14, T15-20, T21-27, T28-33):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ T34│ T35│ T36│ T37│ T38│ T39│  ← All run in parallel                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
WAVE FINAL (4 tasks, DEPENDS ON: T34-39):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ F1 │ F2 │ F3 │ F4 │  ← All run in parallel                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [x] 1. **Performance Baseline Measurement**

  **What to do**:
  - Create benchmark script to measure current performance metrics
  - Measure query execution time (P50, P95, P99) for typical Discover queries
  - Measure initial render time for Discover and SQL Console pages
  - Measure scroll performance (fps) with large result sets (1000, 10000 rows)
  - Measure memory usage per session
  - Document baseline metrics in `.sisyphus/baseline/before-refactor.json`
  - Identify top 5 slowest queries and their characteristics

  **Must NOT do**:
  - Do NOT make any code changes during this task
  - Do NOT optimize anything yet - just measure

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Straightforward benchmarking task with clear deliverables
  - **Skills**: []
    - No special skills needed - standard Node.js benchmarking

  **Skills Evaluation**:
  - **brainstorming**: OMITTED - This is a measurement task, not creative work
  - **conventional-commits**: OMITTED - Commit messages are straightforward
  - **dispatching-parallel-agents**: OMITTED - Single task, no parallel dispatch needed
  - **docx**: OMITTED - No Word documents involved
  - **executing-plans**: OMITTED - This is planning, not execution
  - **finishing-a-development-branch**: OMITTED - Not finishing a branch yet
  - **frontend-design**: OMITTED - No UI design involved
  - **receiving-code-review**: OMITTED - No code review involved
  - **requesting-code-review**: OMITTED - No code review involved
  - **skill-creator**: OMITTED - Not creating skills
  - **subagent-driven-development**: OMITTED - Not driving development
  - **systematic-debugging**: OMITTED - Not debugging
  - **test-driven-development**: OMITTED - Not writing tests yet (measurement only)
  - **using-git-worktrees**: OMITTED - Not using worktrees
  - **using-superpowers**: OMITTED - Not using superpowers
  - **verification-before-completion**: OMITTED - Not verifying completion yet
  - **writing-plans**: OMITTED - Already in planning phase
  - **writing-skills**: OMITTED - Not writing skills

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/app/(app)/discover/page.tsx` - Current Discover implementation to benchmark
  - `/src/app/(app)/sql/page.tsx` - Current SQL Console implementation to benchmark
  - `/src/app/api/clickhouse/discover/route.ts` - Current query execution to measure

  **API/Type References** (contracts to implement against):
  - None - this is measurement only

  **Test References** (testing patterns to follow):
  - None - this is measurement only

  **External References** (libraries and frameworks):
  - Node.js `performance.now()` API for timing measurements
  - Chrome DevTools Performance API for browser metrics

  **WHY Each Reference Matters** (explain the relevance):
  - Discover and SQL Console pages are the targets for optimization - need to measure their current performance
  - API routes show how queries are currently executed - need to measure query latency

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Benchmark script created: `scripts/benchmark/baseline.ts`
  - [ ] Baseline metrics saved: `.sisyphus/baseline/before-refactor.json`
  - [ ] `bun run benchmark:baseline` → PASS (outputs metrics)

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  > **This is NOT optional. A task without QA scenarios WILL BE REJECTED.**
  >
  > Write scenario tests that verify the ACTUAL BEHAVIOR of what you built.
  > Minimum: 1 happy path + 1 failure/edge case per task.
  > Each scenario = exact tool + exact steps + exact assertions + evidence path.
  >
  > **The executing agent MUST run these scenarios after implementation.**
  > **The orchestrator WILL verify evidence files exist before marking task complete.**

  ```
  Scenario: Benchmark script runs successfully
    Tool: Bash (bun)
    Preconditions: ClickLens running, ClickHouse accessible
    Steps:
      1. Run `bun run benchmark:baseline`
      2. Verify script completes without errors
      3. Check that `.sisyphus/baseline/before-refactor.json` exists
      4. Verify JSON contains all required metrics (queryTime, renderTime, scrollFps, memoryUsage)
    Expected Result: Script completes successfully, baseline JSON created with all metrics
    Failure Indicators: Script errors, missing JSON file, incomplete metrics
    Evidence: .sisyphus/evidence/task-1-benchmark-success.log

  Scenario: Benchmark captures realistic metrics
    Tool: Bash (bun)
    Preconditions: ClickLens running with sample data
    Steps:
      1. Run `bun run benchmark:baseline`
      2. Parse output JSON
      3. Verify queryTime has P50, P95, P99 values
      4. Verify renderTime is measured in milliseconds
      5. Verify scrollFps is measured for 1000 and 10000 row datasets
      6. Verify memoryUsage is measured in MB
    Expected Result: All metrics present with realistic values (not zeros or NaN)
    Failure Indicators: Missing metrics, unrealistic values (0, Infinity, NaN)
    Evidence: .sisyphus/evidence/task-1-metrics-validation.json
  ```

  **Evidence to Capture**:
  - [ ] Benchmark script output
  - [ ] Baseline metrics JSON file
  - [ ] Top 5 slowest queries report

  **Commit**: YES
  - Message: `perf(baseline): measure current performance metrics`
  - Files: `scripts/benchmark/baseline.ts`, `.sisyphus/baseline/before-refactor.json`
  - Pre-commit: `bun run benchmark:baseline`

- [x] 2. **Test Infrastructure Setup**

  **What to do**:
  - Setup TDD infrastructure with bun test
  - Create test setup file with common fixtures and helpers
  - Configure test environment (mock ClickHouse client, Redis, etc.)
  - Create test utilities for virtualization testing (mock scroll events, viewport)
  - Create test utilities for state management testing (mock Zustand stores)
  - Create test utilities for caching testing (mock Redis, in-memory cache)
  - Setup test coverage reporting (istanbul/nyc)
  - Create example test to verify setup works

  **Must NOT do**:
  - Do NOT write feature tests yet - just infrastructure
  - Do NOT create production code in test files

**Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Type definitions are straightforward with clear patterns
  - **Skills**: []
    - No special skills needed - standard TypeScript types

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward TypeScript type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - Check `package.json` for existing test scripts and dependencies
  - Check if `test/` directory exists and current test structure

  **API/Type References** (contracts to implement against):
  - bun test API documentation
  - @tanstack/react-virtual testing patterns
  - Zustand testing patterns

  **Test References** (testing patterns to follow):
  - bun test documentation for setup and fixtures

  **External References** (libraries and frameworks):
  - bun test documentation: https://bun.sh/docs/test/writing
  - @testing-library/react for component testing
  - @testing-library/user-event for simulating user interactions

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand existing test setup to avoid conflicts
  - Need to follow bun test patterns for consistency
  - Need to set up mocks for ClickHouse, Redis, Zustand to enable isolated testing

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Test setup file created: `test/setup.ts`
  - [ ] Test helpers created: `test/helpers/`
  - [ ] Mock utilities created: `test/mocks/`
  - [ ] Example test created: `test/example.test.ts`
  - [ ] `bun test` → PASS (example test passes)
  - [ ] Coverage reporting configured

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Test infrastructure works
    Tool: Bash (bun)
    Preconditions: None
    Steps:
      1. Run `bun test test/example.test.ts`
      2. Verify test passes
      3. Run `bun test --coverage`
      4. Verify coverage report generated
    Expected Result: Test passes, coverage report generated
    Failure Indicators: Test fails, coverage report missing
    Evidence: .sisyphus/evidence/task-2-test-infra.log

  Scenario: Mock utilities work correctly
    Tool: Bash (bun)
    Preconditions: Test infrastructure setup
    Steps:
      1. Create test using mock ClickHouse client
      2. Create test using mock Redis
      3. Create test using mock Zustand store
      4. Run all tests
      5. Verify all mocks work as expected
    Expected Result: All tests pass, mocks function correctly
    Failure Indicators: Mock errors, test failures
    Evidence: .sisyphus/evidence/task-2-mock-validation.log
  ```

  **Evidence to Capture**:
  - [ ] Test infrastructure files
  - [ ] Example test output
  - [ ] Coverage report

  **Commit**: YES
  - Message: `test(infra): setup TDD infrastructure with bun test`
  - Files: `test/setup.ts`, `test/helpers/`, `test/mocks/`, `test/example.test.ts`
  - Pre-commit: `bun test`

- [x] 3. **Zustand Installation + Configuration**

  **What to do**:
  - Install Zustand package: `bun add zustand`
  - Install TypeScript types: `bun add -d @types/zustand`
  - Create Zustand configuration file with middleware setup
  - Configure devtools middleware for time-travel debugging
  - Configure persist middleware for state persistence (if needed)
  - Create base store type definitions
  - Write tests for Zustand configuration

  **Must NOT do**:
  - Do NOT create actual stores yet - just configuration
  - Do NOT integrate with existing code yet

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Package installation and configuration is straightforward
  - **Skills**: []
    - No special skills needed - standard package setup

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward package installation and configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-7)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - Check `package.json` for existing state management dependencies
  - Check existing state patterns in `/src/lib/hooks/`

  **API/Type References** (contracts to implement against):
  - Zustand documentation: https://zustand-demo.pmnd.rs/
  - Zustand middleware documentation

  **Test References** (testing patterns to follow):
  - Zustand testing patterns from documentation

  **External References** (libraries and frameworks):
  - Zustand official docs: https://zustand-demo.pmnd.rs/
  - Zustand devtools middleware: https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand existing state management to avoid conflicts
  - Need to follow Zustand best practices for middleware setup
  - Need to configure devtools for debugging as requested

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Zustand installed in package.json
  - [ ] Configuration file created: `src/lib/state/zustand.config.ts`
  - [ ] Base store types created: `src/types/store.ts`
  - [ ] Tests created: `test/state/zustand-config.test.ts`
  - [ ] `bun test test/state/zustand-config.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Zustand installation works
    Tool: Bash (bun)
    Preconditions: None
    Steps:
      1. Check package.json for zustand dependency
      2. Run `bun test test/state/zustand-config.test.ts`
      3. Verify all tests pass
    Expected Result: Zustand installed, tests pass
    Failure Indicators: Package not found, tests fail
    Evidence: .sisyphus/evidence/task-3-zustand-install.log

  Scenario: Zustand devtools work
    Tool: Bash (bun)
    Preconditions: Zustand configured
    Steps:
      1. Create test store with devtools middleware
      2. Dispatch actions
      3. Verify devtools capture state changes
      4. Verify time-travel debugging works
    Expected Result: Devtools capture state, time-travel works
    Failure Indicators: Devtools not capturing, time-travel fails
    Evidence: .sisyphus/evidence/task-3-devtools-validation.log
  ```

  **Evidence to Capture**:
  - [ ] package.json showing zustand dependency
  - [ ] Configuration file
  - [ ] Test output

  **Commit**: YES
  - Message: `feat(state): install and configure Zustand`
  - Files: `package.json`, `src/lib/state/zustand.config.ts`, `src/types/store.ts`
  - Pre-commit: `bun test test/state/zustand-config.test.ts`

- [x] 4. **@tanstack/react-virtual Installation + Configuration**

  **What to do**:
  - Install @tanstack/react-virtual package: `bun add @tanstack/react-virtual`
  - Install TypeScript types: `bun add -d @types/react`
  - Create virtualization configuration file
  - Configure default row height (start with 34px from ch-ui)
  - Configure overscan (start with 5 rows)
  - Create base virtualization type definitions
  - Write tests for virtualization configuration

  **Must NOT do**:
  - Do NOT create virtualized components yet - just configuration
  - Do NOT integrate with existing tables yet

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Package installation and configuration is straightforward
  - **Skills**: []
    - No special skills needed - standard package setup

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward package installation and configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - Check `package.json` for existing table dependencies (@tanstack/react-table)
  - Check existing table components in `/src/components/sql/ResultGrid.tsx`

  **API/Type References** (contracts to implement against):
  - @tanstack/react-virtual documentation: https://tanstack.com/virtual/latest
  - @tanstack/react-table integration with virtual

  **Test References** (testing patterns to follow):
  - @tanstack/react-virtual testing patterns

  **External References** (libraries and frameworks):
  - @tanstack/react-virtual docs: https://tanstack.com/virtual/latest
  - ch-ui VirtualTable reference: https://github.com/caioricciuti/ch-ui/blob/main/ui/src/lib/components/table/VirtualTable.svelte

  **WHY Each Reference Matters** (explain the relevance):
  - Need to ensure compatibility with existing @tanstack/react-table
  - Need to follow @tanstack/react-virtual best practices
  - ch-ui provides proven virtualization patterns (34px row height, 5-row overscan)

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] @tanstack/react-virtual installed in package.json
  - [ ] Configuration file created: `src/lib/virtual/virtual.config.ts`
  - [ ] Base virtualization types created: `src/types/virtual.ts`
  - [ ] Tests created: `test/virtual/virtual-config.test.ts`
  - [ ] `bun test test/virtual/virtual-config.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: @tanstack/react-virtual installation works
    Tool: Bash (bun)
    Preconditions: None
    Steps:
      1. Check package.json for @tanstack/react-virtual dependency
      2. Run `bun test test/virtual/virtual-config.test.ts`
      3. Verify all tests pass
    Expected Result: Package installed, tests pass
    Failure Indicators: Package not found, tests fail
    Evidence: .sisyphus/evidence/task-4-virtual-install.log

  Scenario: Virtualization configuration is correct
    Tool: Bash (bun)
    Preconditions: Virtualization configured
    Steps:
      1. Read virtual.config.ts
      2. Verify row height is 34px
      3. Verify overscan is 5 rows
      4. Create test virtualizer with config
      5. Verify virtualizer uses correct settings
    Expected Result: Config has correct values, virtualizer uses them
    Failure Indicators: Incorrect values, virtualizer ignores config
    Evidence: .sisyphus/evidence/task-4-config-validation.log
  ```

  **Evidence to Capture**:
  - [ ] package.json showing @tanstack/react-virtual dependency
  - [ ] Configuration file
  - [ ] Test output

  **Commit**: YES
  - Message: `feat(virtual): install @tanstack/react-virtual`
  - Files: `package.json`, `src/lib/virtual/virtual.config.ts`, `src/types/virtual.ts`
  - Pre-commit: `bun test test/virtual/virtual-config.test.ts`

- [x] 5. **Hybrid Cache Infrastructure (In-Memory LRU)**

  **What to do**:
  - Create in-memory LRU cache implementation
  - Use lru-cache package or implement custom LRU
  - Configure cache size (start with 500 entries)
  - Configure TTL (start with 5 minutes)
  - Implement cache key generation (hash of query + params)
  - Implement cache hit/miss tracking
  - Write tests for LRU cache

  **Must NOT do**:
  - Do NOT integrate with Redis yet - that's Task 6
  - Do NOT integrate with query routes yet - that's later

**Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Package installation and configuration is straightforward
  - **Skills**: []
    - No special skills needed - standard package setup

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward package installation and configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - Check existing cache implementation in `/src/lib/cache/hybrid-cache.ts`
  - Check existing QueryCache in `/src/lib/cache/query-cache.ts`

  **API/Type References** (contracts to implement against):
  - lru-cache package documentation (if using)
  - Cache interface design

  **Test References** (testing patterns to follow):
  - Cache testing patterns (hit, miss, eviction, TTL)

  **External References** (libraries and frameworks):
  - lru-cache package: https://www.npmjs.com/package/lru-cache
  - Kibana session-based cache patterns

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand existing cache implementation to avoid conflicts
  - Need to follow LRU cache best practices
  - Kibana provides proven session-based caching patterns

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] LRU cache implemented: `src/lib/cache/lru-cache.ts`
  - [ ] Cache key generator: `src/lib/cache/key-generator.ts`
  - [ ] Tests created: `test/cache/lru-cache.test.ts`
  - [ ] `bun test test/cache/lru-cache.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: LRU cache works correctly
    Tool: Bash (bun)
    Preconditions: LRU cache implemented
    Steps:
      1. Create LRU cache instance
      2. Set 10 items
      3. Verify all 10 items can be retrieved
      4. Set 1 more item (should evict oldest)
      5. Verify oldest item evicted, newest item present
      6. Verify cache stats (hits, misses, evictions)
    Expected Result: Cache works, eviction works, stats correct
    Failure Indicators: Items not cached, eviction fails, stats wrong
    Evidence: .sisyphus/evidence/task-5-lru-validation.log

  Scenario: Cache key generation is consistent
    Tool: Bash (bun)
    Preconditions: Key generator implemented
    Steps:
      1. Generate key for query A with params X
      2. Generate key for query A with params X again
      3. Verify keys are identical
      4. Generate key for query A with params Y
      5. Verify keys are different
      6. Generate key for query B with params X
      7. Verify keys are different
    Expected Result: Same query+params = same key, different = different key
    Failure Indicators: Keys inconsistent, collisions
    Evidence: .sisyphus/evidence/task-5-key-validation.log
  ```

  **Evidence to Capture**:
  - [ ] LRU cache implementation
  - [ ] Test output
  - [ ] Cache stats output

  **Commit**: YES
  - Message: `feat(cache): implement in-memory LRU cache`
  - Files: `src/lib/cache/lru-cache.ts`, `src/lib/cache/key-generator.ts`
  - Pre-commit: `bun test test/cache/lru-cache.test.ts`

- [x] 6. **Hybrid Cache Infrastructure (Redis Integration)**

  **What to do**:
  - Create Redis cache implementation
  - Use ioredis or redis package
  - Configure Redis connection (check existing Redis setup)
  - Implement cache get/set/delete operations
  - Implement cache TTL (start with 60 seconds)
  - Implement Redis error handling and fallback
  - Write tests for Redis cache (with mock Redis)

  **Must NOT do**:
  - Do NOT integrate with query routes yet - that's later
  - Do NOT implement cache warming yet - that's Task 33

**Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Package installation and configuration is straightforward
  - **Skills**: []
    - No special skills needed - standard package setup

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward package installation and configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - Check existing Redis usage in `/src/lib/cache/hybrid-cache.ts`
  - Check existing QueryCache in `/src/lib/cache/query-cache.ts`

  **API/Type References** (contracts to implement against):
  - ioredis package documentation (if using)
  - Redis package documentation (if using)

  **Test References** (testing patterns to follow):
  - Redis testing patterns (with mocks)

  **External References** (libraries and frameworks):
  - ioredis documentation: https://github.com/luin/ioredis
  - Redis documentation: https://redis.io/docs/

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand existing Redis setup to avoid conflicts
  - Need to follow Redis best practices
  - Need to handle Redis errors gracefully

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Redis cache implemented: `src/lib/cache/redis-cache.ts`
  - [ ] Tests created: `test/cache/redis-cache.test.ts`
  - [ ] `bun test test/cache/redis-cache.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Redis cache works correctly
    Tool: Bash (bun)
    Preconditions: Redis cache implemented with mock
    Steps:
      1. Create Redis cache instance with mock
      2. Set item with TTL
      3. Retrieve item immediately
      4. Verify item retrieved successfully
      5. Wait for TTL to expire
      6. Attempt to retrieve expired item
      7. Verify item not found
    Expected Result: Cache works, TTL works, expired items not found
    Failure Indicators: Cache fails, TTL doesn't work, expired items found
    Evidence: .sisyphus/evidence/task-6-redis-validation.log

  Scenario: Redis error handling works
    Tool: Bash (bun)
    Preconditions: Redis cache implemented
    Steps:
      1. Create Redis cache instance with failing mock
      2. Attempt to set item
      3. Verify error is caught and handled gracefully
      4. Attempt to get item
      5. Verify error is caught and handled gracefully
      6. Verify fallback mechanism works
    Expected Result: Errors caught, fallback works
    Failure Indicators: Errors not caught, fallback fails
    Evidence: .sisyphus/evidence/task-6-error-handling.log
  ```

  **Evidence to Capture**:
  - [ ] Redis cache implementation
  - [ ] Test output
  - [ ] Error handling logs

  **Commit**: YES
  - Message: `feat(cache): integrate Redis cache layer`
  - Files: `src/lib/cache/redis-cache.ts`
  - Pre-commit: `bun test test/cache/redis-cache.test.ts`

- [x] 7. **Type Definitions for New Architecture**

  **What to do**:
  - Create comprehensive type definitions for new architecture
  - Define types for virtualization (VirtualizerConfig, RowMetrics, etc.)
  - Define types for state management (StoreState, StoreActions, etc.)
  - Define types for caching (CacheKey, CacheEntry, CacheStats, etc.)
  - Define types for query execution (QueryRequest, QueryResponse, etc.)
  - Define types for performance metrics (BenchmarkMetrics, PerformanceStats, etc.)
  - Export all types from central index file

  **Must NOT do**:
  - Do NOT create implementation code - just types
  - Do NOT create tests - types are self-documenting

**Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Package installation and configuration is straightforward
  - **Skills**: []
    - No special skills needed - standard package setup

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward package installation and configuration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: None (can start immediately)
  - **Blocked By**: None

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - Check existing types in `/src/types/`
  - Check existing component types in `/src/components/`

  **API/Type References** (contracts to implement against):
  - @tanstack/react-virtual types
  - Zustand types
  - ClickHouse client types

  **Test References** (testing patterns to follow):
  - None - types are self-documenting

  **External References** (libraries and frameworks):
  - TypeScript documentation: https://www.typescriptlang.org/docs/
  - @tanstack/react-virtual types
  - Zustand types

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand existing type patterns for consistency
  - Need to follow TypeScript best practices
  - Need to ensure type compatibility with third-party libraries

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Architecture types created: `src/types/architecture.ts`
  - [ ] Virtualization types created: `src/types/virtual.ts`
  - [ ] State types created: `src/types/store.ts`
  - [ ] Cache types created: `src/types/cache.ts`
  - [ ] Query types created: `src/types/query.ts`
  - [ ] Performance types created: `src/types/performance.ts`
  - [ ] Index file created: `src/types/index.ts`
  - [ ] `bun run tsc --noEmit` → PASS (no type errors)

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Type definitions compile without errors
    Tool: Bash (bun)
    Preconditions: Type definitions created
    Steps:
      1. Run `bun run tsc --noEmit`
      2. Verify no type errors
      3. Check that all types are exported from index.ts
    Expected Result: No type errors, all types exported
    Failure Indicators: Type errors, missing exports
    Evidence: .sisyphus/evidence/task-7-types-compile.log

  Scenario: Type definitions are comprehensive
    Tool: Bash (bun)
    Preconditions: Type definitions created
    Steps:
      1. Read src/types/architecture.ts
      2. Verify all required types are defined
      3. Verify types have proper documentation
      4. Verify types are properly exported
    Expected Result: All types defined, documented, exported
    Failure Indicators: Missing types, undocumented types, missing exports
    Evidence: .sisyphus/evidence/task-7-types-validation.log
  ```

  **Evidence to Capture**:
  - [ ] Type definition files
  - [ ] TypeScript compilation output
  - [ ] Type export validation

  **Commit**: YES
  - Message: `types: define architecture type definitions`
  - Files: `src/types/architecture.ts`, `src/types/virtual.ts`, `src/types/store.ts`, `src/types/cache.ts`, `src/types/query.ts`, `src/types/performance.ts`, `src/types/index.ts`
  - Pre-commit: `bun run tsc --noEmit`

- [x] 8. **Discover Zustand Store - Query State**

  **What to do**:
  - Create Discover query state store using Zustand
  - Migrate query-related state from useDiscoverState hook
  - State includes: query string, filters, time range, sort order, group by
  - Actions include: setQuery, setFilters, setTimeRange, setSort, setGroupBy, resetQuery
  - Implement devtools middleware for debugging
  - Implement persist middleware for URL sync
  - Write tests for query state store

  **Must NOT do**:
  - Do NOT migrate data state yet - that's Task 9
  - Do NOT migrate UI state yet - that's Task 10
  - Do NOT integrate with components yet - that's Task 34

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: State migration requires understanding existing patterns and careful refactoring
  - **Skills**: []
    - No special skills needed - standard Zustand patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Zustand state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-14)
  - **Blocks**: Task 14, Task 34
  - **Blocked By**: Task 3, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/hooks/use-discover-state.ts` - Current Discover state implementation
  - `/src/app/(app)/discover/page.tsx` - Current Discover page usage

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Store types from Task 7

  **Test References** (testing patterns to follow):
  - Zustand store testing patterns

  **External References** (libraries and frameworks):
  - Zustand documentation: https://zustand-demo.pmnd.rs/
  - Kibana state container patterns

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current Discover state to migrate correctly
  - Need to follow Zustand best practices for store structure
  - Kibana provides proven state container patterns

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Query state store created: `src/stores/discover/query-store.ts`
  - [ ] Tests created: `test/stores/discover/query-store.test.ts`
  - [ ] `bun test test/stores/discover/query-store.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Query state store works correctly
    Tool: Bash (bun)
    Preconditions: Query state store implemented
    Steps:
      1. Create query state store instance
      2. Set query string
      3. Verify query string updated
      4. Set filters
      5. Verify filters updated
      6. Set time range
      7. Verify time range updated
      8. Reset query
      9. Verify all state reset to defaults
    Expected Result: All actions work, state updates correctly
    Failure Indicators: Actions fail, state not updated, reset fails
    Evidence: .sisyphus/evidence/task-8-query-store.log

  Scenario: Query state persists to URL
    Tool: Bash (bun)
    Preconditions: Query state store with persist middleware
    Steps:
      1. Set query string
      2. Check URL for query parameter
      3. Verify URL updated
      4. Reload page
      5. Verify query state restored from URL
    Expected Result: URL updated, state restored on reload
    Failure Indicators: URL not updated, state not restored
    Evidence: .sisyphus/evidence/task-8-url-persist.log
  ```

  **Evidence to Capture**:
  - [ ] Query state store implementation
  - [ ] Test output
  - [ ] URL sync validation

  **Commit**: YES
  - Message: `refactor(state): create Discover query state store`
  - Files: `src/stores/discover/query-store.ts`
  - Pre-commit: `bun test test/stores/discover/query-store.test.ts`

- [x] 9. **Discover Zustand Store - Data State**

  **What to do**:
  - Create Discover data state store using Zustand
  - Migrate data-related state from useDiscoverState hook
  - State includes: rows, columns, totalCount, histogramData, loading, error
  - Actions include: setRows, setColumns, setTotalCount, setHistogramData, setLoading, setError, clearData
  - Implement optimistic updates for better UX
  - Write tests for data state store

**Must NOT do**:
  - Do NOT migrate query state - that's Task 11
  - Do NOT migrate data state - that's Task 12
  - Do NOT integrate with components yet - that's Task 35

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: State migration requires understanding existing patterns and careful refactoring
  - **Skills**: []
    - No special skills needed - standard Zustand patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Zustand state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-14)
  - **Blocks**: Task 14, Task 34
  - **Blocked By**: Task 3, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/hooks/use-discover-state.ts` - Current Discover state implementation
  - `/src/app/(app)/discover/page.tsx` - Current Discover page usage

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Store types from Task 7

  **Test References** (testing patterns to follow):
  - Zustand store testing patterns

  **External References** (libraries and frameworks):
  - Zustand documentation: https://zustand-demo.pmnd.rs/
  - Kibana data state container patterns

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current Discover data state to migrate correctly
  - Need to follow Zustand best practices for store structure
  - Kibana provides proven data state patterns

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Data state store created: `src/stores/discover/data-store.ts`
  - [ ] Tests created: `test/stores/discover/data-store.test.ts`
  - [ ] `bun test test/stores/discover/data-store.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Data state store works correctly
    Tool: Bash (bun)
    Preconditions: Data state store implemented
    Steps:
      1. Create data state store instance
      2. Set rows
      3. Verify rows updated
      4. Set columns
      5. Verify columns updated
      6. Set total count
      7. Verify total count updated
      8. Set histogram data
      9. Verify histogram data updated
      10. Clear data
      11. Verify all data cleared
    Expected Result: All actions work, state updates correctly
    Failure Indicators: Actions fail, state not updated, clear fails
    Evidence: .sisyphus/evidence/task-9-data-store.log

  Scenario: Data state handles loading and error states
    Tool: Bash (bun)
    Preconditions: Data state store implemented
    Steps:
      1. Set loading to true
      2. Verify loading state
      3. Set error
      4. Verify error state
      5. Set rows (should clear error)
      6. Verify error cleared
    Expected Result: Loading and error states work correctly
    Failure Indicators: States not set, error not cleared
    Evidence: .sisyphus/evidence/task-9-loading-error.log
  ```

  **Evidence to Capture**:
  - [ ] Data state store implementation
  - [ ] Test output
  - [ ] Loading/error state validation

  **Commit**: YES
  - Message: `refactor(state): create Discover data state store`
  - Files: `src/stores/discover/data-store.ts`
  - Pre-commit: `bun test test/stores/discover/data-store.test.ts`

- [x] 10. **Discover Zustand Store - UI State**

  **What to do**:
  - Create Discover UI state store using Zustand
  - Migrate UI-related state from useDiscoverState hook
  - State includes: selectedRows, expandedRows, columnVisibility, columnOrder, rowWindow, sidebarOpen
  - Actions include: setSelectedRows, toggleRowExpanded, setColumnVisibility, setColumnOrder, setRowWindow, toggleSidebar
  - Implement derived selectors for computed UI state
  - Write tests for UI state store

  **Must NOT do**:
  - Do NOT migrate query state - that's Task 8
  - Do NOT migrate data state - that's Task 9
  - Do NOT integrate with components yet - that's Task 34

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: UI state is simpler than query/data state
  - **Skills**: []
    - No special skills needed - standard Zustand patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Zustand state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-9, 11-14)
  - **Blocks**: Task 14, Task 34
  - **Blocked By**: Task 3, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/hooks/use-discover-state.ts` - Current Discover state implementation
  - `/src/app/(app)/discover/page.tsx` - Current Discover page usage

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Store types from Task 7

  **Test References** (testing patterns to follow):
  - Zustand store testing patterns

  **External References** (libraries and frameworks):
  - Zustand documentation: https://zustand-demo.pmnd.rs/
  - Kibana UI state container patterns

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current Discover UI state to migrate correctly
  - Need to follow Zustand best practices for store structure
  - Kibana provides proven UI state patterns

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] UI state store created: `src/stores/discover/ui-store.ts`
  - [ ] Tests created: `test/stores/discover/ui-store.test.ts`
  - [ ] `bun test test/stores/discover/ui-store.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: UI state store works correctly
    Tool: Bash (bun)
    Preconditions: UI state store implemented
    Steps:
      1. Create UI state store instance
      2. Set selected rows
      3. Verify selected rows updated
      4. Toggle row expanded
      5. Verify row expansion toggled
      6. Set column visibility
      7. Verify column visibility updated
      8. Set row window
      9. Verify row window updated
      10. Toggle sidebar
      11. Verify sidebar toggled
    Expected Result: All actions work, state updates correctly
    Failure Indicators: Actions fail, state not updated
    Evidence: .sisyphus/evidence/task-10-ui-store.log

  Scenario: UI state selectors work correctly
    Tool: Bash (bun)
    Preconditions: UI state store implemented
    Steps:
      1. Set selected rows
      2. Get selected count selector
      3. Verify count matches selected rows length
      4. Set column visibility
      5. Get visible columns selector
      6. Verify only visible columns returned
    Expected Result: Selectors compute correct values
    Failure Indicators: Selectors return wrong values
    Evidence: .sisyphus/evidence/task-10-selectors.log
  ```

  **Evidence to Capture**:
  - [ ] UI state store implementation
  - [ ] Test output
  - [ ] Selector validation

  **Commit**: YES
  - Message: `refactor(state): create Discover UI state store`
  - Files: `src/stores/discover/ui-store.ts`
  - Pre-commit: `bun test test/stores/discover/ui-store.test.ts`

- [x] 11. **SQL Console Zustand Store - Query State**

  **What to do**:
  - Create SQL Console query state store using Zustand
  - Migrate query-related state from useTabsStore hook
  - State includes: query string, selectedTabId, queryHistory
  - Actions include: setQuery, setSelectedTab, addToHistory, clearHistory, executeQuery
  - Implement devtools middleware for debugging
  - Write tests for query state store

**Must NOT do**:
  - Do NOT migrate data state yet - that's Task 12
  - Do NOT migrate UI state yet - that's Task 13
  - Do NOT integrate with components yet - that's Task 35

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: State migration requires understanding existing patterns and careful refactoring
  - **Skills**: []
    - No special skills needed - standard Zustand patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Zustand state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-12, 14)
  - **Blocks**: Task 14, Task 35
  - **Blocked By**: Task 3, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/app/(app)/sql/page.tsx` - Current SQL Console implementation
  - Check for useTabsStore or similar state management

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Store types from Task 7

  **Test References** (testing patterns to follow):
  - Zustand store testing patterns

  **External References** (libraries and frameworks):
  - Zustand documentation: https://zustand-demo.pmnd.rs/

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current SQL Console state to migrate correctly
  - Need to follow Zustand best practices for store structure

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Query state store created: `src/stores/sql/query-store.ts`
  - [ ] Tests created: `test/stores/sql/query-store.test.ts`
  - [ ] `bun test test/stores/sql/query-store.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: SQL query state store works correctly
    Tool: Bash (bun)
    Preconditions: Query state store implemented
    Steps:
      1. Create query state store instance
      2. Set query string
      3. Verify query string updated
      4. Set selected tab
      5. Verify selected tab updated
      6. Add to history
      7. Verify history updated
      8. Clear history
      9. Verify history cleared
    Expected Result: All actions work, state updates correctly
    Failure Indicators: Actions fail, state not updated
    Evidence: .sisyphus/evidence/task-11-sql-query-store.log
  ```

  **Evidence to Capture**:
  - [ ] SQL query state store implementation
  - [ ] Test output

  **Commit**: YES
  - Message: `refactor(state): create SQL Console query state store`
  - Files: `src/stores/sql/query-store.ts`
  - Pre-commit: `bun test test/stores/sql/query-store.test.ts`

- [x] 12. **SQL Console Zustand Store - Data State**

  **What to do**:
  - Create SQL Console data state store using Zustand
  - Migrate data-related state from useTabsStore hook
  - State includes: tabs (with results), loading, error
  - Actions include: addTab, updateTab, removeTab, setTabResult, setTabLoading, setTabError
  - Implement tab management (max tabs, tab ordering)
  - Write tests for data state store

**Must NOT do**:
  - Do NOT migrate query state - that's Task 11
  - Do NOT migrate UI state - that's Task 13
  - Do NOT integrate with components yet - that's Task 35

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: State migration requires understanding existing patterns and careful refactoring
  - **Skills**: []
    - No special skills needed - standard Zustand patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Zustand state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-11, 13-14)
  - **Blocks**: Task 14, Task 35
  - **Blocked By**: Task 3, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/app/(app)/sql/page.tsx` - Current SQL Console implementation
  - Check for useTabsStore or similar state management

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Store types from Task 7

  **Test References** (testing patterns to follow):
  - Zustand store testing patterns

  **External References** (libraries and frameworks):
  - Zustand documentation: https://zustand-demo.pmnd.rs/

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current SQL Console data state to migrate correctly
  - Need to follow Zustand best practices for store structure

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Data state store created: `src/stores/sql/data-store.ts`
  - [ ] Tests created: `test/stores/sql/data-store.test.ts`
  - [ ] `bun test test/stores/sql/data-store.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: SQL data state store works correctly
    Tool: Bash (bun)
    Preconditions: Data state store implemented
    Steps:
      1. Create data state store instance
      2. Add tab
      3. Verify tab added
      4. Update tab result
      5. Verify tab result updated
      6. Set tab loading
      7. Verify loading state
      8. Set tab error
      9. Verify error state
      10. Remove tab
      11. Verify tab removed
    Expected Result: All actions work, state updates correctly
    Failure Indicators: Actions fail, state not updated
    Evidence: .sisyphus/evidence/task-12-sql-data-store.log
  ```

  **Evidence to Capture**:
  - [ ] SQL data state store implementation
  - [ ] Test output

  **Commit**: YES
  - Message: `refactor(state): create SQL Console data state store`
  - Files: `src/stores/sql/data-store.ts`
  - Pre-commit: `bun test test/stores/sql/data-store.test.ts`

- [x] 13. **SQL Console Zustand Store - UI State**

  **What to do**:
  - Create SQL Console UI state store using Zustand
  - Migrate UI-related state from useTabsStore hook
  - State includes: selectedTabId, sidebarOpen, editorHeight, resultHeight
  - Actions include: setSelectedTab, toggleSidebar, setEditorHeight, setResultHeight
  - Implement derived selectors for computed UI state
  - Write tests for UI state store

**Must NOT do**:
  - Do NOT migrate data state yet - that's Task 12
  - Do NOT migrate UI state yet - that's Task 13
  - Do NOT integrate with components yet - that's Task 35

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: State migration requires understanding existing patterns and careful refactoring
  - **Skills**: []
    - No special skills needed - standard Zustand patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Zustand state management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10, 12-14)
  - **Blocks**: Task 14, Task 35
  - **Blocked By**: Task 3, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/app/(app)/sql/page.tsx` - Current SQL Console implementation
  - Check for useTabsStore or similar state management

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Store types from Task 7

  **Test References** (testing patterns to follow):
  - Zustand store testing patterns

  **External References** (libraries and frameworks):
  - Zustand documentation: https://zustand-demo.pmnd.rs/

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current SQL Console UI state to migrate correctly
  - Need to follow Zustand best practices for store structure

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] UI state store created: `src/stores/sql/ui-store.ts`
  - [ ] Tests created: `test/stores/sql/ui-store.test.ts`
  - [ ] `bun test test/stores/sql/ui-store.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: SQL UI state store works correctly
    Tool: Bash (bun)
    Preconditions: UI state store implemented
    Steps:
      1. Create UI state store instance
      2. Set selected tab
      3. Verify selected tab updated
      4. Toggle sidebar
      5. Verify sidebar toggled
      6. Set editor height
      7. Verify editor height updated
      8. Set result height
      9. Verify result height updated
    Expected Result: All actions work, state updates correctly
    Failure Indicators: Actions fail, state not updated
    Evidence: .sisyphus/evidence/task-13-sql-ui-store.log
  ```

  **Evidence to Capture**:
  - [ ] SQL UI state store implementation
  - [ ] Test output

  **Commit**: YES
  - Message: `refactor(state): create SQL Console UI state store`
  - Files: `src/stores/sql/ui-store.ts`
  - Pre-commit: `bun test test/stores/sql/ui-store.test.ts`

- [x] 14. **State Migration Utilities (Hooks → Zustand)**

  **What to do**:
  - Create migration utilities to bridge hooks and Zustand stores
  - Create adapter hooks that wrap Zustand stores for backward compatibility
  - Implement gradual migration strategy (migrate one component at a time)
  - Create migration guide for developers
  - Write tests for migration utilities

**Must NOT do**:
  - Do NOT migrate components yet - that's Tasks 34-35
  - Do NOT remove existing hooks yet - they're needed during migration

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: Migration utilities require careful design to ensure backward compatibility
  - **Skills**: []
    - No special skills needed - standard adapter patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard adapter pattern implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-13)
  - **Blocks**: Tasks 34, 35
  - **Blocked By**: Tasks 8-13

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/hooks/use-discover-state.ts` - Current hooks to migrate from
  - `/src/app/(app)/sql/page.tsx` - Current hooks usage

  **API/Type References** (contracts to implement against):
  - Zustand store patterns
  - Hook patterns

  **Test References** (testing patterns to follow):
  - Adapter testing patterns

  **External References** (libraries and frameworks):
  - Adapter pattern documentation
  - Migration strategy best practices

  **WHY Each Reference Matters** (explain the relevance):
  - Need to understand current hooks to create compatible adapters
  - Need to ensure smooth migration without breaking changes

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Migration utilities created: `src/lib/state/migration.ts`
  - [ ] Adapter hooks created: `src/lib/hooks/use-discover-store.ts`, `src/lib/hooks/use-sql-store.ts`
  - [ ] Migration guide created: `docs/migration-guide.md`
  - [ ] Tests created: `test/state/migration.test.ts`
  - [ ] `bun test test/state/migration.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Adapter hooks work correctly
    Tool: Bash (bun)
    Preconditions: Adapter hooks implemented
    Steps:
      1. Use adapter hook in test component
      2. Trigger state update through adapter
      3. Verify Zustand store updated
      4. Trigger state update directly in store
      5. Verify adapter hook receives update
    Expected Result: Adapter hooks sync with Zustand stores
    Failure Indicators: Adapter doesn't sync, state not updated
    Evidence: .sisyphus/evidence/task-14-adapter-hooks.log

  Scenario: Migration guide is comprehensive
    Tool: Bash (bun)
    Preconditions: Migration guide created
    Steps:
      1. Read migration guide
      2. Verify guide covers all migration steps
      3. Verify guide has examples
      4. Verify guide has troubleshooting section
    Expected Result: Guide is comprehensive and helpful
    Failure Indicators: Guide incomplete, missing examples
    Evidence: .sisyphus/evidence/task-14-migration-guide.log
  ```

  **Evidence to Capture**:
  - [ ] Migration utilities implementation
  - [ ] Adapter hooks implementation
  - [ ] Migration guide
  - [ ] Test output

  **Commit**: YES
  - Message: `refactor(state): implement state migration utilities`
  - Files: `src/lib/state/migration.ts`, `src/lib/hooks/use-discover-store.ts`, `src/lib/hooks/use-sql-store.ts`, `docs/migration-guide.md`
  - Pre-commit: `bun test test/state/migration.test.ts`

- [x] 15. **Virtualized ResultGrid Component**

  **What to do**:
  - Create VirtualizedResultGrid component using @tanstack/react-virtual
  - Integrate with existing TanStack Table
  - Implement fixed row height (34px from ch-ui)
  - Implement overscan (5 rows)
  - Maintain all existing ResultGrid functionality (sorting, filtering, column resizing)
  - Add keyboard navigation support
  - Write tests for VirtualizedResultGrid

  **Must NOT do**:
  - Do NOT change ResultGrid API - maintain backward compatibility
  - Do NOT implement horizontal virtualization yet - vertical only

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `visual-engineering`
    - Reason: UI component requiring design and implementation
  - **Skills**: [`frontend-design`]
    - `frontend-design`: Domain overlap - creating polished UI components with virtualization

  **Skills Evaluation**:
  - **frontend-design**: INCLUDED - Creating polished UI components with virtualization
  - **brainstorming**: OMITTED - Design already decided (virtualization)
  - **test-driven-development**: OMITTED - Tests will be written but not TDD for this component
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-20)
  - **Blocks**: Tasks 34, 35
  - **Blocked By**: Task 4, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/components/sql/ResultGrid.tsx` - Current ResultGrid to virtualize
  - `/src/lib/virtual/virtual.config.ts` - Virtualization configuration from Task 4

  **API/Type References** (contracts to implement against):
  - @tanstack/react-virtual documentation
  - @tanstack/react-table integration with virtual

  **Test References** (testing patterns to follow):
  - Component testing patterns with @testing-library/react

  **External References** (libraries and frameworks):
  - @tanstack/react-virtual docs: https://tanstack.com/virtual/latest
  - ch-ui VirtualTable reference: https://github.com/caioricciuti/ch-ui/blob/main/ui/src/lib/components/table/VirtualTable.svelte

  **WHY Each Reference Matters** (explain the relevance):
  - Need to maintain ResultGrid API and functionality while adding virtualization
  - Need to follow @tanstack/react-virtual best practices
  - ch-ui provides proven virtualization patterns

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] VirtualizedResultGrid created: `src/components/sql/VirtualizedResultGrid.tsx`
  - [ ] Tests created: `test/components/sql/VirtualizedResultGrid.test.tsx`
  - [ ] `bun test test/components/sql/VirtualizedResultGrid.test.tsx` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: VirtualizedResultGrid renders correctly
    Tool: Playwright
    Preconditions: ClickLens running, SQL Console open
    Steps:
      1. Navigate to SQL Console
      2. Execute query returning 1000 rows
      3. Verify only visible rows rendered in DOM
      4. Scroll down
      5. Verify new rows rendered, old rows removed
      6. Verify scroll performance is smooth (60fps)
    Expected Result: Only visible rows rendered, smooth scrolling
    Failure Indicators: All rows rendered, choppy scrolling
    Evidence: .sisyphus/evidence/task-15-virtual-render.mp4

  Scenario: VirtualizedResultGrid maintains existing functionality
    Tool: Playwright
    Preconditions: VirtualizedResultGrid implemented
    Steps:
      1. Navigate to SQL Console
      2. Execute query
      3. Test sorting by clicking column header
      4. Test filtering
      5. Test column resizing
      6. Verify all features work as before
    Expected Result: All existing features work correctly
    Failure Indicators: Features broken or missing
    Evidence: .sisyphus/evidence/task-15-functionality.mp4
  ```

  **Evidence to Capture**:
  - [ ] VirtualizedResultGrid implementation
  - [ ] Test output
  - [ ] Performance benchmarks

  **Commit**: YES
  - Message: `feat(virtual): implement VirtualizedResultGrid`
  - Files: `src/components/sql/VirtualizedResultGrid.tsx`
  - Pre-commit: `bun test test/components/sql/VirtualizedResultGrid.test.tsx`

- [x] 16. **Virtualized DiscoverGrid Component**

  **What to do**:
  - Create VirtualizedDiscoverGrid component using @tanstack/react-virtual
  - Integrate with existing TanStack Table
  - Implement fixed row height (34px from ch-ui)
  - Implement overscan (5 rows)
  - Maintain all existing DiscoverGrid functionality (sorting, filtering, row expansion)
  - Add keyboard navigation support
  - Write tests for VirtualizedDiscoverGrid

  **Must NOT do**:
  - Do NOT change DiscoverGrid API - maintain backward compatibility
  - Do NOT implement horizontal virtualization yet - vertical only

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `visual-engineering`
    - Reason: UI component requiring design and implementation
  - **Skills**: [`frontend-design`]
    - `frontend-design`: Domain overlap - creating polished UI components with virtualization

  **Skills Evaluation**:
  - **frontend-design**: INCLUDED - Creating polished UI components with virtualization
  - **brainstorming**: OMITTED - Design already decided (virtualization)
  - **test-driven-development**: OMITTED - Tests will be written but not TDD for this component
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15, 17-20)
  - **Blocks**: Task 34
  - **Blocked By**: Task 4, Task 7

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/app/(app)/discover/page.tsx` - Current DiscoverGrid to virtualize
  - `/src/lib/virtual/virtual.config.ts` - Virtualization configuration from Task 4

  **API/Type References** (contracts to implement against):
  - @tanstack/react-virtual documentation
  - @tanstack/react-table integration with virtual

  **Test References** (testing patterns to follow):
  - Component testing patterns with @testing-library/react

  **External References** (libraries and frameworks):
  - @tanstack/react-virtual docs: https://tanstack.com/virtual/latest
  - ch-ui VirtualTable reference: https://github.com/caioricciuti/ch-ui/blob/main/ui/src/lib/components/table/VirtualTable.svelte

  **WHY Each Reference Matters** (explain the relevance):
  - Need to maintain DiscoverGrid API and functionality while adding virtualization
  - Need to follow @tanstack/react-virtual best practices
  - ch-ui provides proven virtualization patterns

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] VirtualizedDiscoverGrid created: `src/components/discover/VirtualizedDiscoverGrid.tsx`
  - [ ] Tests created: `test/components/discover/VirtualizedDiscoverGrid.test.tsx`
  - [ ] `bun test test/components/discover/VirtualizedDiscoverGrid.test.tsx` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: VirtualizedDiscoverGrid renders correctly
    Tool: Playwright
    Preconditions: ClickLens running, Discover page open
    Steps:
      1. Navigate to Discover page
      2. Execute search returning 1000 rows
      3. Verify only visible rows rendered in DOM
      4. Scroll down
      5. Verify new rows rendered, old rows removed
      6. Verify scroll performance is smooth (60fps)
    Expected Result: Only visible rows rendered, smooth scrolling
    Failure Indicators: All rows rendered, choppy scrolling
    Evidence: .sisyphus/evidence/task-16-virtual-render.mp4

  Scenario: VirtualizedDiscoverGrid maintains existing functionality
    Tool: Playwright
    Preconditions: VirtualizedDiscoverGrid implemented
    Steps:
      1. Navigate to Discover page
      2. Execute search
      3. Test sorting by clicking column header
      4. Test filtering
      5. Test row expansion
      6. Verify all features work as before
    Expected Result: All existing features work correctly
    Failure Indicators: Features broken or missing
    Evidence: .sisyphus/evidence/task-16-functionality.mp4
  ```

  **Evidence to Capture**:
  - [ ] VirtualizedDiscoverGrid implementation
  - [ ] Test output
  - [ ] Performance benchmarks

  **Commit**: YES
  - Message: `feat(virtual): implement VirtualizedDiscoverGrid`
  - Files: `src/components/discover/VirtualizedDiscoverGrid.tsx`
  - Pre-commit: `bun test test/components/discover/VirtualizedDiscoverGrid.test.tsx`

- [x] 17. **Row Height Measurement and Configuration**

  **What to do**:
  - Measure actual row heights in current ResultGrid and DiscoverGrid
  - Configure optimal row height for virtualization
  - Start with 34px from ch-ui as baseline
  - Adjust based on actual content measurements
  - Update virtual.config.ts with final row height
  - Write tests for row height configuration

  **Must NOT do**:
  - Do NOT change row height dynamically - keep fixed for performance
  - Do NOT implement variable row heights - too complex for initial implementation

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Measurement and configuration task
  - **Skills**: []
    - No special skills needed - standard measurement techniques

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Measurement task, not creative
  - `frontend-design`: OMITTED - Not designing UI, just measuring
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-16, 18-20)
  - **Blocks**: Tasks 34, 35
  - **Blocked By**: Task 15, Task 16

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/components/sql/ResultGrid.tsx` - Current ResultGrid to measure
  - `/src/app/(app)/discover/page.tsx` - Current DiscoverGrid to measure
  - `/src/lib/virtual/virtual.config.ts` - Configuration to update

  **API/Type References** (contracts to implement against):
  - DOM measurement APIs (getBoundingClientRect, etc.)

  **Test References** (testing patterns to follow):
  - Measurement testing patterns

  **External References** (libraries and frameworks):
  - ch-ui row height reference: https://github.com/caioricciuti/ch-ui/blob/main/ui/src/lib/components/table/VirtualTable.svelte

  **WHY Each Reference Matters** (explain the relevance):
  - Need to measure actual row heights to configure virtualization correctly
  - ch-ui provides proven row height (34px)

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Row height measured and documented
  - [ ] virtual.config.ts updated with final row height
  - [ ] Tests created: `test/virtual/row-height.test.ts`
  - [ ] `bun test test/virtual/row-height.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Row height measurement is accurate
    Tool: Bash (bun)
    Preconditions: ClickLens running
    Steps:
      1. Run row height measurement script
      2. Verify measurements for ResultGrid
      3. Verify measurements for DiscoverGrid
      4. Verify average row height calculated
      5. Verify virtual.config.ts updated
    Expected Result: Accurate measurements, config updated
    Failure Indicators: Inaccurate measurements, config not updated
    Evidence: .sisyphus/evidence/task-17-measurement.log

  Scenario: Row height configuration works
    Tool: Bash (bun)
    Preconditions: Row height configured
    Steps:
      1. Read virtual.config.ts
      2. Verify row height is set
      3. Create virtualizer with config
      4. Verify virtualizer uses correct row height
    Expected Result: Config has correct value, virtualizer uses it
    Failure Indicators: Config wrong, virtualizer ignores config
    Evidence: .sisyphus/evidence/task-17-config-validation.log
  ```

  **Evidence to Capture**:
  - [ ] Row height measurements
  - [ ] Updated configuration
  - [ ] Test output

  **Commit**: YES
  - Message: `feat(virtual): measure and configure row heights`
  - Files: `src/lib/virtual/row-height.ts`, `src/lib/virtual/virtual.config.ts`
  - Pre-commit: `bun test test/virtual/row-height.test.ts`

- [x] 18. **Virtualization Accessibility (Keyboard Navigation, ARIA)**

  **What to do**:
  - Add keyboard navigation support to virtualized tables
  - Implement arrow key navigation (up, down, left, right)
  - Implement Home/End key navigation
  - Implement Page Up/Page Down navigation
  - Add ARIA attributes for screen readers
  - Ensure focus management works correctly with virtualization
  - Write accessibility tests

  **Must NOT do**:
  - Do NOT break existing keyboard shortcuts
  - Do NOT remove ARIA attributes from existing components

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `visual-engineering`
    - Reason: Accessibility requires UI implementation
  - **Skills**: []
    - No special skills needed - standard accessibility patterns

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Accessibility patterns are well-established
  - `frontend-design`: OMITTED - Not designing new UI, just adding accessibility
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-17, 19-20)
  - **Blocks**: Tasks 34, 35
  - **Blocked By**: Task 15, Task 16

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/components/sql/ResultGrid.tsx` - Current keyboard navigation
  - `/src/app/(app)/discover/page.tsx` - Current keyboard navigation

  **API/Type References** (contracts to implement against):
  - WAI-ARIA guidelines: https://www.w3.org/WAI/ARIA/apg/
  - Keyboard navigation patterns

  **Test References** (testing patterns to follow):
  - Accessibility testing with @testing-library/react

  **External References** (libraries and frameworks):
  - WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
  - React ARIA: https://react-spectrum.adobe.com/react-aria/

  **WHY Each Reference Matters** (explain the relevance):
  - Need to follow WAI-ARIA guidelines for accessibility
  - Need to maintain existing keyboard shortcuts

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Keyboard navigation implemented
  - [ ] ARIA attributes added
  - [ ] Tests created: `test/virtual/accessibility.test.tsx`
  - [ ] `bun test test/virtual/accessibility.test.tsx` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Keyboard navigation works
    Tool: Playwright
    Preconditions: Virtualized tables implemented
    Steps:
      1. Navigate to SQL Console
      2. Execute query
      3. Press Arrow Down
      4. Verify focus moves to next row
      5. Press Arrow Up
      6. Verify focus moves to previous row
      7. Press Home
      8. Verify focus moves to first row
      9. Press End
      10. Verify focus moves to last visible row
    Expected Result: All keyboard shortcuts work correctly
    Failure Indicators: Keyboard shortcuts don't work or behave incorrectly
    Evidence: .sisyphus/evidence/task-18-keyboard-nav.mp4

  Scenario: ARIA attributes are present
    Tool: Playwright
    Preconditions: Virtualized tables implemented
    Steps:
      1. Navigate to SQL Console
      2. Execute query
      3. Inspect table element
      4. Verify role="grid" attribute
      5. Verify aria-rowcount attribute
      6. Verify aria-colcount attribute
      7. Verify rows have role="row"
      8. Verify cells have role="gridcell"
    Expected Result: All required ARIA attributes present
    Failure Indicators: Missing ARIA attributes
    Evidence: .sisyphus/evidence/task-18-aria-validation.log
  ```

  **Evidence to Capture**:
  - [ ] Accessibility implementation
  - [ ] Test output
  - [ ] Screen reader validation

  **Commit**: YES
  - Message: `feat(virtual): add accessibility to virtualized tables`
  - Files: `src/components/virtual/accessibility.tsx`
  - Pre-commit: `bun test test/virtual/accessibility.test.tsx`

- [x] 19. **Virtualization Edge Cases (Dynamic Content, Copy-Paste)**

  **What to do**:
  - Handle dynamic row content (variable text length)
  - Implement copy-paste from virtualized tables
  - Handle row selection with virtualization
  - Handle cell editing (if applicable)
  - Handle very long text content in cells
  - Handle special characters in data
  - Write tests for edge cases

  **Must NOT do**:
  - Do NOT implement variable row heights - keep fixed for performance
  - Do NOT break existing copy-paste functionality

**Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: Edge cases require careful handling and testing
  - **Skills**: []
    - No special skills needed - standard edge case handling

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Edge cases are well-defined
  - `frontend-design`: OMITTED - Not designing new UI, just handling edge cases
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-18, 20)
  - **Blocks**: Tasks 34, 35
  - **Blocked By**: Task 15, Task 16

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/components/sql/ResultGrid.tsx` - Current copy-paste implementation
  - `/src/app/(app)/discover/page.tsx` - Current row selection

  **API/Type References** (contracts to implement against):
  - Clipboard API for copy-paste
  - Selection API for row selection

  **Test References** (testing patterns to follow):
  - Edge case testing patterns

  **External References** (libraries and frameworks):
  - Clipboard API documentation: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API

  **WHY Each Reference Matters** (explain the relevance):
  - Need to maintain existing copy-paste and selection functionality
  - Need to handle edge cases correctly with virtualization

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Edge cases handled
  - [ ] Copy-paste works with virtualization
  - [ ] Row selection works with virtualization
  - [ ] Tests created: `test/virtual/edge-cases.test.tsx`
  - [ ] `bun test test/virtual/edge-cases.test.tsx` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Copy-paste works with virtualization
    Tool: Playwright
    Preconditions: Virtualized tables implemented
    Steps:
      1. Navigate to SQL Console
      2. Execute query
      3. Select multiple cells
      4. Press Ctrl+C (Cmd+C on Mac)
      5. Paste into text editor
      6. Verify copied data matches selected cells
    Expected Result: Copy-paste works correctly
    Failure Indicators: Copy-paste fails or copies wrong data
    Evidence: .sisyphus/evidence/task-19-copy-paste.mp4

  Scenario: Row selection works with virtualization
    Tool: Playwright
    Preconditions: Virtualized tables implemented
    Steps:
      1. Navigate to SQL Console
      2. Execute query
      3. Click row 1
      4. Verify row 1 selected
      5. Scroll down to row 100
      6. Click row 100
      7. Verify row 100 selected
      8. Verify row 1 still selected
    Expected Result: Row selection works correctly with virtualization
    Failure Indicators: Selection lost or incorrect
    Evidence: .sisyphus/evidence/task-19-selection.mp4
  ```

  **Evidence to Capture**:
  - [ ] Edge case handling implementation
  - [ ] Test output
  - [ ] Copy-paste validation

  **Commit**: YES
  - Message: `feat(virtual): handle virtualization edge cases`
  - Files: `src/lib/virtual/edge-cases.ts`
  - Pre-commit: `bun test test/virtual/edge-cases.test.tsx`

- [x] 20. **Virtualization Performance Benchmarks**

  **What to do**:
  - Create performance benchmarks for virtualized tables
  - Measure render time with different dataset sizes (100, 1000, 10000 rows)
  - Measure scroll performance (fps)
  - Measure memory usage
  - Compare with non-virtualized baseline
  - Document performance improvements
  - Write tests for benchmarks

  **Must NOT do**:
  - Do NOT change virtualization implementation - just measure

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Benchmarking task with clear deliverables
  - **Skills**: []
    - No special skills needed - standard benchmarking techniques

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Benchmarking is straightforward
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-19)
  - **Blocks**: Tasks 34, 35
  - **Blocked By**: Task 15, Task 16

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/scripts/benchmark/baseline.ts` - Baseline benchmarks from Task 1

  **API/Type References** (contracts to implement against):
  - Performance measurement APIs

  **Test References** (testing patterns to follow):
  - Benchmark testing patterns

  **External References** (libraries and frameworks):
  - Kibana virtualization performance reference (9x improvement)

  **WHY Each Reference Matters** (explain the relevance):
  - Need to compare with baseline from Task 1
  - Need to measure actual performance improvements

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  **If TDD (tests enabled):**
  - [ ] Benchmark script created: `benchmarks/virtualization.ts`
  - [ ] Performance documented: `.sisyphus/baseline/after-virtualization.json`
  - [ ] Tests created: `test/virtual/benchmarks.test.ts`
  - [ ] `bun test test/virtual/benchmarks.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  ```
  Scenario: Virtualization improves performance
    Tool: Bash (bun)
    Preconditions: Virtualized tables implemented
    Steps:
      1. Run `bun run benchmark:virtualization`
      2. Compare with baseline from Task 1
      3. Verify render time improved
      4. Verify scroll fps improved
      5. Verify memory usage reduced
    Expected Result: Performance improved across all metrics
    Failure Indicators: Performance degraded or no improvement
    Evidence: .sisyphus/evidence/task-20-performance.log

  Scenario: Benchmarks are consistent
    Tool: Bash (bun)
    Preconditions: Benchmark script created
    Steps:
      1. Run benchmark 3 times
      2. Compare results
      3. Verify results are consistent (within 10% variance)
    Expected Result: Consistent benchmark results
    Failure Indicators: Highly variable results
    Evidence: .sisyphus/evidence/task-20-consistency.log
  ```

  **Evidence to Capture**:
  - [ ] Benchmark script
  - [ ] Performance results
  - [ ] Comparison with baseline

  **Commit**: YES
  - Message: `perf(virtual): benchmark virtualization performance`
  - Files: `benchmarks/virtualization.ts`, `.sisyphus/baseline/after-virtualization.json`
  - Pre-commit: `bun test test/virtual/benchmarks.test.ts`

- [x] 21. **Hybrid Query Execution - Streaming Data**

  **What to do**:
  - Implement streaming query execution for Discover API
  - Stream data immediately without waiting for count/aggs
  - Use NDJSON format for streaming
  - Implement backpressure handling
  - Maintain existing streaming functionality
  - Write tests for streaming queries

  **Must NOT do**:
  - Do NOT break existing streaming - enhance it
  - Do NOT wait for count/aggs before streaming data

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Implementation is straightforward
  - `systematic-debugging`: OMITTED - Not debugging
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 22-27)
  - **Blocks**: Task 34, Task 36
  - **Blocked By**: Task 8-10, Task 14

  **References**:
  - `/src/app/api/clickhouse/discover/route.ts` - Current streaming implementation
  - `/src/app/api/clickhouse/query/route.ts` - Current query streaming
  - ch-ui streaming patterns

  **Acceptance Criteria**:
  - [ ] Streaming implemented in Discover API
  - [ ] Tests created: `test/api/discover/streaming.test.ts`
  - [ ] `bun test test/api/discover/streaming.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Streaming works immediately
    Tool: Bash (curl)
    Steps:
      1. POST to /api/clickhouse/discover with streaming
      2. Verify data starts streaming immediately
      3. Verify no delay for count/aggs
    Expected Result: Data streams immediately
    Evidence: .sisyphus/evidence/task-21-streaming.log
  ```

  **Commit**: YES
  - Message: `feat(query): implement hybrid query streaming`
  - Files: `src/app/api/clickhouse/discover/route.ts`

- [x] 22. **Hybrid Query Execution - Parallel Count**

  **What to do**:
  - Implement parallel count query execution
  - Run count query in background while data streams
  - Update UI with count when available
  - Use approximate counts for histogram (Task 24)
  - Write tests for parallel count queries

  **Must NOT do**:
  - Do NOT block data streaming on count query
  - Do NOT run count query for every request (cache results)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Implementation is straightforward
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 21, 23-27)
  - **Blocks**: Task 34, Task 36
  - **Blocked By**: Task 8-10, Task 14

  **References**:
  - `/src/app/api/clickhouse/discover/route.ts` - Current count query implementation
  - Kibana query splitting patterns

  **Acceptance Criteria**:
  - [ ] Parallel count implemented
  - [ ] Tests created: `test/api/discover/count.test.ts`
  - [ ] `bun test test/api/discover/count.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Count runs in parallel
    Tool: Bash (curl)
    Steps:
      1. POST to /api/clickhouse/discover
      2. Verify data streams immediately
      3. Verify count query runs in background
      4. Verify count updates UI when available
    Expected Result: Count runs in parallel, doesn't block streaming
    Evidence: .sisyphus/evidence/task-22-parallel-count.log
  ```

  **Commit**: YES
  - Message: `feat(query): implement parallel count queries`
  - Files: `src/app/api/clickhouse/discover/route.ts`

- [x] 23. **Hybrid Query Execution - Parallel Aggregations**

  **What to do**:
  - Implement parallel aggregation query execution
  - Run histogram/aggregation queries in background
  - Update UI with aggregations when available
  - Use adaptive intervals (max 150 points like Kibana)
  - Write tests for parallel aggregation queries

  **Must NOT do**:
  - Do NOT block data streaming on aggregation queries
  - Do NOT run aggregations for every request (cache results)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Implementation is straightforward
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 21-22, 24-27)
  - **Blocks**: Task 34, Task 36
  - **Blocked By**: Task 8-10, Task 14

  **References**:
  - `/src/app/api/clickhouse/discover/route.ts` - Current aggregation implementation
  - Kibana aggregation patterns

  **Acceptance Criteria**:
  - [ ] Parallel aggregations implemented
  - [ ] Tests created: `test/api/discover/aggregations.test.ts`
  - [ ] `bun test test/api/discover/aggregations.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Aggregations run in parallel
    Tool: Bash (curl)
    Steps:
      1. POST to /api/clickhouse/discover
      2. Verify data streams immediately
      3. Verify aggregations run in background
      4. Verify histogram updates when available
    Expected Result: Aggregations run in parallel, don't block streaming
    Evidence: .sisyphus/evidence/task-23-parallel-aggs.log
  ```

  **Commit**: YES
  - Message: `feat(query): implement parallel aggregation queries`
  - Files: `src/app/api/clickhouse/discover/route.ts`

- [ ] 24. **Approximate Count Queries (HLL)**

  **What to do**:
  - Implement approximate count using ClickHouse HLL functions
  - Use uniqHLL, uniqCombined for approximate counts
  - Use approximate counts for histogram by default
  - Display "approximate" indicator to users
  - Write tests for approximate counts

  **Must NOT do**:
  - Do NOT use approximate counts for exact count requests
  - Do NOT hide approximation from users

**Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Implementation is straightforward
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 21-23, 25-27)
  - **Blocks**: Task 34, Task 36
  - **Blocked By**: Task 21, Task 22

  **References**:
  - ClickHouse HLL documentation: https://clickhouse.com/docs/en/sql-reference/functions/aggregate-functions/uniq
  - `/src/app/api/clickhouse/discover/route.ts` - Current count implementation

  **Acceptance Criteria**:
  - [ ] Approximate count implemented: `src/lib/clickhouse/approx-count.ts`
  - [ ] Tests created: `test/clickhouse/approx-count.test.ts`
  - [ ] `bun test test/clickhouse/approx-count.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Approximate count is fast
    Tool: Bash (bun)
    Steps:
      1. Run approximate count query
      2. Measure query time
      3. Verify < 1 second for large table
    Expected Result: Approximate count is fast
    Evidence: .sisyphus/evidence/task-24-approx-count.log
  ```

  **Commit**: YES
  - Message: `feat(query): add approximate count with HLL`
  - Files: `src/lib/clickhouse/approx-count.ts`

- [x] 25. **Exact Count Query Option**

  **What to do**:
  - Implement exact count query option
  - Add UI toggle for approximate vs exact count
  - Use exact count() when user requests it
  - Cache exact count results
  - Write tests for exact count option

  **Must NOT do**:
  - Do NOT use exact count by default (too slow)
  - Do NOT remove approximate count option

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Implementation is straightforward
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 21-24, 26-27)
  - **Blocks**: Task 34, Task 36
  - **Blocked By**: Task 21, Task 22

  **References**:
  - `/src/app/api/clickhouse/discover/route.ts` - Current count implementation
  - `/src/app/(app)/discover/page.tsx` - Discover UI

  **Acceptance Criteria**:
  - [ ] Exact count option implemented: `src/lib/clickhouse/exact-count.ts`
  - [ ] UI toggle added
  - [ ] Tests created: `test/clickhouse/exact-count.test.ts`
  - [ ] `bun test test/clickhouse/exact-count.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Exact count option works
    Tool: Playwright
    Steps:
      1. Navigate to Discover page
      2. Enable exact count toggle
      3. Execute search
      4. Verify exact count displayed
    Expected Result: Exact count displayed when requested
    Evidence: .sisyphus/evidence/task-25-exact-count.mp4
  ```

  **Commit**: YES
  - Message: `feat(query): add exact count query option`
  - Files: `src/lib/clickhouse/exact-count.ts`

- [ ] 26. **Query Cancellation with AbortController**

  **What to do**:
  - Implement query cancellation using AbortController
  - Cancel in-flight queries when user changes filters
  - Clean up resources on cancellation
  - Handle cancellation errors gracefully
  - Write tests for query cancellation

  **Must NOT do**:
  - Do NOT break existing query functionality
  - Do NOT leave resources uncanceled

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - AbortController pattern is well-established
  - `systematic-debugging`: OMITTED - Not debugging
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 21-25, 27)
  - **Blocks**: Tasks 34, 35, 36
  - **Blocked By**: Task 21, Task 22

  **References**:
  - Telescope cancellation patterns
  - AbortController documentation: https://developer.mozilla.org/en-US/docs/Web/API/AbortController

  **Acceptance Criteria**:
  - [ ] Query cancellation implemented: `src/lib/clickhouse/cancellation.ts`
  - [ ] Tests created: `test/clickhouse/cancellation.test.ts`
  - [ ] `bun test test/clickhouse/cancellation.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Query cancellation works
    Tool: Playwright
    Steps:
      1. Navigate to Discover page
      2. Execute long-running query
      3. Change filters before query completes
      4. Verify previous query canceled
      5. Verify new query starts
    Expected Result: Old query canceled, new query starts
    Evidence: .sisyphus/evidence/task-26-cancellation.mp4
  ```

  **Commit**: YES
  - Message: `feat(query): implement query cancellation`
  - Files: `src/lib/clickhouse/cancellation.ts`

- [x] 27. **Query Timeout Handling**

  **What to do**:
  - Implement query timeout handling
  - Set reasonable timeout (300s from existing code)
  - Handle timeout errors gracefully
  - Show timeout error to user
  - Write tests for timeout handling

  **Must NOT do**:
  - Do NOT reduce timeout below 300s (existing value)
  - Do NOT hide timeout errors from users

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Skills Evaluation**:
  - `brainstorming`: OMITTED - Timeout handling is straightforward
  - Other skills: No domain overlap

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 21-26)
  - **Blocks**: Tasks 34, 35, 36
  - **Blocked By**: Task 21, Task 22

  **References**:
  - `/src/lib/clickhouse/client.ts` - Existing timeout configuration

  **Acceptance Criteria**:
  - [ ] Timeout handling implemented: `src/lib/clickhouse/timeout.ts`
  - [ ] Tests created: `test/clickhouse/timeout.test.ts`
  - [ ] `bun test test/clickhouse/timeout.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Timeout error handled gracefully
    Tool: Bash (bun)
    Steps:
      1. Execute query that exceeds timeout
      2. Verify timeout error caught
      3. Verify error message displayed to user
    Expected Result: Timeout error handled gracefully
    Evidence: .sisyphus/evidence/task-27-timeout.log
  ```

  **Commit**: YES
  - Message: `feat(query): add query timeout handling`
  - Files: `src/lib/clickhouse/timeout.ts`

- [x] 28. **In-Memory LRU Cache Implementation**

  **What to do**:
  - Integrate in-memory LRU cache into query routes (already implemented in Task 5)
  - Add cache middleware to Discover API route
  - Add cache middleware to SQL Console query route
  - Implement cache lookup before query execution
  - Implement cache storage after query execution
  - Configure cache TTL (5 minutes from Task 5)
  - Configure cache size (500 entries from Task 5)
  - Write integration tests for LRU cache

  **Must NOT do**:
  - Do NOT implement Redis integration yet - that's Task 29
  - Do NOT cache sensitive data (PII, credentials)

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: Cache integration requires understanding query flow and middleware patterns
  - **Skills**: []
    - No special skills needed - standard cache integration patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard cache integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 29-33)
  - **Blocks**: Tasks 34, 35, 36
  - **Blocked By**: Task 5

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/cache/lru-cache.ts` - LRU cache implementation from Task 5
  - `/src/app/api/clickhouse/discover/route.ts` - Discover API route to integrate cache
  - `/src/app/api/clickhouse/query/route.ts` - SQL Console query route to integrate cache

  **API/Type References** (contracts to implement against):
  - `/src/lib/cache/key-generator.ts` - Cache key generation from Task 5

  **Test References** (testing patterns to follow):
  - Integration testing patterns with bun test

  **External References** (libraries and frameworks):
  - None - using existing cache implementation

  **WHY Each Reference Matters** (explain the relevance):
  - LRU cache implementation: Need to understand cache API (get, set, delete)
  - API routes: Need to understand query flow to insert cache middleware
  - Key generator: Need to use consistent cache keys

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  - [ ] LRU cache integrated into Discover API route
  - [ ] LRU cache integrated into SQL Console query route
  - [ ] Tests created: `test/cache/lru-integration.test.ts`
  - [ ] `bun test test/cache/lru-integration.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  > **This is NOT optional. A task without QA scenarios WILL BE REJECTED.**
  >
  > Write scenario tests that verify the ACTUAL BEHAVIOR of what you built.
  > Minimum: 1 happy path + 1 failure/edge case per task.
  > Each scenario = exact tool + exact steps + exact assertions + evidence path.
  >
  > **The executing agent MUST run these scenarios after implementation.**
  > **The orchestrator WILL verify evidence files exist before marking task complete.**

  ```
  Scenario: Cache hit works correctly
    Tool: Bash (curl)
    Preconditions: LRU cache integrated, cache empty
    Steps:
      1. Execute query: POST /api/clickhouse/discover with query="SELECT * FROM system.numbers LIMIT 10"
      2. Verify query executes and returns data
      3. Execute same query again
      4. Verify response time is faster (cache hit)
      5. Verify response data is identical
    Expected Result: Cache hit returns data faster, data is identical
    Failure Indicators: Cache miss on second query, data differs
    Evidence: .sisyphus/evidence/task-28-cache-hit.log

  Scenario: Cache miss works correctly
    Tool: Bash (curl)
    Preconditions: LRU cache integrated, cache empty
    Steps:
      1. Execute query: POST /api/clickhouse/discover with query="SELECT * FROM system.numbers LIMIT 10"
      2. Verify query executes and returns data
      3. Execute different query: POST /api/clickhouse/discover with query="SELECT * FROM system.numbers LIMIT 20"
      4. Verify query executes (not from cache)
      5. Verify response data is different
    Expected Result: Cache miss executes query, returns different data
    Failure Indicators: Cache hit on different query, data identical
    Evidence: .sisyphus/evidence/task-28-cache-miss.log

  Scenario: Cache eviction works correctly
    Tool: Bash (bun)
    Preconditions: LRU cache configured with 500 entries
    Steps:
      1. Execute 501 different queries
      2. Verify first query is evicted from cache
      3. Execute first query again
      4. Verify query executes (not from cache)
    Expected Result: Oldest entry evicted when cache full
    Failure Indicators: First query still cached, cache size exceeds limit
    Evidence: .sisyphus/evidence/task-28-eviction.log
  ```

  **Evidence to Capture**:
  - [ ] Cache integration code
  - [ ] Test output
  - [ ] Cache hit/miss logs
  - [ ] Cache eviction logs

  **Commit**: YES
  - Message: `feat(cache): integrate LRU cache into query routes`
  - Files: `src/app/api/clickhouse/discover/route.ts`, `src/app/api/clickhouse/query/route.ts`
  - Pre-commit: `bun test test/cache/lru-integration.test.ts`

- [x] 29. **Redis Cache Integration**

  **What to do**:
  - Integrate Redis cache into query routes (already implemented in Task 6)
  - Add Redis cache middleware to Discover API route
  - Add Redis cache middleware to SQL Console query route
  - Implement Redis cache lookup before LRU cache
  - Implement Redis cache storage after query execution
  - Configure Redis TTL (60 seconds from Task 6)
  - Implement Redis error handling and fallback to LRU
  - Write integration tests for Redis cache

  **Must NOT do**:
  - Do NOT break LRU cache fallback - Redis should enhance, not replace
  - Do NOT cache sensitive data (PII, credentials)

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `deep`
    - Reason: Redis integration requires understanding distributed caching and error handling
  - **Skills**: []
    - No special skills needed - standard Redis integration patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is standard Redis integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 28, 30-33)
  - **Blocks**: Tasks 34, 35, 36
  - **Blocked By**: Task 6

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/cache/redis-cache.ts` - Redis cache implementation from Task 6
  - `/src/app/api/clickhouse/discover/route.ts` - Discover API route to integrate Redis
  - `/src/app/api/clickhouse/query/route.ts` - SQL Console query route to integrate Redis

  **API/Type References** (contracts to implement against):
  - `/src/lib/cache/key-generator.ts` - Cache key generation from Task 5

  **Test References** (testing patterns to follow):
  - Integration testing patterns with bun test

  **External References** (libraries and frameworks):
  - ioredis documentation: https://github.com/luin/ioredis

  **WHY Each Reference Matters** (explain the relevance):
  - Redis cache implementation: Need to understand Redis API (get, set, delete)
  - API routes: Need to understand query flow to insert Redis middleware
  - Key generator: Need to use consistent cache keys

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  - [ ] Redis cache integrated into Discover API route
  - [ ] Redis cache integrated into SQL Console query route
  - [ ] Redis fallback to LRU implemented
  - [ ] Tests created: `test/cache/redis-integration.test.ts`
  - [ ] `bun test test/cache/redis-integration.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  > **This is NOT optional. A task without QA scenarios WILL BE REJECTED.**
  >
  > Write scenario tests that verify the ACTUAL BEHAVIOR of what you built.
  > Minimum: 1 happy path + 1 failure/edge case per task.
  > Each scenario = exact tool + exact steps + exact assertions + evidence path.
  >
  > **The executing agent MUST run these scenarios after implementation.**
  > **The orchestrator WILL verify evidence files exist before marking task complete.**

  ```
  Scenario: Redis cache works correctly
    Tool: Bash (curl)
    Preconditions: Redis cache integrated, Redis running, cache empty
    Steps:
      1. Execute query: POST /api/clickhouse/discover with query="SELECT * FROM system.numbers LIMIT 10"
      2. Verify query executes and returns data
      3. Execute same query again
      4. Verify response time is faster (Redis cache hit)
      5. Verify response data is identical
    Expected Result: Redis cache hit returns data faster, data is identical
    Failure Indicators: Redis cache miss on second query, data differs
    Evidence: .sisyphus/evidence/task-29-redis-hit.log

  Scenario: Redis fallback to LRU works correctly
    Tool: Bash (curl)
    Preconditions: Redis cache integrated, Redis stopped
    Steps:
      1. Execute query: POST /api/clickhouse/discover with query="SELECT * FROM system.numbers LIMIT 10"
      2. Verify query executes and returns data (fallback to LRU)
      3. Execute same query again
      4. Verify response time is faster (LRU cache hit)
      5. Verify no Redis errors in logs
    Expected Result: Fallback to LRU works seamlessly, no errors
    Failure Indicators: Query fails, Redis errors in logs
    Evidence: .sisyphus/evidence/task-29-fallback.log
  ```

  **Evidence to Capture**:
  - [ ] Redis integration code
  - [ ] Test output
  - [ ] Redis cache hit logs
  - [ ] Fallback logs

  **Commit**: YES
  - Message: `feat(cache): integrate Redis cache into query routes`
  - Files: `src/app/api/clickhouse/discover/route.ts`, `src/app/api/clickhouse/query/route.ts`
  - Pre-commit: `bun test test/cache/redis-integration.test.ts`

- [x] 30. **Cache Key Generation**

  **What to do**:
  - Verify cache key generation works correctly (already implemented in Task 5)
  - Test that same query + params generates same key
  - Test that different query or params generates different key
  - Test that key generation is deterministic
  - Test that key generation handles special characters
  - Write tests for cache key generation

  **Must NOT do**:
  - Do NOT change key generation algorithm - already implemented in Task 5
  - Do NOT break existing cache keys

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Verification task with clear test cases
  - **Skills**: []
    - No special skills needed - standard testing patterns

  **Skills Evaluation**:
  - All skills: No domain overlap - this is straightforward verification

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 28-29, 31-33)
  - **Blocks**: Tasks 34, 35, 36
  - **Blocked By**: Task 5

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `/src/lib/cache/key-generator.ts` - Cache key generation from Task 5

  **Test References** (testing patterns to follow):
  - Unit testing patterns with bun test

  **External References** (libraries and frameworks):
  - None - using existing implementation

  **WHY Each Reference Matters** (explain the relevance):
  - Key generator: Need to understand key generation algorithm to test it

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.
  > Every criterion MUST be verifiable by running a command or using a tool.

  - [ ] Cache key generation verified
  - [ ] Tests created: `test/cache/key-generator.test.ts`
  - [ ] `bun test test/cache/key-generator.test.ts` → PASS

  **QA Scenarios (MANDATORY — task is INCOMPLETE without these):**

  > **This is NOT optional. A task without QA scenarios WILL BE REJECTED.**
  >
  > Write scenario tests that verify the ACTUAL BEHAVIOR of what you built.
  > Minimum: 1 happy path + 1 failure/edge case per task.
  > Each scenario = exact tool + exact steps + exact assertions + evidence path.
  >
  > **The executing agent MUST run these scenarios after implementation.**
  > **The orchestrator WILL verify evidence files exist before marking task complete.**

  ```
  Scenario: Same query+params generates same key
    Tool: Bash (bun)
    Preconditions: Key generator imported
    Steps:
      1. Generate key for query="SELECT * FROM table", params={limit: 10}
      2. Generate key for same query and params
      3. Verify keys are identical
    Expected Result: Same input produces same key
    Failure Indicators: Keys differ for same input
    Evidence: .sisyphus/evidence/task-30-same-key.log

  Scenario: Different query or params generates different key
    Tool: Bash (bun)
    Preconditions: Key generator imported
    Steps:
      1. Generate key for query="SELECT * FROM table", params={limit: 10}
      2. Generate key for query="SELECT * FROM table", params={limit: 20}
      3. Verify keys are different
      4. Generate key for query="SELECT * FROM other_table", params={limit: 10}
      5. Verify key is different from first key
    Expected Result: Different input produces different key
    Failure Indicators: Keys are identical for different input
    Evidence: .sisyphus/evidence/task-30-different-key.log
  ```

  **Evidence to Capture**:
  - [ ] Test output
  - [ ] Key generation logs

  **Commit**: YES
  - Message: `feat(cache): verify cache key generation`
  - Files: `test/cache/key-generator.test.ts`
  - Pre-commit: `bun test test/cache/key-generator.test.ts`

- [x] 31. **Cache Invalidation**

  **What to do**: Implement cache invalidation strategies (TTL-based, manual invalidation)
  **Category**: `deep`, **Skills**: []
  **Parallelization**: Wave 5, **Blocks**: Tasks 34, 35, 36, **Blocked By**: Task 28, Task 29
  **References**: `/src/lib/cache/invalidation.ts`
  **Acceptance**: [ ] Cache invalidation implemented, [ ] Tests: `test/cache/invalidation.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Cache invalidates on TTL
    Tool: Bash (bun)
    Preconditions: Cache configured with 5s TTL
    Steps:
      1. Execute query and cache result
      2. Wait 6 seconds
      3. Execute same query
      4. Verify cache miss (query executes again)
    Expected Result: Cache entry expires after TTL
    Failure Indicators: Cache hit after TTL expired
    Evidence: .sisyphus/evidence/task-31-ttl.log

  Scenario: Manual invalidation works
    Tool: Bash (bun)
    Preconditions: Cache has entries
    Steps:
      1. Execute query and cache result
      2. Manually invalidate cache entry
      3. Execute same query
      4. Verify cache miss (query executes again)
    Expected Result: Manual invalidation removes cache entry
    Failure Indicators: Cache hit after manual invalidation
    Evidence: .sisyphus/evidence/task-31-manual.log
  ```

  **Commit**: YES, Message: `feat(cache): implement cache invalidation`

- [x] 32. **Redis Fallback**

  **What to do**: Implement Redis fallback to LRU when Redis unavailable
  **Category**: `quick`, **Skills`: []
  **Parallelization**: Wave 5, **Blocks**: Tasks 34, 35, 36, **Blocked By**: Task 29
  **References**: `/src/lib/cache/fallback.ts`
  **Acceptance**: [ ] Redis fallback implemented, [ ] Tests: `test/cache/fallback.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Fallback to LRU when Redis down
    Tool: Bash (curl)
    Preconditions: Redis stopped
    Steps:
      1. Execute query
      2. Verify query succeeds (fallback to LRU)
      3. Verify no Redis errors in logs
    Expected Result: Fallback works seamlessly, no errors
    Failure Indicators: Query fails, Redis errors
    Evidence: .sisyphus/evidence/task-32-fallback.log
  ```

  **Commit**: YES, Message: `feat(cache): add Redis fallback`

- [x] 33. **Cache Warming**

  **What to do**: Implement cache warming for frequent queries
  **Category**: `quick`, **Skills`: []
  **Parallelization**: Wave 5, **Blocks**: Tasks 34, 35, 36, **Blocked By**: Task 28, Task 29
  **References**: `/src/lib/cache/warming.ts`
  **Acceptance**: [ ] Cache warming implemented, [ ] Tests: `test/cache/warming.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Frequent queries cached on startup
    Tool: Bash (bun)
    Preconditions: Cache warming configured
    Steps:
      1. Start application
      2. Verify frequent queries executed and cached
      3. Execute frequent query
      4. Verify cache hit (query not executed)
    Expected Result: Cache warming populates cache, improves hit rate
    Failure Indicators: Cache empty on startup, queries not cached
    Evidence: .sisyphus/evidence/task-33-warming.log
  ```

  **Commit**: YES, Message: `feat(cache): implement cache warming`

- [x] 34. **Discover Page Migration to New Architecture**

  **What to do**: Migrate Discover page to use Zustand stores, virtualized tables, hybrid queries, caching
  **Category**: `deep`, **Skills`: []
  **Parallelization**: Wave 6, **Blocks**: F1-F4, **Blocked By**: Tasks 8-14, 15-20, 21-27, 28-33
  **References**: `/src/app/(app)/discover/page.tsx`, `/src/stores/discover/`, `/src/components/discover/VirtualizedDiscoverGrid.tsx`
  **Acceptance**: [ ] Discover page migrated, [ ] Tests: `test/discover/migration.test.tsx` → PASS

  **QA Scenarios**:
  ```
  Scenario: Discover page works with new architecture
    Tool: Playwright
    Preconditions: Discover page migrated
    Steps:
      1. Navigate to Discover page
      2. Execute search query
      3. Verify results display correctly
      4. Verify virtualization works (scroll smoothly)
      5. Verify caching works (second query faster)
      6. Verify all features functional (sort, filter, expand)
    Expected Result: All features work with new architecture
    Failure Indicators: Features broken, performance degraded
    Evidence: .sisyphus/evidence/task-34-discover.mp4
  ```

  **Commit**: YES, Message: `refactor(discover): migrate to new architecture`

- [x] 35. **SQL Console Migration to New Architecture**

  **What to do**: Migrate SQL Console to use Zustand stores, virtualized tables, hybrid queries, caching
  **Category**: `deep`, **Skills`: []
  **Parallelization**: Wave 6, **Blocks**: F1-F4, **Blocked By**: Tasks 11-14, 15-20, 21-27, 28-33
  **References**: `/src/app/(app)/sql/page.tsx`, `/src/stores/sql/`, `/src/components/sql/VirtualizedResultGrid.tsx`
  **Acceptance**: [ ] SQL Console migrated, [ ] Tests: `test/sql/migration.test.tsx` → PASS

  **QA Scenarios**:
  ```
  Scenario: SQL Console works with new architecture
    Tool: Playwright
    Preconditions: SQL Console migrated
    Steps:
      1. Navigate to SQL Console
      2. Execute query
      3. Verify results display correctly
      4. Verify virtualization works (scroll smoothly)
      5. Verify caching works (second query faster)
      6. Verify all features functional (tabs, history, save)
    Expected Result: All features work with new architecture
    Failure Indicators: Features broken, performance degraded
    Evidence: .sisyphus/evidence/task-35-sql.mp4
  ```

  **Commit**: YES, Message: `refactor(sql): migrate to new architecture`

- [ ] 36. **API Route Updates for Hybrid Queries**

  **What to do**: Update API routes to support hybrid query execution (streaming + parallel count/aggs)
  **Category**: `deep`, **Skills**: []
  **Parallelization**: Wave 6, **Blocks**: F1-F4, **Blocked By**: Tasks 21-27, 28-33
  **References**: `/src/app/api/clickhouse/discover/route.ts`, `/src/app/api/clickhouse/query/route.ts`
  **Acceptance**: [ ] API routes updated, [ ] Tests: `test/api/hybrid-queries.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Hybrid query streams data immediately
    Tool: Bash (curl)
    Preconditions: API routes updated for hybrid queries
    Steps:
      1. Execute query via API
      2. Verify streaming response starts immediately (< 100ms)
      3. Verify data chunks arrive progressively
      4. Verify count/aggregation queries run in parallel
    Expected Result: Streaming starts immediately, parallel queries execute
    Failure Indicators: Delayed streaming, sequential query execution
    Evidence: .sisyphus/evidence/task-36-streaming.log

  Scenario: Parallel count/aggregations complete
    Tool: Bash (curl)
    Preconditions: Hybrid query API configured
    Steps:
      1. Execute query with count and aggregations
      2. Verify count query completes
      3. Verify aggregation queries complete
      4. Verify results combined correctly
    Expected Result: All parallel queries complete and results merged
    Failure Indicators: Missing count/aggregation results, incorrect merging
    Evidence: .sisyphus/evidence/task-36-parallel.log
  ```

  **Commit**: YES, Message: `refactor(api): update routes for hybrid queries`

- [ ] 37. **RBAC Integration with New Architecture**

  **What to do**: Integrate existing RBAC with new architecture (ensure all queries still pass RBAC checks)
  **Category**: `quick`, **Skills**: []
  **Parallelization**: Wave 6, **Blocks**: F1-F4, **Blocked By**: Tasks 34, 35, 36
  **References**: `/src/lib/auth/authorization.ts`
  **Acceptance**: [ ] RBAC integrated, [ ] Tests: `test/auth/rbac-integration.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Authorized queries succeed
    Tool: Playwright
    Preconditions: User has RBAC permissions for table
    Steps:
      1. Login as authorized user
      2. Navigate to Discover page
      3. Execute query on authorized table
      4. Verify query succeeds
      5. Verify results displayed
    Expected Result: Authorized queries execute successfully
    Failure Indicators: Query fails with permission error
    Evidence: .sisyphus/evidence/task-37-authorized.mp4

  Scenario: Unauthorized queries blocked
    Tool: Playwright
    Preconditions: User lacks RBAC permissions for table
    Steps:
      1. Login as unauthorized user
      2. Navigate to Discover page
      3. Attempt query on restricted table
      4. Verify query blocked
      5. Verify permission error displayed
    Expected Result: Unauthorized queries blocked with clear error
    Failure Indicators: Query succeeds (security breach), unclear error
    Evidence: .sisyphus/evidence/task-37-unauthorized.mp4

  Scenario: RBAC applies to cached queries
    Tool: Bash (curl)
    Preconditions: Cache has results from authorized user
    Steps:
      1. Execute query as authorized user (cache result)
      2. Attempt same query as unauthorized user
      3. Verify cache not returned to unauthorized user
      4. Verify permission error
    Expected Result: RBAC enforced even for cached results
    Failure Indicators: Unauthorized user receives cached data
    Evidence: .sisyphus/evidence/task-37-cache-rbac.log
  ```

  **Commit**: YES, Message: `feat(rbac): integrate RBAC with new architecture`

- [ ] 38. **Error Handling and Graceful Degradation**

  **What to do**: Implement comprehensive error handling and graceful degradation for new architecture
  **Category**: `deep`, **Skills**: []
  **Parallelization**: Wave 6, **Blocks**: F1-F4, **Blocked By**: Tasks 34, 35, 36
  **References**: `/src/lib/error/handling.ts`
  **Acceptance**: [ ] Error handling implemented, [ ] Tests: `test/error/handling.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: Query errors handled gracefully
    Tool: Playwright
    Preconditions: Error handling implemented
    Steps:
      1. Navigate to Discover page
      2. Execute invalid query (syntax error)
      3. Verify error message displayed clearly
      4. Verify UI remains responsive
      5. Verify user can retry
    Expected Result: Errors shown clearly, UI remains functional
    Failure Indicators: UI crashes, unclear error, no retry option
    Evidence: .sisyphus/evidence/task-38-query-error.mp4

  Scenario: Cache failure falls back to query
    Tool: Bash (curl)
    Preconditions: Cache configured but failing
    Steps:
      1. Simulate cache failure (stop Redis)
      2. Execute query
      3. Verify query succeeds (fallback to direct execution)
      4. Verify no cache errors in response
    Expected Result: Graceful fallback, query succeeds despite cache failure
    Failure Indicators: Query fails, cache errors exposed to user
    Evidence: .sisyphus/evidence/task-38-cache-fallback.log

  Scenario: Virtualization failure degrades gracefully
    Tool: Playwright
    Preconditions: Virtualization configured
    Steps:
      1. Simulate virtualization error (large dataset, memory pressure)
      2. Verify fallback to non-virtualized rendering
      3. Verify data still displayed
      4. Verify warning shown to user
    Expected Result: Graceful degradation, data accessible with warning
    Failure Indicators: Data not displayed, UI crashes
    Evidence: .sisyphus/evidence/task-38-virtualization-fallback.mp4

  Scenario: Network errors handled with retry
    Tool: Bash (curl)
    Preconditions: Network unstable
    Steps:
      1. Execute query with network interruption
      2. Verify retry mechanism triggers
      3. Verify query succeeds after retry
      4. Verify retry count displayed to user
    Expected Result: Automatic retry, transparent to user
    Failure Indicators: Immediate failure, no retry, confusing error
    Evidence: .sisyphus/evidence/task-38-network-retry.log
  ```

  **Commit**: YES, Message: `feat(error): add error handling and graceful degradation`

- [ ] 39. **Loading States and Progress Indicators**

  **What to do**: Add loading states and progress indicators for hybrid queries (streaming, count, aggregations)
  **Category**: `visual-engineering`, **Skills**: [`frontend-design`]
  **Parallelization**: Wave 6, **Blocks**: F1-F4, **Blocked By**: Tasks 34, 35
  **References**: `/src/components/ui/loading.tsx`
  **Acceptance**: [ ] Loading states added, [ ] Tests: `test/ui/loading.test.tsx` → PASS

  **QA Scenarios**:
  ```
  Scenario: Streaming progress indicator shows
    Tool: Playwright
    Preconditions: Loading states implemented
    Steps:
      1. Navigate to Discover page
      2. Execute long-running query
      3. Verify loading spinner appears immediately
      4. Verify progress indicator updates as data streams
      5. Verify row count updates incrementally
    Expected Result: Clear visual feedback during streaming
    Failure Indicators: No loading state, static progress, confusing UI
    Evidence: .sisyphus/evidence/task-39-streaming-progress.mp4

  Scenario: Count query progress shown
    Tool: Playwright
    Preconditions: Hybrid queries configured
    Steps:
      1. Execute query with count
      2. Verify "Counting..." indicator shows
      3. Verify count updates when complete
      4. Verify indicator disappears after count completes
    Expected Result: Count progress clearly communicated
    Failure Indicators: No count indicator, count appears suddenly
    Evidence: .sisyphus/evidence/task-39-count-progress.mp4

  Scenario: Aggregation progress shown
    Tool: Playwright
    Preconditions: Hybrid queries configured
    Steps:
      1. Execute query with aggregations
      2. Verify "Aggregating..." indicator shows
      3. Verify aggregation results appear when complete
      4. Verify indicator disappears after aggregations complete
    Expected Result: Aggregation progress clearly communicated
    Failure Indicators: No aggregation indicator, results appear suddenly
    Evidence: .sisyphus/evidence/task-39-agg-progress.mp4

  Scenario: Multiple parallel queries show combined progress
    Tool: Playwright
    Preconditions: Hybrid queries with streaming + count + aggregations
    Steps:
      1. Execute complex query (streaming + count + aggregations)
      2. Verify all three progress indicators show simultaneously
      3. Verify each indicator updates independently
      4. Verify all indicators disappear when complete
    Expected Result: Combined progress for all parallel operations
    Failure Indicators: Missing indicators, indicators not independent
    Evidence: .sisyphus/evidence/task-39-combined-progress.mp4

  Scenario: Loading states disappear on completion
    Tool: Playwright
    Preconditions: Query in progress
    Steps:
      1. Execute query
      2. Verify loading states appear
      3. Wait for query completion
      4. Verify all loading states disappear
      5. Verify results displayed cleanly
    Expected Result: Clean UI state after completion
    Failure Indicators: Loading states persist, UI cluttered
    Evidence: .sisyphus/evidence/task-39-loading-complete.mp4
  ```

  **Commit**: YES, Message: `feat(ui): add loading states and progress indicators`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`

  **What to do**: Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.

  **Category**: `oracle`, **Skills**: []

  **Skills Evaluation**:
  - All other skills: No domain overlap - oracle is for plan verification

  **Parallelization**: Wave FINAL, **Blocks**: User approval, **Blocked By**: Tasks 34-39

  **References**: `.sisyphus/plans/clicklens-performance-refactor.md`

  **Acceptance Criteria**:
  - [ ] All "Must Have" verified present
  - [ ] All "Must NOT Have" verified absent
  - [ ] All tasks verified complete
  - [ ] Evidence files verified exist

  **QA Scenarios**:
  ```
  Scenario: Plan compliance verified
    Tool: Bash (grep, find)
    Steps:
      1. Read plan file
      2. For each "Must Have", verify implementation exists
      3. For each "Must NOT Have", search codebase
      4. Verify evidence files exist
    Expected Result: All requirements met, no violations
    Evidence: .sisyphus/evidence/F1-compliance-audit.log
  ```

  **Output**: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`

  **What to do**: Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).

  **Category**: `unspecified-high`, **Skills**: []

  **Skills Evaluation**:
  - All other skills: No domain overlap - code review is general

  **Parallelization**: Wave FINAL, **Blocks**: User approval, **Blocked By**: Tasks 34-39

  **References**: All changed files

  **Acceptance Criteria**:
  - [ ] Build passes (tsc --noEmit)
  - [ ] Lint passes
  - [ ] All tests pass
  - [ ] No code quality issues

  **QA Scenarios**:
  ```
  Scenario: Code quality verified
    Tool: Bash (tsc, lint, bun test)
    Steps:
      1. Run `bun run tsc --noEmit`
      2. Run `bun run lint`
      3. Run `bun test`
      4. Review changed files for issues
    Expected Result: All checks pass, no issues
    Evidence: .sisyphus/evidence/F2-code-quality.log
  ```

  **Output**: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)

  **What to do**: Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.

  **Category**: `unspecified-high`, **Skills**: [`playwright`]

  **Skills Evaluation**:
  - `playwright`: INCLUDED - QA requires browser automation
  - `brainstorming`: OMITTED - QA is execution, not creative
  - Other skills: No domain overlap

  **Parallelization**: Wave FINAL, **Blocks**: User approval, **Blocked By**: Tasks 34-39

  **References**: All QA scenarios from tasks 1-39

  **Acceptance Criteria**:
  - [ ] All QA scenarios executed
  - [ ] All scenarios pass
  - [ ] Integration tested
  - [ ] Edge cases tested

  **QA Scenarios**:
  ```
  Scenario: All QA scenarios pass
    Tool: Playwright, Bash (curl)
    Steps:
      1. Execute all QA scenarios from tasks 1-39
      2. Test cross-task integration
      3. Test edge cases
      4. Capture evidence
    Expected Result: All scenarios pass, integration works
    Evidence: .sisyphus/evidence/final-qa/
  ```

  **Output**: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`

  **What to do**: For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.

  **Category**: `deep`, **Skills**: []

  **Skills Evaluation**:
  - All other skills: No domain overlap - scope check is analytical

  **Parallelization**: Wave FINAL, **Blocks**: User approval, **Blocked By**: Tasks 34-39

  **References**: `.sisyphus/plans/clicklens-performance-refactor.md`, git log/diff

  **Acceptance Criteria**:
  - [ ] All tasks verified 1:1 with spec
  - [ ] No scope creep detected
  - [ ] No cross-task contamination
  - [ ] No unaccounted changes

  **QA Scenarios**:
  ```
  Scenario: Scope fidelity verified
    Tool: Bash (git log, git diff)
    Steps:
      1. For each task, read spec
      2. Read actual diff
      3. Verify 1:1 match
      4. Check for scope creep
      5. Check for cross-task contamination
    Expected Result: All tasks match spec, no creep
    Evidence: .sisyphus/evidence/F4-scope-fidelity.log
  ```

  **Output**: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `perf(baseline): measure current performance metrics` — scripts/benchmark.ts
- **2**: `test(infra): setup TDD infrastructure with bun test` — test/setup.ts, test/helpers.ts
- **3**: `feat(state): install and configure Zustand` — package.json, zustand.config.ts
- **4**: `feat(virtual): install @tanstack/react-virtual` — package.json, virtual.config.ts
- **5**: `feat(cache): implement in-memory LRU cache` — src/lib/cache/lru-cache.ts
- **6**: `feat(cache): integrate Redis cache layer` — src/lib/cache/redis-cache.ts
- **7**: `types: define architecture type definitions` — src/types/architecture.ts
- **8**: `refactor(state): create Discover query state store` — src/stores/discover/query-store.ts
- **9**: `refactor(state): create Discover data state store` — src/stores/discover/data-store.ts
- **10**: `refactor(state): create Discover UI state store` — src/stores/discover/ui-store.ts
- **11**: `refactor(state): create SQL Console query state store` — src/stores/sql/query-store.ts
- **12**: `refactor(state): create SQL Console data state store` — src/stores/sql/data-store.ts
- **13**: `refactor(state): create SQL Console UI state store` — src/stores/sql/ui-store.ts
- **14**: `refactor(state): implement state migration utilities` — src/lib/state/migration.ts
- **15**: `feat(virtual): implement VirtualizedResultGrid` — src/components/sql/VirtualizedResultGrid.tsx
- **16**: `feat(virtual): implement VirtualizedDiscoverGrid` — src/components/discover/VirtualizedDiscoverGrid.tsx
- **17**: `feat(virtual): measure and configure row heights` — src/lib/virtual/row-height.ts
- **18**: `feat(virtual): add accessibility to virtualized tables` — src/components/virtual/accessibility.tsx
- **19**: `feat(virtual): handle virtualization edge cases` — src/lib/virtual/edge-cases.ts
- **20**: `perf(virtual): benchmark virtualization performance` — benchmarks/virtualization.ts
- **21**: `feat(query): implement hybrid query streaming` — src/app/api/clickhouse/discover/route.ts
- **22**: `feat(query): implement parallel count queries` — src/app/api/clickhouse/discover/route.ts
- **23**: `feat(query): implement parallel aggregation queries` — src/app/api/clickhouse/discover/route.ts
- **24**: `feat(query): add approximate count with HLL` — src/lib/clickhouse/approx-count.ts
- **25**: `feat(query): add exact count query option` — src/lib/clickhouse/exact-count.ts
- **26**: `feat(query): implement query cancellation` — src/lib/clickhouse/cancellation.ts
- **27**: `feat(query): add query timeout handling` — src/lib/clickhouse/timeout.ts
- **28**: `feat(cache): implement in-memory LRU cache` — src/lib/cache/lru-cache.ts
- **29**: `feat(cache): integrate Redis cache` — src/lib/cache/redis-cache.ts
- **30**: `feat(cache): generate cache keys` — src/lib/cache/key-generator.ts
- **31**: `feat(cache): implement cache invalidation` — src/lib/cache/invalidation.ts
- **32**: `feat(cache): add Redis fallback` — src/lib/cache/fallback.ts
- **33**: `feat(cache): implement cache warming` — src/lib/cache/warming.ts
- **34**: `refactor(discover): migrate to new architecture` — src/app/(app)/discover/page.tsx
- **35**: `refactor(sql): migrate to new architecture` — src/app/(app)/sql/page.tsx
- **36**: `refactor(api): update routes for hybrid queries` — src/app/api/clickhouse/discover/route.ts, src/app/api/clickhouse/query/route.ts
- **37**: `feat(rbac): integrate RBAC with new architecture` — src/lib/auth/authorization.ts
- **38**: `feat(error): add error handling and graceful degradation` — src/lib/error/handling.ts
- **39**: `feat(ui): add loading states and progress indicators` — src/components/ui/loading.tsx

---

## Success Criteria

### Verification Commands
```bash
# Performance benchmarks
bun run benchmark:virtualization  # Expected: 60fps scroll, <100ms render
bun run benchmark:query          # Expected: <5s query time
bun run benchmark:cache          # Expected: >30% cache hit rate

# Test suite
bun test                         # Expected: All tests pass, >80% coverage

# Memory leak test
bun run test:memory-leak         # Expected: No leaks after 1000 queries

# Type checking
bun run tsc --noEmit             # Expected: No errors

# Linting
bun run lint                     # Expected: No errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Performance targets met
- [ ] No memory leaks
- [ ] RBAC preserved
- [ ] Backward compatible
- [ ] Zero downtime deployment possible