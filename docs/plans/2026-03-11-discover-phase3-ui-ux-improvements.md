# Discover Phase 3: UI/UX Improvements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Discover UI with query cache indicators, actionable error messages, and standardized error handling across the application.

**Architecture:** Create reusable error display components, integrate cache metadata tracking, parse ClickHouse errors into actionable suggestions, and migrate existing components to use standardized error handling.

**Tech Stack:** React, TypeScript, shadcn/ui, lucide-react, ClickHouse, Redis (optional), bun test

---

## Task 1: Create Error Parser Utility

**Files:**
- Create: `src/lib/clickhouse/error-parser.ts`
- Test: `src/lib/clickhouse/error-parser.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { parseError } from "./error-parser";

describe("parseError", () => {
  it("should parse syntax errors", () => {
    const error = "Syntax error: Missing closing parenthesis near 'level'";
    const result = parseError(error);
    expect(result.category).toBe("syntax");
    expect(result.message).toContain("Missing closing parenthesis");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("should parse timeout errors", () => {
    const error = "Query timeout: Deadline exceeded after 30s";
    const result = parseError(error);
    expect(result.category).toBe("timeout");
    expect(result.suggestions.some(s => s.includes("time range"))).toBe(true);
  });

  it("should parse permission errors", () => {
    const error = "Access denied: user 'test' lacks SELECT privilege";
    const result = parseError(error);
    expect(result.category).toBe("permission");
    expect(result.suggestions.some(s => s.includes("RBAC"))).toBe(true);
  });

  it("should parse connection errors", () => {
    const error = "Connection refused: ClickHouse server unavailable";
    const result = parseError(error);
    expect(result.category).toBe("connection");
    expect(result.quickFixes.some(f => f.label === "Retry")).toBe(true);
  });

  it("should parse unknown column errors", () => {
    const error = "Unknown column 'user_id' in WHERE clause";
    const result = parseError(error);
    expect(result.category).toBe("not_found");
    expect(result.details).toContain("user_id");
  });

  it("should fallback to unknown for unrecognized errors", () => {
    const error = "Some weird error message";
    const result = parseError(error);
    expect(result.category).toBe("unknown");
    expect(result.message).toBe(error);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/clickhouse/error-parser.test.ts`
Expected: FAIL with "Cannot find module './error-parser'"

**Step 3: Write minimal implementation**

```typescript
export interface QuickFix {
  label: string;
  action: () => void;
}

export interface ParsedError {
  category: 'syntax' | 'timeout' | 'permission' | 'connection' | 'not_found' | 'unknown';
  message: string;
  suggestions: string[];
  quickFixes: QuickFix[];
  details?: string;
  query?: string;
  errorLocation?: { line: number; column: number };
}

const ERROR_PATTERNS = {
  syntax: [
    /syntax error/i,
    /unexpected token/i,
    /missing/i,
    /mismatched/i,
  ],
  timeout: [
    /timeout/i,
    /deadline exceeded/i,
    /took too long/i,
  ],
  permission: [
    /access denied/i,
    /permission/i,
    /not authorized/i,
    /privilege/i,
  ],
  connection: [
    /connection refused/i,
    /network/i,
    /unreachable/i,
    /failed to connect/i,
  ],
  not_found: [
    /unknown column/i,
    /table doesn't exist/i,
    /column not found/i,
  ],
};

const SUGGESTIONS = {
  syntax: [
    "Check for unmatched parentheses in your query",
    "Verify all string literals are properly quoted",
    "Check column names match the schema",
  ],
  timeout: [
    "Reduce the time range",
    "Add more filters to limit results",
    "Increase query timeout in settings",
  ],
  permission: [
    "Check RBAC settings for your user",
    "Contact your administrator",
    "Verify you have access to this table",
  ],
  connection: [
    "Check ClickHouse server status",
    "Verify network connectivity",
    "Retry the connection",
  ],
  not_found: [
    "Verify the schema is up to date",
    "Check column name spelling",
    "Refresh the table schema",
  ],
};

export function parseError(error: string | Error): ParsedError {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Determine category
  let category: ParsedError['category'] = 'unknown';
  for (const [cat, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(errorMessage))) {
      category = cat as ParsedError['category'];
      break;
    }
  }

  // Extract details
  const details = extractDetails(errorMessage, category);

  // Generate suggestions
  const suggestions = SUGGESTIONS[category] || [];

  // Generate quick fixes
  const quickFixes = generateQuickFixes(category, details);

  return {
    category,
    message: errorMessage,
    suggestions,
    quickFixes,
    details,
  };
}

function extractDetails(error: string, category: ParsedError['category']): string | undefined {
  if (category === 'not_found') {
    const columnMatch = error.match(/unknown column ['"]([^'"]+)['"]/i);
    if (columnMatch) return columnMatch[1];
    const tableMatch = error.match(/table ['"]([^'"]+)['"] doesn't exist/i);
    if (tableMatch) return tableMatch[1];
  }
  return undefined;
}

function generateQuickFixes(category: ParsedError['category'], details?: string): QuickFix[] {
  const fixes: QuickFix[] = [];

  if (category === 'connection') {
    fixes.push({
      label: 'Retry',
      action: () => {
        // Will be implemented by caller
      },
    });
  }

  if (category === 'not_found') {
    fixes.push({
      label: 'Refresh Schema',
      action: () => {
        // Will be implemented by caller
      },
    });
  }

  if (category === 'timeout') {
    fixes.push({
      label: 'Reduce Time Range',
      action: () => {
        // Will be implemented by caller
      },
    });
  }

  return fixes;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/clickhouse/error-parser.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/clickhouse/error-parser.ts src/lib/clickhouse/error-parser.test.ts
git commit -m "feat: add error parser utility for ClickHouse errors"
```

---

## Task 2: Create Cache Indicator Component

**Files:**
- Create: `src/components/discover/CacheIndicator.tsx`
- Test: `src/components/discover/CacheIndicator.test.tsx`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { CacheIndicator } from "./CacheIndicator";

describe("CacheIndicator", () => {
  it("should not render when not cached", () => {
    render(<CacheIndicator isCached={false} />);
    expect(screen.queryByText("Cached")).toBeNull();
  });

  it("should render badge when cached", () => {
    render(<CacheIndicator isCached={true} cacheAge={120000} />);
    expect(screen.getByText("Cached")).toBeInTheDocument();
  });

  it("should show cache age in tooltip", () => {
    render(<CacheIndicator isCached={true} cacheAge={120000} />);
    const badge = screen.getByText("Cached");
    expect(badge).toHaveAttribute("title", expect.stringContaining("2m ago"));
  });

  it("should show warning color for stale cache", () => {
    render(<CacheIndicator isCached={true} cacheAge={3600000 * 2} />);
    const badge = screen.getByText("Cached");
    expect(badge.className).toContain("text-yellow-600");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/components/discover/CacheIndicator.test.tsx`
Expected: FAIL with "Cannot find module './CacheIndicator'"

**Step 3: Write minimal implementation**

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface CacheIndicatorProps {
  isCached: boolean;
  cacheAge?: number; // milliseconds
  hitRate?: number; // percentage
  totalHits?: number;
  totalMisses?: number;
  cacheSource?: 'redis' | 'memory';
}

export function CacheIndicator({
  isCached,
  cacheAge = 0,
  hitRate,
  totalHits,
  totalMisses,
  cacheSource = 'redis',
}: CacheIndicatorProps) {
  if (!isCached) {
    return null;
  }

  const formatAge = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const isStale = cacheAge > 3600000; // 1 hour
  const badgeColor = isStale ? "text-yellow-600 bg-yellow-500/20 border-yellow-500/30" : "text-green-600 bg-green-500/20 border-green-500/30";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn(badgeColor, "gap-1.5 cursor-help")}>
            <Database className="h-3 w-3" />
            Cached
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Status</span>
              <span className="text-xs text-muted-foreground">{formatAge(cacheAge)}</span>
            </div>
            {hitRate !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Hit Rate</span>
                <span className="text-xs font-mono">{hitRate.toFixed(1)}%</span>
              </div>
            )}
            {totalHits !== undefined && totalMisses !== undefined && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Hits</span>
                  <span className="text-xs font-mono">{totalHits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Misses</span>
                  <span className="text-xs font-mono">{totalMisses}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">Source</span>
              <span className="text-xs font-mono">{cacheSource}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/components/discover/CacheIndicator.test.tsx`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/components/discover/CacheIndicator.tsx src/components/discover/CacheIndicator.test.tsx
git commit -m "feat: add cache indicator component with tooltip"
```

---

## Task 3: Create Error Display Component

**Files:**
- Create: `src/components/discover/ErrorDisplay.tsx`
- Test: `src/components/discover/ErrorDisplay.test.tsx`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorDisplay } from "./ErrorDisplay";
import type { ParsedError } from "@/lib/clickhouse/error-parser";

describe("ErrorDisplay", () => {
  const mockError: ParsedError = {
    category: 'syntax',
    message: 'Syntax error: Missing closing parenthesis',
    suggestions: ['Check for unmatched parentheses'],
    quickFixes: [],
  };

  it("should render error message", () => {
    render(<ErrorDisplay error={mockError} />);
    expect(screen.getByText('Syntax error: Missing closing parenthesis')).toBeInTheDocument();
  });

  it("should render suggestions", () => {
    render(<ErrorDisplay error={mockError} />);
    expect(screen.getByText('Check for unmatched parentheses')).toBeInTheDocument();
  });

  it("should call onRetry when retry button clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error={mockError} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it("should expand details when show details clicked", () => {
    render(<ErrorDisplay error={{ ...mockError, details: 'Full error details' }} />);
    fireEvent.click(screen.getByText('Show Details'));
    expect(screen.getByText('Full error details')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/components/discover/ErrorDisplay.test.tsx`
Expected: FAIL with "Cannot find module './ErrorDisplay'"

**Step 3: Write minimal implementation**

```typescript
"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { ParsedError } from "@/lib/clickhouse/error-parser";
import { cn } from "@/lib/utils";

interface ErrorDisplayProps {
  error: ParsedError;
  query?: string;
  onRetry?: () => void;
  onFix?: () => void;
  onRefreshSchema?: () => void;
}

export function ErrorDisplay({
  error,
  query,
  onRetry,
  onFix,
  onRefreshSchema,
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="font-semibold">{error.message}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          {error.suggestions.length > 0 && (
            <ul className="space-y-1 text-sm">
              {error.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {error.quickFixes.map((fix, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={fix.action}
                className="h-8 text-xs"
              >
                {fix.label}
              </Button>
            ))}
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="h-8 text-xs">
                Retry
              </Button>
            )}
            {onFix && (
              <Button variant="outline" size="sm" onClick={onFix} className="h-8 text-xs">
                Fix Syntax
              </Button>
            )}
            {onRefreshSchema && (
              <Button variant="outline" size="sm" onClick={onRefreshSchema} className="h-8 text-xs">
                Refresh Schema
              </Button>
            )}
          </div>

          {(error.details || query) && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  {showDetails ? (
                    <>
                      <ChevronUp className="mr-1 h-3 w-3" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Show Details
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {error.details && (
                  <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                    {error.details}
                  </div>
                )}
                {query && (
                  <div className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap break-all">
                    {query}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/components/discover/ErrorDisplay.test.tsx`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/components/discover/ErrorDisplay.tsx src/components/discover/ErrorDisplay.test.tsx
git commit -m "feat: add error display component with quick-fixes"
```

---

## Task 4: Add Cache Metadata Tracking to use-discover-state

**Files:**
- Modify: `src/lib/hooks/use-discover-state.ts`
- Test: `src/lib/hooks/use-discover-state.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
// Add tests for cache metadata tracking
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/hooks/use-discover-state.test.ts`
Expected: FAIL (tests for cache tracking don't exist)

**Step 3: Write minimal implementation**

Add to `DiscoverState` interface:
```typescript
cacheMetadata?: {
  isCached: boolean;
  cacheAge: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
};
```

Add cache tracking logic in `handleSearch` function to track cache hits/misses and calculate hit rate.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/hooks/use-discover-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/hooks/use-discover-state.ts src/lib/hooks/use-discover-state.test.ts
git commit -m "feat: add cache metadata tracking to use-discover-state"
```

---

## Task 5: Integrate Cache Indicator in Discover Page

**Files:**
- Modify: `src/app/(app)/discover/page.tsx`

**Step 1: Update results header**

Modify the results header section (around line 278-285) to include CacheIndicator:

```typescript
<div className="p-2 border-b text-xs text-muted-foreground flex justify-between items-center">
  <div className="flex items-center gap-2">
    <span>
      {rows.length.toLocaleString()} of{" "}
      {totalHits.toLocaleString()} hits
    </span>
    <CacheIndicator
      isCached={cacheMetadata?.isCached || false}
      cacheAge={cacheMetadata?.cacheAge}
      hitRate={cacheMetadata?.hitRate}
      totalHits={cacheMetadata?.totalHits}
      totalMisses={cacheMetadata?.totalMisses}
    />
  </div>
  <span className="font-mono">
    {selectedDatabase}.{selectedTable}
  </span>
</div>
```

**Step 2: Import CacheIndicator**

Add import at top of file:
```typescript
import { CacheIndicator } from "@/components/discover/CacheIndicator";
```

**Step 3: Extract cacheMetadata from useDiscoverState**

Add to destructured values from `useDiscoverState()`:
```typescript
cacheMetadata,
```

**Step 4: Run tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/(app)/discover/page.tsx
git commit -m "feat: integrate cache indicator in Discover page"
```

---

## Task 6: Integrate Error Display in Discover Page

**Files:**
- Modify: `src/app/(app)/discover/page.tsx`

**Step 1: Replace inline error display**

Replace the inline error display (lines 195-203) with ErrorDisplay component:

```typescript
{error && !isLoading && (
  <ErrorDisplay
    error={parseError(error)}
    query={customFilter}
    onRetry={handleSearch}
    onFix={() => {
      // Show syntax help
    }}
  />
)}
```

**Step 2: Import ErrorDisplay and parseError**

Add imports:
```typescript
import { ErrorDisplay } from "@/components/discover/ErrorDisplay";
import { parseError } from "@/lib/clickhouse/error-parser";
```

**Step 3: Run tests**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(app)/discover/page.tsx
git commit -m "feat: integrate error display in Discover page"
```

---

## Task 7: Create Standardized Error Display Components

**Files:**
- Create: `src/components/ui/error-display.tsx`
- Test: `src/components/ui/error-display.test.tsx`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ErrorDisplay as StandardErrorDisplay } from "./error-display";

describe("StandardErrorDisplay", () => {
  it("should render critical error with retry button", () => {
    render(
      <StandardErrorDisplay
        severity="critical"
        title="Connection Failed"
        message="Could not connect to ClickHouse"
        onRetry={() => {}}
      />
    );
    expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("should render high error with suggestions", () => {
    render(
      <StandardErrorDisplay
        severity="high"
        title="Query Timeout"
        message="Query took too long"
        suggestions={["Reduce time range", "Add filters"]}
      />
    );
    expect(screen.getByText("Reduce time range")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/components/ui/error-display.test.tsx`
Expected: FAIL with "Cannot find module './error-display'"

**Step 3: Write minimal implementation**

```typescript
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { XCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface StandardErrorDisplayProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  suggestions?: string[];
  onRetry?: () => void;
  onDismiss?: () => void;
  details?: string;
}

const severityConfig = {
  critical: {
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'border-red-500/50 bg-red-500/10',
  },
  high: {
    icon: AlertTriangle,
    variant: 'destructive' as const,
    className: 'border-orange-500/50 bg-orange-500/10',
  },
  medium: {
    icon: AlertTriangle,
    variant: 'default' as const,
    className: 'border-yellow-500/50 bg-yellow-500/10',
  },
  low: {
    icon: Info,
    variant: 'default' as const,
    className: 'border-blue-500/50 bg-blue-500/10',
  },
};

export function StandardErrorDisplay({
  severity,
  title,
  message,
  suggestions,
  onRetry,
  onDismiss,
  details,
}: StandardErrorDisplayProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Alert variant={config.variant} className={cn(config.className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <p>{message}</p>

          {suggestions && suggestions.length > 0 && (
            <ul className="space-y-1 text-sm">
              {suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="h-8 text-xs">
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 text-xs">
                Dismiss
              </Button>
            )}
          </div>

          {details && (
            <div className="mt-2 text-xs bg-muted/50 p-2 rounded font-mono">
              {details}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/components/ui/error-display.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/error-display.tsx src/components/ui/error-display.test.tsx
git commit -m "feat: add standardized error display component"
```

---

## Task 8: Update API Client to Use Standardized Error Display

**Files:**
- Modify: `src/lib/api/client.ts`

**Step 1: Update error handling**

Modify the error handling in `handleApiError` to use standardized error display instead of toast for high/critical errors.

**Step 2: Run tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/api/client.ts
git commit -m "refactor: update API client to use standardized error display"
```

---

## Task 9: Migrate Monitoring Tabs to Standardized Error Display

**Files:**
- Modify: `src/components/monitoring/overview-tab.tsx`
- Modify: `src/components/monitoring/metrics-tab.tsx`
- Modify: `src/components/monitoring/disks-tab.tsx`
- Modify: `src/components/monitoring/keeper-tab.tsx`

**Step 1: Update overview-tab.tsx**

Replace inline error display with StandardErrorDisplay.

**Step 2: Update metrics-tab.tsx**

Replace inline error display with StandardErrorDisplay.

**Step 3: Update disks-tab.tsx**

Replace inline error display with StandardErrorDisplay.

**Step 4: Update keeper-tab.tsx**

Replace inline error display with StandardErrorDisplay.

**Step 5: Run tests**

Run: `bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/monitoring/
git commit -m "refactor: migrate monitoring tabs to standardized error display"
```

---

## Task 10: Migrate Tables Tabs to Standardized Error Display

**Files:**
- Modify: `src/components/tables/merges-tab.tsx`
- Modify: `src/components/tables/mutations-tab.tsx`
- Modify: `src/components/tables/parts-tab.tsx`
- Modify: `src/components/tables/columns-tab.tsx`
- Modify: `src/components/tables/dependencies-tab.tsx`

**Step 1: Update all tables tabs**

Replace inline error displays with StandardErrorDisplay.

**Step 2: Run tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/tables/
git commit -m "refactor: migrate tables tabs to standardized error display"
```

---

## Task 11: Write E2E Tests for Cache Indicator

**Files:**
- Create: `e2e/discover-cache.spec.ts`

**Step 1: Write E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Discover Cache Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover');
    // Login if needed
  });

  test('should show cache indicator after running query', async ({ page }) => {
    // Select database and table
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');

    // Run query
    await page.fill('input[placeholder*="Filter"]', 'type = \'QueryFinish\'');
    await page.click('button:has-text("Search")');

    // Wait for results
    await page.waitForSelector('[data-slot="table-row"]');

    // Check cache indicator appears
    await expect(page.locator('text=Cached')).toBeVisible();
  });

  test('should show cache stats on hover', async ({ page }) => {
    // Setup query
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');
    await page.fill('input[placeholder*="Filter"]', 'type = \'QueryFinish\'');
    await page.click('button:has-text("Search")');
    await page.waitForSelector('[data-slot="table-row"]');

    // Hover over cache indicator
    await page.locator('text=Cached').hover();

    // Check tooltip appears
    await expect(page.locator('text=Cache Status')).toBeVisible();
    await expect(page.locator('text=Hit Rate')).toBeVisible();
  });
});
```

**Step 2: Run E2E test**

Run: `bun run test:e2e e2e/discover-cache.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/discover-cache.spec.ts
git commit -m "test: add E2E tests for cache indicator"
```

---

## Task 12: Write E2E Tests for Error Display

**Files:**
- Create: `e2e/discover-errors.spec.ts`

**Step 1: Write E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Discover Error Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover');
  });

  test('should show error display for invalid query', async ({ page }) => {
    // Select database and table
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');

    // Enter invalid query
    await page.fill('input[placeholder*="Filter"]', 'invalid_column = \'test\'');
    await page.click('button:has-text("Search")');

    // Check error display appears
    await expect(page.locator('text=Unknown column')).toBeVisible();
    await expect(page.locator('text=Refresh Schema')).toBeVisible();
  });

  test('should retry query when retry button clicked', async ({ page }) => {
    // Setup
    await page.selectOption('[aria-label="Select database"]', 'default');
    await page.selectOption('[aria-label="Select table"]', 'system.query_log');

    // Enter valid query
    await page.fill('input[placeholder*="Filter"]', 'type = \'QueryFinish\'');
    await page.click('button:has-text("Search")');
    await page.waitForSelector('[data-slot="table-row"]');

    // Store row count
    const initialRows = await page.locator('[data-slot="table-row"]').count();

    // Click retry
    await page.click('button:has-text("Retry")');
    await page.waitForSelector('[data-slot="table-row"]');

    // Check results loaded
    const retryRows = await page.locator('[data-slot="table-row"]').count();
    expect(retryRows).toBe(initialRows);
  });
});
```

**Step 2: Run E2E test**

Run: `bun run test:e2e e2e/discover-errors.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/discover-errors.spec.ts
git commit -m "test: add E2E tests for error display"
```

---

## Task 13: Run Lint and Type Check

**Step 1: Run lint**

Run: `bun lint`
Expected: No errors (warnings acceptable)

**Step 2: Run type check**

Run: `bun run typecheck` (if available) or `tsc --noEmit`
Expected: No errors

**Step 3: Fix any issues**

Fix any lint or type errors found.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: fix lint and type errors"
```

---

## Task 14: Final Integration Test

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run E2E tests**

Run: `bun run test:e2e`
Expected: All E2E tests pass

**Step 3: Manual testing**

Test the following manually:
1. Navigate to Discover page
2. Run a query, verify cache indicator appears
3. Hover over cache indicator, verify stats show
4. Run invalid query, verify error display appears
5. Click quick-fix buttons, verify they work
6. Expand error details, verify full error shown

**Step 4: Commit**

```bash
git add .
git commit -m "feat: complete Phase 3 UI/UX improvements for Discover

- Add query cache indicator with statistics tooltip
- Add enhanced error display with quick-fix options
- Create standardized error display components
- Migrate monitoring and tables tabs to standardized errors
- Add comprehensive unit and E2E tests
- Improve error handling across the application"
```

---

## Summary

This implementation plan breaks down Phase 3 into 14 bite-sized tasks:

1. Create error parser utility (6 tests)
2. Create cache indicator component (4 tests)
3. Create error display component (4 tests)
4. Add cache metadata tracking
5. Integrate cache indicator in Discover page
6. Integrate error display in Discover page
7. Create standardized error display components
8. Update API client to use standardized errors
9. Migrate monitoring tabs (4 components)
10. Migrate tables tabs (5 components)
11. Write E2E tests for cache indicator
12. Write E2E tests for error display
13. Run lint and type check
14. Final integration test

Each task follows TDD principles with failing tests first, minimal implementation, and frequent commits.