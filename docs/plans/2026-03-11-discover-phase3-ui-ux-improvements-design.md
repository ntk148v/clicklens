# Discover Phase 3: UI/UX Improvements - Design Document

**Date:** 2026-03-11
**Status:** Approved
**Author:** OpenCode

## Overview

Phase 3 focuses on enhancing the user experience of the Discover feature through improved error handling, query result caching indicators, and standardized error display components across the application.

## Goals

1. Provide clear, actionable error messages with quick-fix options
2. Show query result caching status to improve transparency
3. Establish a consistent error handling standard across all components
4. Improve accessibility and keyboard navigation

## Section 1: Query Cache Indicator

### Core Implementation (Phase 1)

**Location:** Results header (next to "X of Y hits")

**Behavior:**
- Display "Cached" badge only when results come from cache
- Green color scheme with subtle glow effect
- Simple tooltip showing cache age (e.g., "Cached 2m ago")

**Component:** `src/components/discover/CacheIndicator.tsx`

```typescript
interface CacheIndicatorProps {
  isCached: boolean;
  cacheAge?: number; // milliseconds
  hitRate?: number; // percentage
  totalHits?: number;
  totalMisses?: number;
  cacheSource?: 'redis' | 'memory';
}
```

### Progressive Enhancement (Phase 2)

**Hover Statistics:**
- Cache hit rate for current session
- Total cache hits/misses
- Last cache refresh time
- Cache source indicator (Redis vs memory fallback)

**Optional Future Enhancement:**
- Cache management panel in settings to view/invalidate caches

### Integration Points

- Modify `use-discover-state.ts` to track cache metadata
- Pass cache info to `DiscoverGrid` via props
- Display in results header at `src/app/(app)/discover/page.tsx:278-285`

### Edge Cases

1. **Cache Miss** - Don't show indicator
2. **Cache Age > 1 hour** - Show warning color (yellow)
3. **Cache Fallback** - Show "Cached (memory)" badge
4. **No Cache Metadata** - Gracefully degrade to no indicator
5. **Concurrent Queries** - Show loading state while checking cache

## Section 2: Enhanced Error Messages

### Core Error Handling (Phase 1)

**Error Categories:**

1. **Syntax Errors** - "syntax error", "unexpected token", "missing"
   - Suggestion: Check query syntax, verify column names, quote strings
   - Quick-fix: "Show Syntax Help" button

2. **Timeout Errors** - "timeout", "deadline exceeded", "took too long"
   - Suggestion: Reduce time range, add more filters, increase timeout
   - Quick-fix: "Reduce Time Range" button

3. **Permission Errors** - "access denied", "permission", "not authorized"
   - Suggestion: Check RBAC settings, contact admin, verify table access
   - Quick-fix: "Contact Admin" button

4. **Connection Errors** - "connection refused", "network", "unreachable"
   - Suggestion: Check ClickHouse status, verify network, retry connection
   - Quick-fix: "Retry" button

5. **Column/Table Not Found** - "unknown column", "table doesn't exist"
   - Suggestion: Verify schema, check spelling, refresh schema
   - Quick-fix: "Refresh Schema" button

**UI Structure:**
- AlertCircle icon (red) + Primary error message (bold)
- 1-2 actionable suggestions (bulleted list with CheckCircle icons)
- "Show Details" expandable section with full error message, query, stack trace
- Quick-fix buttons (when applicable)

**Example:**
```
[AlertCircle icon] Syntax Error: Missing closing parenthesis

Suggestions:
  [CheckCircle icon] Check for unmatched parentheses in your query
  [CheckCircle icon] Verify all string literals are properly quoted

Query Preview:
level = 'Error' AND (status >= 400 AND host LIKE '%api%'
                                    ↑ Missing closing parenthesis

[Show Details] [Fix Syntax] [Retry]
```

### Progressive Enhancement (Phase 2)

**Advanced Error Analysis:**
- Regex patterns to extract specific details (column names, table names, line numbers)
- Map errors to documentation links (ClickHouse docs)
- Show query preview with error location highlighted (red underline)
- Suggest alternative queries based on error type

**Component:** `src/components/discover/ErrorDisplay.tsx`

```typescript
interface ErrorDisplayProps {
  error: ParsedError;
  query?: string;
  onRetry?: () => void;
  onFix?: () => void;
  onRefreshSchema?: () => void;
}

interface ParsedError {
  category: 'syntax' | 'timeout' | 'permission' | 'connection' | 'not_found' | 'unknown';
  message: string;
  suggestions: string[];
  quickFixes: QuickFix[];
  details?: string;
  query?: string;
  errorLocation?: { line: number; column: number };
}
```

### Integration Points

- Replace inline error display at `src/app/(app)/discover/page.tsx:195-203`
- Modify `use-discover-state.ts` to parse errors and categorize
- Add error parsing utility in `src/lib/clickhouse/error-parser.ts`

### Edge Cases

1. **Unknown Error Type** - Fallback to generic message with "Show Details"
2. **Multiple Errors** - Show first error with "X more errors" link
3. **Empty Query** - Show hint to enter query before searching
4. **Query Too Long** - Truncate in preview, show "View Full Query" button
5. **Error During Error Parsing** - Show raw error message safely

## Section 3: Architecture & Data Flow

### Component Hierarchy

```
DiscoverPage
├── QueryBar
│   └── QueryHistory (popover)
├── ErrorDisplay (new)
├── DiscoverHistogram
├── FieldsSidebar
└── ResultsContainer
    ├── ResultsHeader (new)
    │   └── CacheIndicator (new)
    └── DiscoverGrid
        └── DiscoverGridSkeleton
```

### Cache Indicator Data Flow

1. `use-discover-state.ts` tracks cache metadata:
   - `isCached: boolean`
   - `cacheAge: number`
   - `cacheHitRate: number`
   - `totalCacheHits: number`
   - `totalCacheMisses: number`

2. `QueryCache` returns cache metadata:
   ```typescript
   interface CacheResult<T> {
     data: T;
     fromCache: boolean;
     cacheAge: number;
   }
   ```

3. `DiscoverPage` → `ResultsHeader` → `CacheIndicator`

### Error Display Data Flow

1. Query execution catches errors in `use-discover-state.ts`
2. `error-parser.ts` categorizes error and extracts details
3. `ErrorDisplay` receives `ParsedError` and renders UI
4. Quick-fix buttons trigger callbacks to modify query/state

### State Management

- Cache stats stored in `use-discover-state.ts` (session-scoped)
- Error parsing is pure function (no state)
- Query history in localStorage (existing feature)

## Section 4: Standardized Error Handling

### Error Severity Levels

1. **Critical** - Blocks core functionality
   - Display: Full-page error with retry button
   - Example: Connection failure, authentication error
   - Component: `ErrorBoundary` + `CriticalErrorDisplay`

2. **High** - Blocks current operation but app still usable
   - Display: Card with icon, message, retry button
   - Example: Query timeout, permission denied
   - Component: `ErrorDisplay` (reusable)

3. **Medium** - Non-blocking but affects UX
   - Display: Inline alert with icon + message
   - Example: Partial data load, cache miss
   - Component: `InlineError` (lightweight)

4. **Low** - Informational, doesn't affect UX
   - Display: Toast notification
   - Example: Background sync failed, localStorage quota
   - Component: Existing `toast()` function

### Standardized Error Display Components

```typescript
// src/components/ui/error-display.tsx
interface ErrorDisplayProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  suggestions?: string[];
  onRetry?: () => void;
  onDismiss?: () => void;
  details?: string;
}
```

### Error Handling Flow

1. **API Layer** (`src/lib/api/client.ts`):
   - Parse HTTP status codes
   - Extract user-friendly messages
   - Route to appropriate display based on severity

2. **Component Layer**:
   - Catch errors in try/catch
   - Categorize by severity
   - Display using standardized components

3. **Error Parser** (`src/lib/clickhouse/error-parser.ts`):
   - Parse ClickHouse errors
   - Extract actionable suggestions
   - Map to severity levels

### Migration Plan

1. Create standardized error components
2. Update API client to use new components
3. Migrate monitoring tabs to `ErrorDisplay`
4. Migrate tables tabs to `InlineError`
5. Update discover to use enhanced `ErrorDisplay`
6. Keep toast for low-severity errors

## Section 5: Testing Strategy

### Unit Tests

1. **Error Parser** (`src/lib/clickhouse/error-parser.test.ts`):
   - Test each error category pattern matching
   - Test suggestion generation
   - Test edge cases (unknown errors, malformed messages)
   - Test error location extraction

2. **Cache Indicator** (`src/components/discover/CacheIndicator.test.tsx`):
   - Test badge rendering for cached vs non-cached
   - Test tooltip content and hover behavior
   - Test cache age formatting (seconds, minutes, hours)
   - Test warning color for stale cache (> 1 hour)

3. **Error Display** (`src/components/discover/ErrorDisplay.test.tsx`):
   - Test rendering for each error category
   - Test quick-fix button callbacks
   - Test expandable details section
   - Test accessibility (ARIA attributes, keyboard nav)

### Integration Tests

1. **Cache Integration** (`src/lib/hooks/use-discover-state.test.ts`):
   - Test cache metadata tracking
   - Test cache hit rate calculation
   - Test cache age updates
   - Test Redis fallback behavior

2. **Error Handling Flow** (`src/app/(app)/discover/page.test.tsx`):
   - Test error display on query failure
   - Test quick-fix button actions
   - Test error dismissal
   - Test retry functionality

### E2E Tests

1. **Cache Indicator** (`e2e/discover-cache.spec.ts`):
   - Navigate to discover, run query, verify cache indicator appears
   - Hover over badge, verify tooltip shows stats
   - Run new query, verify badge disappears
   - Refresh page, verify cache persists

2. **Error Display** (`e2e/discover-errors.spec.ts`):
   - Enter invalid query, verify error display appears
   - Click quick-fix button, verify query updated
   - Expand details, verify full error shown
   - Click retry, verify query re-executed

### Visual Regression Tests

1. **Error Display Variants**:
   - Screenshot each error category
   - Test dark/light mode
   - Test mobile responsive layout

2. **Cache Indicator States**:
   - Cached (green)
   - Stale cache (yellow)
   - Memory fallback (gray)
   - No cache (hidden)

### Performance Tests

1. **Cache Stats Calculation**:
   - Measure time to calculate hit rate for 1000 queries
   - Verify no performance degradation with large history

2. **Error Parsing**:
   - Benchmark error parsing for 1000 error messages
   - Verify caching reduces parse time

### Accessibility Tests

1. **Screen Reader**:
   - Verify cache indicator announced correctly
   - Verify error display is navigable with keyboard
   - Verify quick-fix buttons have proper focus states

2. **Keyboard Navigation**:
   - Tab through error display elements
   - Enter/Space to activate buttons
   - Escape to dismiss expandable sections

### Test Coverage Goals

- Unit tests: 90%+ coverage for new components
- Integration tests: Cover all error categories
- E2E tests: Critical user flows (cache, errors)
- Accessibility: WCAG 2.1 AA compliance

## Section 6: Performance Considerations

1. **Cache Stats Calculation** - Debounce to avoid excessive recalculations
2. **Error Parsing** - Cache parsed errors to avoid re-parsing on re-renders
3. **Tooltip Rendering** - Use lazy rendering for cache stats tooltip
4. **Query Preview Highlighting** - Only highlight visible portion for long queries

## Section 7: Accessibility

1. **Cache Indicator** - Add `aria-label` for screen readers
2. **Error Display** - Use semantic HTML, proper heading hierarchy
3. **Quick-fix Buttons** - Clear focus states, keyboard navigation
4. **Expandable Details** - Proper ARIA attributes for collapsible sections

## Section 8: Browser Compatibility

1. **LocalStorage** - Handle quota exceeded errors gracefully
2. **Tooltip Positioning** - Fallback to bottom positioning if viewport constrained
3. **Query Preview** - Use monospace font fallback for syntax highlighting

## Implementation Phases

### Phase 3.1: Core Features (Week 1)
- Create `CacheIndicator` component
- Create `ErrorDisplay` component
- Create `error-parser.ts` utility
- Integrate cache indicator in Discover
- Integrate error display in Discover

### Phase 3.2: Progressive Enhancement (Week 2)
- Add cache statistics tooltip
- Add advanced error analysis
- Add query preview highlighting
- Add documentation links

### Phase 3.3: Standardization (Week 3)
- Create standardized error components
- Update API client
- Migrate monitoring tabs
- Migrate tables tabs

### Phase 3.4: Testing & Polish (Week 4)
- Write unit tests
- Write integration tests
- Write E2E tests
- Visual regression testing
- Accessibility testing
- Performance optimization

## Success Criteria

1. Users can see when query results are cached
2. Error messages are actionable with quick-fix options
3. Error handling is consistent across all components
4. All tests pass with 90%+ coverage
5. Accessibility compliance (WCAG 2.1 AA)
6. No performance degradation

## Risks & Mitigations

1. **Risk:** Complex error parsing may miss edge cases
   - **Mitigation:** Fallback to generic message, log unknown errors

2. **Risk:** Cache stats calculation may impact performance
   - **Mitigation:** Debounce calculations, cache results

3. **Risk:** Standardization may break existing components
   - **Mitigation:** Gradual migration, thorough testing

## Dependencies

- Phase 1 & 2 must be completed
- `@tanstack/react-virtual` already installed
- Existing toast system
- Existing shadcn/ui components