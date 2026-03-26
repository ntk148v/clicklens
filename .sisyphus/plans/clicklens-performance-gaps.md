# ClickLens Performance Refactor — Implementation Gaps Fix

## TL;DR

> **Quick Summary**: Address 8 implementation gaps between the original performance refactor plan and actual source code. Focus on Zustand store integration, missing modules, cache consolidation, code cleanup, and test coverage.
>
> **Deliverables**:
> - SQL Console fully migrated to Zustand stores (removing legacy useTabsStore dependency)
> - HLL approximate count module for fast histogram counts
> - Reusable query cancellation module
> - Cache consolidation decision and implementation
> - Removal of dead code (old non-virtualized components)
> - Decomposed use-discover-page.ts hook
> - GROUP BY streaming documentation/improvement
> - Comprehensive test coverage for stores, virtualization, and cache
>
> **Estimated Effort**: Medium (8 focused tasks)
> **Parallel Execution**: YES - 3 waves with 2-4 tasks each
> **Critical Path**: Tests → Low-risk fixes → High-risk refactoring

---

## Context

### Original Request
Fix 8 implementation gaps identified in the ClickLens performance refactor:
1. SQL Console Zustand Stores Not Integrated
2. Missing HLL Approximate Count
3. Missing Cancellation Module
4. Duplicate Cache Implementations
5. Remove Old Non-Virtualized Components
6. Decompose use-discover-page.ts (910 lines)
7. GROUP BY Path Not Truly Streaming
8. Add Missing Tests

### Current State Analysis

**Issue 1 - SQL Console Zustand**: `use-sql-page.ts` imports both `useTabsStore` (line 6) and new Zustand stores (lines 10-12), creating a dual-store pattern. **Key insight**: Both use Zustand - the issue is consolidating overlapping functionality, not migrating from "legacy" to "new". `useTabsStore` has tab management + history + persistence; new stores split these concerns.

**Issue 2 - HLL Approx Count**: `src/lib/clickhouse/approx-count.ts` does not exist. The API route's "approximate" path runs raw `count()` queries without HLL optimization.

**Issue 3 - Cancellation Module**: AbortController usage is scattered inline across hooks instead of using a reusable `QueryCancellationManager` class.

**Issue 4 - Duplicate Caches**: Two cache systems exist:
- `HybridCache` (Redis + in-memory LRU, async) - used for metadata/monitoring/tables
- `QueryCache` (LRU with Redis fallback, sync) - used for query results
**Decision**: Keep both with clear documentation - they serve different purposes.

**Issue 5 - Old Components**: `DiscoverGrid.tsx` and `ResultGrid.tsx` (non-virtualized) exist alongside `VirtualizedDiscoverGrid.tsx` and `VirtualizedResultGrid.tsx`. Need to verify if old components are still used.

**Issue 6 - Monolithic Hook**: `use-discover-page.ts` is 909 lines combining URL parsing, schema loading, data fetching, histogram fetching, cache tracking, and state management.

**Issue 7 - GROUP BY Streaming**: In `discover/route.ts` lines 428-455, GROUP BY branch fetches entire result then emits rows one-by-one. This is acceptable for aggregated results (typically <1000 rows).

**Issue 8 - Missing Tests**: Tests exist in `test/stores/` but need verification of coverage and addition of virtualization component tests.

### Metis Review Findings

**Identified Gaps (addressed in plan)**:
- **Risk Assessment**: Issue 6 (hook decomposition) is HIGH risk; Issues 2, 3, 5, 8 are LOW risk; Issue 5 is MEDIUM risk (both stores use Zustand)
- **Scope Creep Prevention**: Explicit "no new features" rule, behavior-preserving refactoring only
- **Validation Requirements**: Import search before removing components
- **Test Strategy**: Establish safety net first (Issue 8), then proceed with refactoring

### Momus High Accuracy Review Findings

**Critical Clarifications**:
1. **Issue 1 Revised**: Not a "legacy to Zustand" migration - both use Zustand. Focus on consolidating duplicate history tracking and removing dual-store pattern.
2. **Issue 4 Decision**: **KEEP BOTH** caches - document clear separation:
   - `HybridCache`: Server-side metadata, longer TTL, shared across instances
   - `QueryCache`: Query results, shorter TTL, key generation helpers
3. **Additional Considerations**:
   - History duplication between stores should be consolidated
   - Ensure tab persistence is maintained when consolidating
   - Focus on adding virtualization component tests

---

## Work Objectives

### Core Objective
Close the 8 implementation gaps between the performance refactor plan and actual codebase while maintaining backward compatibility and existing functionality.

### Concrete Deliverables
- [ ] SQL Console fully using Zustand stores (no legacy useTabsStore)
- [ ] `src/lib/clickhouse/approx-count.ts` with HLL implementation
- [ ] `src/lib/clickhouse/cancellation.ts` with QueryCancellationManager
- [ ] Cache consolidation decision documented and implemented
- [ ] Dead code removed (old grid components if unused)
- [ ] `use-discover-page.ts` decomposed into focused hooks
- [ ] GROUP BY streaming documented or improved
- [ ] Test coverage >80% for stores, virtualization, cache

### Definition of Done
- [ ] All 8 issues addressed with zero breaking changes
- [ ] `bun lint` passes with zero errors
- [ ] `bun run build` completes successfully
- [ ] `bun test` passes with all tests green
- [ ] No regression in existing functionality
- [ ] Code review approval (if high accuracy mode selected)

### Must Have
- Backward compatibility maintained
- All existing tests pass
- New tests for all added/modified functionality
- Performance metrics maintained or improved
- Clear documentation for architectural decisions

### Must NOT Have (Guardrails)
- **NO breaking changes** to existing API contracts
- **NO removal of features** without verification
- **NO new features** during refactoring (scope creep prevention)
- **NO behavior changes** during hook decomposition (pure refactoring)
- **NO cache consolidation** without performance metrics
- **NO component removal** without import verification

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: YES (bun test, existing test setup)
- **Automated tests**: YES (TDD for new modules, tests-after for refactoring)
- **Framework**: bun test
- **Coverage target**: >80% for new code

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Use Bash (bun test) — Run tests, verify coverage

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — safety net + low-risk):
├── Task 1: Verify existing tests and add missing store tests [quick]
├── Task 2: Create query cancellation module [quick]
├── Task 3: Create HLL approximate count module [quick]
└── Task 4: Search and remove dead code (old grid components) [quick]

Wave 2 (After Wave 1 — medium-risk changes):
├── Task 5: Consolidate SQL Console state management (remove useTabsStore) [unspecified-high]
├── Task 6: Make cache consolidation decision and implement [unspecified-high]
└── Task 7: Document/improve GROUP BY streaming [quick]

Wave 3 (After Wave 2 — high-risk refactoring):
└── Task 8: Decompose use-discover-page.ts into focused hooks [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → F1-F4 → user okay
Parallel Speedup: ~40% faster than sequential
Max Concurrent: 4 (Wave 1)
```

### Dependency Matrix

- **1**: — — 5, 8, 1
- **2**: — — 5, 8, 1
- **3**: — — 6, 2
- **4**: — — 2
- **5**: 1, 2 — 8, 3
- **6**: 1, 3 — 8, 2
- **7**: 1 — 8, 1
- **8**: 1, 5, 6, 7 — F1-F4, 4

### Agent Dispatch Summary

- **1**: **4** — T1 → `quick`, T2 → `quick`, T3 → `quick`, T4 → `quick`
- **2**: **3** — T5 → `unspecified-high`, T6 → `unspecified-high`, T7 → `quick`
- **3**: **1** — T8 → `deep`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [ ] 1. **Verify Existing Tests and Add Missing Store Tests**

  **What to do**:
  - Verify existing store tests in `test/stores/discover/` and `test/stores/sql/`:
    - `query-store.test.ts` - test all actions, selectors, reset
    - `data-store.test.ts` - test row management, loading states
    - `ui-store.test.ts` - test UI state management
  - Check current test coverage with `bun test --coverage`
  - Add any missing test cases for edge cases:
    - Store reset functionality
    - Persistence behavior
    - Selector memoization
    - Error state handling
  - Verify `src/lib/cache/query-cache.test.ts` covers:
    - `generateDiscoverKey` function
    - `executeWithCache` helper
    - Glob pattern invalidation (`*` and `?`)
  - Create missing tests for virtualization components:
    - `VirtualizedDiscoverGrid` rendering
    - `VirtualizedResultGrid` rendering
    - Scroll behavior
    - Row height calculations

  **Must NOT do**:
  - Do NOT modify store implementations (only tests)
  - Do NOT change existing test patterns without justification
  - Do NOT skip tests for "trivial" functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test verification and addition is straightforward
  - **Skills**: [`test-driven-development`]
    - TDD skill: Ensures proper test structure and coverage

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8 (safety net must exist first)
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `test/stores/discover/query-store.test.ts` - Existing test patterns
  - `test/stores/discover/data-store.test.ts` - Existing test patterns
  - `test/stores/sql/query-store.test.ts` - Existing test patterns
  - `test/stores/sql/data-store.test.ts` - Existing test patterns
  - `src/lib/cache/query-cache.test.ts` - Cache test patterns

  **API/Type References**:
  - `src/stores/discover/query-store.ts` - Store interface
  - `src/stores/discover/data-store.ts` - Store interface
  - `src/stores/sql/query-store.ts` - Store interface
  - `src/stores/sql/data-store.ts` - Store interface
  - `src/lib/cache/query-cache.ts` - Cache interface

  **External References**:
  - bun test documentation: https://bun.sh/docs/test/writing

  **Acceptance Criteria**:
  - [ ] All existing store tests pass: `bun test test/stores/` → PASS
  - [ ] Test coverage report generated: `bun test --coverage` → coverage report
  - [ ] Coverage for stores >80% (check coverage report)
  - [ ] Cache tests verify `generateDiscoverKey`, `executeWithCache`, glob invalidation
  - [ ] New virtualization component tests created (if gaps found)

  **QA Scenarios**:
  ```
  Scenario: All store tests pass
    Tool: Bash (bun test)
    Preconditions: None
    Steps:
      1. Run `bun test test/stores/`
      2. Verify all tests pass
      3. Check no test failures or errors
    Expected Result: All tests pass with 0 failures
    Evidence: .sisyphus/evidence/task-1-store-tests.log

  Scenario: Coverage meets threshold
    Tool: Bash (bun test)
    Preconditions: None
    Steps:
      1. Run `bun test --coverage test/stores/`
      2. Parse coverage output
      3. Verify coverage >80% for store files
    Expected Result: Coverage report shows >80% for all store files
    Evidence: .sisyphus/evidence/task-1-coverage.json
  ```

  **Commit**: YES
  - Message: `test(stores): verify and enhance store test coverage`
  - Files: `test/stores/**/*.test.ts`, `src/lib/cache/query-cache.test.ts`
  - Pre-commit: `bun test test/stores/`

- [ ] 2. **Create Query Cancellation Module**

  **What to do**:
  - Create `src/lib/clickhouse/cancellation.ts` with `QueryCancellationManager` class:
    ```typescript
    export class QueryCancellationManager {
      private controllers: Map<string, AbortController>;
      cancel(queryId: string): void;
      createController(queryId: string): AbortController;
      cancelAll(): void;
      isActive(queryId: string): boolean;
    }
    ```
  - Implement proper cleanup to prevent memory leaks
  - Add TypeScript types and JSDoc comments
  - Create comprehensive tests in `src/lib/clickhouse/cancellation.test.ts`:
    - Test creating controllers
    - Test cancellation by query ID
    - Test cancelAll functionality
    - Test isActive check
    - Test memory cleanup after cancellation
  - Refactor `src/lib/hooks/use-discover-page.ts` to use `QueryCancellationManager`:
    - Replace `dataAbortRef` and `histAbortRef` with cancellation manager
    - Update `cancelQuery` function
    - Update `fetchData` to use manager
    - Update `fetchHistogram` to use manager
  - Refactor `src/lib/hooks/use-sql-page.ts` to use `QueryCancellationManager`:
    - Identify AbortController usage
    - Replace with cancellation manager pattern

  **Must NOT do**:
  - Do NOT change cancellation behavior (only implementation)
  - Do NOT break existing abort signal propagation
  - Do NOT introduce race conditions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-defined module with clear interface
  - **Skills**: [`test-driven-development`]
    - TDD skill: Write tests first for cancellation scenarios

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 5 (refactoring hooks)
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `src/lib/hooks/use-discover-page.ts:195-196` - Current AbortController usage
  - `src/lib/hooks/use-discover-page.ts:252-259` - Current cancelQuery implementation
  - `src/lib/hooks/use-sql-page.ts` - Search for AbortController usage

  **API/Type References**:
  - AbortController Web API documentation

  **Acceptance Criteria**:
  - [ ] `src/lib/clickhouse/cancellation.ts` created with full implementation
  - [ ] `src/lib/clickhouse/cancellation.test.ts` created with comprehensive tests
  - [ ] `bun test src/lib/clickhouse/cancellation.test.ts` → PASS
  - [ ] `use-discover-page.ts` refactored to use QueryCancellationManager
  - [ ] `use-sql-page.ts` refactored to use QueryCancellationManager
  - [ ] All existing tests still pass

  **QA Scenarios**:
  ```
  Scenario: Cancellation module works correctly
    Tool: Bash (bun test)
    Preconditions: None
    Steps:
      1. Run `bun test src/lib/clickhouse/cancellation.test.ts`
      2. Verify all tests pass
      3. Check coverage >80%
    Expected Result: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-2-cancellation-tests.log

  Scenario: Refactored hooks still cancel queries
    Tool: Bash (bun test)
    Preconditions: Cancellation module implemented
    Steps:
      1. Run all hook-related tests
      2. Verify no regressions
      3. Check discover and SQL page functionality
    Expected Result: All tests pass, no regressions
    Evidence: .sisyphus/evidence/task-2-hook-regression.log
  ```

  **Commit**: YES
  - Message: `feat(clickhouse): add query cancellation module`
  - Files: `src/lib/clickhouse/cancellation.ts`, `src/lib/clickhouse/cancellation.test.ts`, `src/lib/hooks/use-discover-page.ts`, `src/lib/hooks/use-sql-page.ts`
  - Pre-commit: `bun test src/lib/clickhouse/cancellation.test.ts`

- [ ] 3. **Create HLL Approximate Count Module**

  **What to do**:
  - Create `src/lib/clickhouse/approx-count.ts` implementing:
    ```typescript
    interface ApproxCountOptions {
      client: ClickHouseClient;
      database: string;
      table: string;
      whereConditions?: string[];
      clusterName?: string | null;
      isDistributed?: boolean;
    }

    interface ApproxCountResult {
      count: number;
      isApproximate: boolean;
      accuracy: number; // 0-1, where 1 is exact
    }

    export async function executeApproxCount(
      options: ApproxCountOptions
    ): Promise<ApproxCountResult>;
    ```
  - Implementation strategy:
    - Use `uniqCombined64` for approximate counts on large tables
    - Use `count()` with `SAMPLE` clause as fallback
    - Threshold: Use approximate for tables >1M rows
    - Return accuracy indicator (0.97 for uniqCombined64)
  - Create comprehensive tests in `src/lib/clickhouse/approx-count.test.ts`:
    - Test approximate count execution
    - Test exact count fallback for small tables
    - Test accuracy calculation
    - Test error handling
  - Update `src/app/api/clickhouse/discover/route.ts`:
    - Import `executeApproxCount`
    - Use when `useExactCount` is false
    - Pass approximate count result with metadata
  - Update UI to show "~" prefix or "(approx)" indicator when approximate

  **Must NOT do**:
  - Do NOT use approximate counts for small tables (<100K rows)
  - Do NOT break exact count functionality
  - Do NOT change default behavior (exact count should remain default)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-defined utility with clear requirements
  - **Skills**: [`test-driven-development`]
    - TDD skill: Test different table sizes and accuracy scenarios

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 6 (API route updates)
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `src/lib/clickhouse/exact-count.ts` - Similar module structure
  - `src/app/api/clickhouse/discover/route.ts:405-420` - Current count implementation

  **API/Type References**:
  - ClickHouse HLL functions: https://clickhouse.com/docs/en/sql-reference/aggregate-functions/reference/uniqcombined64

  **External References**:
  - ClickHouse approximate count documentation

  **Acceptance Criteria**:
  - [ ] `src/lib/clickhouse/approx-count.ts` created with full implementation
  - [ ] `src/lib/clickhouse/approx-count.test.ts` created with comprehensive tests
  - [ ] `bun test src/lib/clickhouse/approx-count.test.ts` → PASS
  - [ ] API route updated to use `executeApproxCount` when `useExactCount=false`
  - [ ] UI shows approximate indicator when using HLL counts

  **QA Scenarios**:
  ```
  Scenario: Approximate count module works
    Tool: Bash (bun test)
    Preconditions: None
    Steps:
      1. Run `bun test src/lib/clickhouse/approx-count.test.ts`
      2. Verify all tests pass
      3. Check coverage >80%
    Expected Result: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-3-approx-count-tests.log

  Scenario: API uses approximate count correctly
    Tool: Bash (curl)
    Preconditions: ClickHouse running with test data
    Steps:
      1. Call API with `exact=false` parameter
      2. Verify response includes approximate count
      3. Verify isApproximate flag is true
      4. Call API with `exact=true` parameter
      5. Verify exact count returned
    Expected Result: Approximate count used when exact=false, exact count when exact=true
    Evidence: .sisyphus/evidence/task-3-api-approx-count.json
  ```

  **Commit**: YES
  - Message: `feat(clickhouse): add HLL approximate count module`
  - Files: `src/lib/clickhouse/approx-count.ts`, `src/lib/clickhouse/approx-count.test.ts`, `src/app/api/clickhouse/discover/route.ts`
  - Pre-commit: `bun test src/lib/clickhouse/approx-count.test.ts`

- [ ] 4. **Search and Remove Dead Code (Old Grid Components)**

  **What to do**:
  - Search for all imports of `DiscoverGrid` (old non-virtualized):
    ```bash
    grep -r "import.*DiscoverGrid" --include="*.tsx" --include="*.ts" src/
    ```
  - Search for all imports of `ResultGrid` (old non-virtualized):
    ```bash
    grep -r "import.*ResultGrid" --include="*.tsx" --include="*.ts" src/
    ```
  - Verify `VirtualizedDiscoverGrid` and `VirtualizedResultGrid` are used instead
  - If old components are NOT imported anywhere:
    - Delete `src/components/discover/DiscoverGrid.tsx`
    - Delete `src/components/sql/ResultGrid.tsx`
    - Update `src/components/sql/index.ts` exports if needed
    - Delete associated test files if they exist
  - If old components ARE still imported:
    - Document where and why they're used
    - Add deprecation comments
    - Create migration plan for remaining usages
  - Run `bun run build` to verify no broken imports

  **Must NOT do**:
  - Do NOT delete components that are still in use
  - Do NOT break existing imports
  - Do NOT remove tests for components still in use

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Search and cleanup task
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `src/components/discover/DiscoverGrid.tsx` - Old component
  - `src/components/sql/ResultGrid.tsx` - Old component
  - `src/components/discover/VirtualizedDiscoverGrid.tsx` - New component
  - `src/components/sql/VirtualizedResultGrid.tsx` - New component
  - `src/components/sql/index.ts` - Export definitions

  **Acceptance Criteria**:
  - [ ] Import search completed with results documented
  - [ ] Old components deleted (if unused) OR documented (if used)
  - [ ] `bun run build` passes with no errors
  - [ ] All existing tests still pass
  - [ ] No broken imports in codebase

  **QA Scenarios**:
  ```
  Scenario: No broken imports after cleanup
    Tool: Bash (grep + build)
    Preconditions: None
    Steps:
      1. Run `grep -r "import.*DiscoverGrid" --include="*.tsx" src/` 
      2. Run `grep -r "import.*ResultGrid" --include="*.tsx" src/`
      3. Verify no imports of old components (unless documented)
      4. Run `bun run build`
      5. Verify build succeeds
    Expected Result: No imports of deleted components, build succeeds
    Evidence: .sisyphus/evidence/task-4-import-check.log

  Scenario: Virtualized components still work
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to Discover page
      2. Verify VirtualizedDiscoverGrid renders
      3. Navigate to SQL Console
      4. Verify VirtualizedResultGrid renders
    Expected Result: Virtualized components render correctly
    Evidence: .sisyphus/evidence/task-4-virtualized-screenshots.png
  ```

  **Commit**: YES
  - Message: `chore(components): remove dead code (old grid components)`
  - Files: `src/components/discover/DiscoverGrid.tsx`, `src/components/sql/ResultGrid.tsx` (if deleted)
  - Pre-commit: `bun run build`

- [ ] 5. **Consolidate SQL Console State Management (Remove Dual-Store Pattern)**

  **What to do**:
  - **IMPORTANT CLARIFICATION**: Both `useTabsStore` and new stores use Zustand. This is NOT a "legacy to Zustand" migration but a consolidation of overlapping functionality.
  - Analyze current state in `src/lib/hooks/use-sql-page.ts`:
    - Line 6: `useTabsStore` - manages tabs array, activeTabId, updateTab, history, with persistence
    - Line 10-12: New Zustand stores imported but tabs still use useTabsStore
    - Lines 149-153: Both stores used simultaneously, creating duplication
  - Identify overlapping concerns:
    - Both stores track query history (duplication)
    - `useTabsStore` has persistence; new stores don't
    - Tab management split between stores
  - Consolidation strategy:
    - Keep `useTabsStore` as the single source for tabs + history (it has persistence)
    - OR migrate persistence to new stores and remove useTabsStore
    - **Decision needed**: Choose consolidation approach
  - If migrating to new stores:
    - Add persistence to `src/stores/sql/data-store.ts` (using zustand persist middleware)
    - Add persistence to `src/stores/sql/query-store.ts` for history
    - Migrate all `useTabsStore` usage to new stores
    - Ensure all functionality preserved (tabs, history, persistence)
  - If keeping useTabsStore:
    - Remove new store imports from use-sql-page.ts
    - Consolidate history tracking to single store
    - Document the decision
  - Write integration tests to verify consolidation:
    - Test tab creation, switching, closing
    - Test query execution with tabs
    - Test history persistence across reloads

  **Must NOT do**:
  - Do NOT lose user data during consolidation
  - Do NOT break existing tab functionality
  - Do NOT change UI behavior (only implementation)
  - Do NOT lose persistence (tabs/history must survive reloads)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex refactoring with data migration risk
  - **Skills**: [`test-driven-development`, `systematic-debugging`]
    - TDD: Write tests for migration
    - Debugging: Handle edge cases and data migration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Task 8 (final integration)
  - **Blocked By**: Tasks 1, 2 (tests and cancellation module)

  **References**:
  **Pattern References**:
  - `src/lib/hooks/use-sql-page.ts:6-12` - Current store usage
  - `src/lib/hooks/use-sql-page.ts:148-180` - State initialization
  - `src/stores/sql/data-store.ts` - Target Zustand store
  - `src/stores/sql/query-store.ts` - Query history store
  - `src/lib/store/tabs.ts` - Legacy tabs store (see what to migrate)

  **API/Type References**:
  - `SqlPageState` interface in use-sql-page.ts
  - `SqlPageActions` interface in use-sql-page.ts
  - `TabData` interface in data-store.ts

  **Acceptance Criteria**:
  - [ ] `useTabsStore` completely removed from use-sql-page.ts
  - [ ] All tab operations use Zustand data-store
  - [ ] All query history uses Zustand query-store
  - [ ] Tab persistence works across reloads
  - [ ] All SQL Console functionality preserved
  - [ ] Integration tests pass
  - [ ] `bun test` passes

  **QA Scenarios**:
  ```
  Scenario: Tab management works with Zustand
    Tool: Playwright
    Preconditions: App running, SQL Console page
    Steps:
      1. Create new tab
      2. Verify tab appears in UI
      3. Switch between tabs
      4. Close a tab
      5. Verify tab removed
    Expected Result: All tab operations work correctly
    Evidence: .sisyphus/evidence/task-5-tab-management.png

  Scenario: Query history persists
    Tool: Playwright
    Preconditions: App running, SQL Console page
    Steps:
      1. Execute a query
      2. Open history panel
      3. Verify query appears in history
      4. Reload page
      5. Verify history still shows query
    Expected Result: History persists across reloads
    Evidence: .sisyphus/evidence/task-5-history-persistence.png

  Scenario: No useTabsStore references remain
    Tool: Bash (grep)
    Preconditions: Migration complete
    Steps:
      1. Run `grep -r "useTabsStore" --include="*.tsx" --include="*.ts" src/`
      2. Verify no references in SQL Console related files
      3. Check use-sql-page.ts specifically
    Expected Result: No useTabsStore usage in SQL Console
    Evidence: .sisyphus/evidence/task-5-no-legacy-store.log
  ```

  **Commit**: YES
  - Message: `refactor(sql): migrate tabs to Zustand store`
  - Files: `src/lib/hooks/use-sql-page.ts`, `src/stores/sql/data-store.ts`, `src/app/(app)/sql/page.tsx`
  - Pre-commit: `bun test`

- [ ] 6. **Make Cache Consolidation Decision and Implement**

  **What to do**:
  - Analyze both cache implementations:
    - `HybridCache` (`src/lib/cache/hybrid-cache.ts`):
      - Redis + in-memory LRU
      - Used in `src/lib/cache/index.ts` for metadata, monitoring, tables
      - Async interface
      - Key prefixing with cache name
    - `QueryCache` (`src/lib/cache/query-cache.ts`):
      - LRU with optional Redis fallback manager
      - Used in discover API for query results
      - Sync interface with async aliases
      - Cache key generation helpers
  - Decision criteria:
    - Performance: Measure hit rates for both
    - Use cases: Different purposes (metadata vs query results)
    - Complexity: Consolidation effort vs maintenance burden
    - Risk: Breaking existing functionality
  - **DECISION OPTIONS**:
    - **Option A - Keep Both**: Document clear separation of concerns
      - HybridCache: For metadata, monitoring, tables (longer TTL)
      - QueryCache: For query results (shorter TTL, key generation)
    - **Option B - Consolidate**: Merge HybridCache into QueryCache
      - Add async interface to QueryCache
      - Add key prefixing to QueryCache
      - Migrate all HybridCache usages
  - Implementation (if consolidating):
    - Enhance QueryCache with HybridCache features
    - Migrate `src/lib/cache/index.ts` to use QueryCache
    - Update all imports
    - Delete HybridCache files
  - Documentation (if keeping both):
    - Add README.md in `src/lib/cache/` explaining when to use each
    - Document clear separation of concerns
    - Add JSDoc to both classes
  - Tests:
    - Ensure all cache tests pass
    - Add integration tests for cache usage
    - Verify no regressions

  **Must NOT do**:
  - Do NOT consolidate without clear benefit
  - Do NOT break existing cache functionality
  - Do NOT lose cache invalidation patterns
  - Do NOT change cache behavior without metrics

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Architectural decision with implementation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Task 8 (final integration)
  - **Blocked By**: Tasks 1, 3 (tests and approx count)

  **References**:
  **Pattern References**:
  - `src/lib/cache/hybrid-cache.ts` - HybridCache implementation
  - `src/lib/cache/query-cache.ts` - QueryCache implementation
  - `src/lib/cache/index.ts` - HybridCache usage
  - `src/app/api/clickhouse/discover/route.ts` - QueryCache usage

  **Acceptance Criteria**:
  - [ ] **DECISION: KEEP BOTH** - Document clear separation of concerns
  - [ ] Create `src/lib/cache/README.md` documenting:
    - When to use HybridCache (metadata, monitoring, tables - server-side, longer TTL)
    - When to use QueryCache (query results - client-side, shorter TTL, key generation)
  - [ ] Add JSDoc to both classes explaining their purpose
  - [ ] All cache tests pass
  - [ ] No regressions in caching behavior
  - [ ] `bun test` passes

  **QA Scenarios**:
  ```
  Scenario: Cache documentation created
    Tool: Read (file)
    Preconditions: Documentation written
    Steps:
      1. Read `src/lib/cache/README.md`
      2. Verify clear usage guidelines
      3. Verify examples provided
    Expected Result: Documentation exists with clear guidance
    Evidence: .sisyphus/evidence/task-6-cache-readme.md

  Scenario: Cache functionality preserved
    Tool: Bash (bun test)
    Preconditions: Documentation complete
    Steps:
      1. Run `bun test src/lib/cache/`
      2. Verify all tests pass
      3. Check no cache-related failures
    Expected Result: All cache tests pass
    Evidence: .sisyphus/evidence/task-6-cache-tests.log
  ```

  **Commit**: YES
  - Message: `docs(cache): document cache usage guidelines`
  - Files: `src/lib/cache/README.md`, `src/lib/cache/hybrid-cache.ts`, `src/lib/cache/query-cache.ts`
  - Pre-commit: `bun test src/lib/cache/`

- [ ] 7. **Document/Improve GROUP BY Streaming**

  **What to do**:
  - Review current GROUP BY implementation in `src/app/api/clickhouse/discover/route.ts` lines 428-455:
    ```typescript
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(JSON.stringify({ meta: { totalHits: -1 } }) + "\n");
          const rs = await client.query(query);
          const rows = rs.data; // <-- This buffers entire result
          for (const row of rows) {
            controller.enqueue(JSON.stringify(row) + "\n");
          }
          const totalHits = await countPromise;
          controller.enqueue(JSON.stringify({ meta: { totalHits } }) + "\n");
        } catch (err) {
          controller.enqueue(JSON.stringify({ error: String(err) }) + "\n");
        } finally {
          controller.close();
        }
      },
    });
    ```
  - **DECISION**: GROUP BY results are typically small (<1000 rows) because they're aggregated. Buffering is acceptable for this use case.
  - Add explanatory comment:
    ```typescript
    // GROUP BY results are typically small (aggregated), so buffering is acceptable.
    // True streaming is only used for non-aggregated data queries via fetchChunks().
    // If GROUP BY results exceed 10,000 rows, consider implementing chunked emission.
    ```
  - Optional improvement (if time permits):
    - Add safety limit: if GROUP BY result exceeds 10,000 rows, log warning
    - Consider implementing chunked emission for very large GROUP BY results
  - Verify the comment is accurate by checking `fetchChunks` usage for non-GROUP BY queries

  **Must NOT do**:
  - Do NOT implement complex streaming for GROUP BY unless necessary
  - Do NOT change behavior without clear benefit
  - Do NOT break existing GROUP BY functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Documentation task with optional small improvement
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 8 (final integration)
  - **Blocked By**: Task 1 (tests)

  **References**:
  **Pattern References**:
  - `src/app/api/clickhouse/discover/route.ts:428-455` - GROUP BY streaming
  - `src/lib/clickhouse/stream.ts` - fetchChunks implementation

  **Acceptance Criteria**:
  - [ ] Explanatory comment added to GROUP BY streaming code
  - [ ] Comment explains why buffering is acceptable
  - [ ] Optional: Safety limit or warning added for large results
  - [ ] No functional changes (unless implementing improvement)

  **QA Scenarios**:
  ```
  Scenario: Comment added and accurate
    Tool: Read (file)
    Preconditions: Changes complete
    Steps:
      1. Read GROUP BY streaming code
      2. Verify explanatory comment present
      3. Verify comment accurately describes behavior
    Expected Result: Clear comment explaining design decision
    Evidence: .sisyphus/evidence/task-7-comment-added.txt

  Scenario: GROUP BY still works
    Tool: Bash (curl)
    Preconditions: App running
    Steps:
      1. Execute GROUP BY query via API
      2. Verify results returned correctly
      3. Verify streaming headers present
    Expected Result: GROUP BY queries work correctly
    Evidence: .sisyphus/evidence/task-7-groupby-test.json
  ```

  **Commit**: YES
  - Message: `docs(api): document GROUP BY streaming design decision`
  - Files: `src/app/api/clickhouse/discover/route.ts`
  - Pre-commit: `bun test`

- [ ] 8. **Decompose use-discover-page.ts into Focused Hooks**

  **What to do**:
  - Analyze `src/lib/hooks/use-discover-page.ts` (909 lines) to identify concerns:
    - URL parsing/syncing (lines 56-85, 585-640, 792-850)
    - Schema loading + metadata cache (lines 175, 185, 585-718)
    - Data fetching + NDJSON stream parsing (lines 261-369)
    - Histogram fetching (lines 371-418)
    - Cache tracking (lines 187-193, 420-491)
    - Column preferences (lines 87-112, 214-237, 568-583)
    - State management (spread throughout)
  - Extract into focused hooks:
    - `use-discover-url.ts` (~50 lines): URL param parsing/syncing
    - `use-discover-schema.ts` (~100 lines): Schema loading + metadata cache
    - `use-discover-fetch.ts` (~150 lines): Data fetching + NDJSON stream parsing
    - `use-discover-histogram.ts` (~80 lines): Histogram fetching
    - `use-discover-cache-tracking.ts` (~50 lines): Client-side cache metadata tracking
  - Keep `use-discover-page.ts` as thin composition hook:
    - Import and use all sub-hooks
    - Combine state and actions into return object
    - Maintain exact same public API (no breaking changes)
  - Each sub-hook should:
    - Use existing Zustand stores directly
    - Have single responsibility
    - Be independently testable
    - Have clear inputs/outputs
  - Write tests for each sub-hook:
    - Test URL syncing
    - Test schema loading
    - Test data fetching
    - Test histogram fetching
  - Ensure no functional changes:
    - All existing behavior preserved
    - All existing tests pass
    - Performance maintained or improved

  **Must NOT do**:
  - Do NOT change behavior (pure refactoring only)
  - Do NOT break existing API
  - Do NOT lose functionality
  - Do NOT introduce regressions
  - Do NOT skip tests

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex refactoring requiring careful analysis
  - **Skills**: [`test-driven-development`, `systematic-debugging`]
    - TDD: Write tests for each sub-hook
    - Debugging: Ensure no regressions

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (alone)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Tasks 1, 5, 6, 7 (all previous tasks)

  **References**:
  **Pattern References**:
  - `src/lib/hooks/use-discover-page.ts` - Full file to decompose
  - `src/stores/discover/query-store.ts` - Zustand store
  - `src/stores/discover/data-store.ts` - Zustand store
  - `src/lib/clickhouse/metadata-cache.ts` - Metadata cache usage

  **Acceptance Criteria**:
  - [ ] `use-discover-url.ts` created with URL logic
  - [ ] `use-discover-schema.ts` created with schema logic
  - [ ] `use-discover-fetch.ts` created with data fetching logic
  - [ ] `use-discover-histogram.ts` created with histogram logic
  - [ ] `use-discover-cache-tracking.ts` created with cache tracking logic
  - [ ] `use-discover-page.ts` refactored to use all sub-hooks
  - [ ] Public API unchanged (exact same return object)
  - [ ] All existing tests pass
  - [ ] New tests for sub-hooks
  - [ ] Performance maintained

  **QA Scenarios**:
  ```
  Scenario: All sub-hooks created
    Tool: Bash (ls + grep)
    Preconditions: Refactoring complete
    Steps:
      1. List files in src/lib/hooks/
      2. Verify all 5 sub-hooks exist
      3. Verify use-discover-page.ts still exists
    Expected Result: All hooks present
    Evidence: .sisyphus/evidence/task-8-hooks-created.log

  Scenario: Public API unchanged
    Tool: Bash (diff)
    Preconditions: Refactoring complete
    Steps:
      1. Compare return type of useDiscoverPage before/after
      2. Verify same properties and methods
      3. Verify same types
    Expected Result: No API changes
    Evidence: .sisyphus/evidence/task-8-api-unchanged.diff

  Scenario: All tests pass
    Tool: Bash (bun test)
    Preconditions: Refactoring complete
    Steps:
      1. Run `bun test`
      2. Verify all tests pass
      3. Check discover-specific tests
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-8-all-tests.log

  Scenario: Discover page works end-to-end
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to Discover page
      2. Select database and table
      3. Apply filters
      4. View histogram
      5. Change time range
      6. Verify all functionality works
    Expected Result: Full functionality preserved
    Evidence: .sisyphus/evidence/task-8-e2e-test.png
  ```

  **Commit**: YES
  - Message: `refactor(hooks): decompose use-discover-page into focused hooks`
  - Files: `src/lib/hooks/use-discover-*.ts` (all new files), `src/lib/hooks/use-discover-page.ts`
  - Pre-commit: `bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `bun lint` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `type(scope): description` — files, `bun test`
- **2**: `type(scope): description` — files, `bun test`
- **3**: `type(scope): description` — files, `bun test`
- **4**: `type(scope): description` — files, `bun test`
- **5**: `type(scope): description` — files, `bun test`
- **6**: `type(scope): description` — files, `bun test`
- **7**: `type(scope): description` — files, `bun test`
- **8**: `type(scope): description` — files, `bun test`

---

## Success Criteria

### Verification Commands
```bash
# All quality checks must pass
bun lint                    # Expected: 0 errors, 0 warnings
bun run build              # Expected: Build successful
bun test                   # Expected: All tests pass

# Specific verification for each issue
bun test src/stores/discover/query-store.test.ts      # Issue 1, 8
bun test src/stores/discover/data-store.test.ts       # Issue 1, 8
bun test src/stores/sql/query-store.test.ts           # Issue 1, 8
bun test src/stores/sql/data-store.test.ts            # Issue 1, 8
bun test src/lib/clickhouse/cancellation.test.ts      # Issue 3
bun test src/lib/clickhouse/approx-count.test.ts      # Issue 2
bun test src/lib/cache/query-cache.test.ts            # Issue 4, 8
```

### Final Checklist
- [ ] All 8 issues addressed
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Build successful
- [ ] Evidence files captured for all QA scenarios
