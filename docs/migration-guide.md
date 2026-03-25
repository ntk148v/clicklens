# State Migration Guide: Hooks to Zustand

## Overview

This guide covers the migration from React hooks-based state management to Zustand stores in ClickLens. The migration is designed to be gradual - components can be migrated one at a time without breaking existing functionality.

## Migration Strategy

### Phase 1: Adapter Hooks (Current)
- Use adapter hooks that wrap Zustand stores with the same API as existing hooks
- Components can switch to adapter hooks without code changes
- Existing hooks remain functional during migration

### Phase 2: Direct Store Usage
- Replace adapter hooks with direct Zustand store usage
- Optimize selectors for better performance
- Remove adapter layer once all components are migrated

### Phase 3: Cleanup
- Remove old hook implementations
- Remove migration utilities
- Update documentation

## Quick Start

### For Discover Components

Replace the existing hook import:

```typescript
// Before
import { useDiscoverState } from "@/lib/hooks/use-discover-state";

// After
import { useDiscoverStore } from "@/lib/hooks/use-discover-store";
```

The API remains the same:

```typescript
function DiscoverComponent() {
  const {
    customFilter,
    setCustomFilter,
    selectedColumns,
    setSelectedColumns,
    // ... other state and actions
  } = useDiscoverStore();

  // Component logic unchanged
}
```

### For SQL Console Components

Replace the existing hook import:

```typescript
// Before
import { useTabsStore } from "@/lib/store/tabs";

// After
import { useSqlStore } from "@/lib/hooks/use-sql-store";
```

## Detailed Migration Steps

### Step 1: Identify Components to Migrate

List all components using state hooks:

```bash
grep -r "useDiscoverState" src/
grep -r "useTabsStore" src/
```

### Step 2: Update Imports

For each component, update the import statement:

```typescript
// Discover components
import { useDiscoverStore } from "@/lib/hooks/use-discover-store";

// SQL components
import { useSqlStore } from "@/lib/hooks/use-sql-store";
```

### Step 3: Verify Functionality

Test each component after migration:

1. State updates work correctly
2. UI reflects state changes
3. No console errors
4. Performance is maintained or improved

### Step 4: Optimize Selectors (Optional)

For better performance, use specific selectors:

```typescript
// Before: Gets all state
const { customFilter, setCustomFilter } = useDiscoverStore();

// After: Gets only needed state
const customFilter = useQueryStore((state) => state.customFilter);
const setCustomFilter = useQueryStore((state) => state.setQuery);
```

## API Reference

### Discover Store

#### State

| Property | Type | Description |
|----------|------|-------------|
| `customFilter` | `string` | Current filter input |
| `appliedFilter` | `string` | Applied filter (after search) |
| `flexibleRange` | `FlexibleTimeRange` | Time range selection |
| `sorting` | `SortingState` | Table sorting configuration |
| `groupBy` | `string[]` | Group by columns |
| `selectedColumns` | `string[]` | Selected columns for display |
| `selectedTimeColumn` | `string` | Selected time column |
| `isQueryDirty` | `boolean` | Whether query has unsaved changes |
| `selectedRows` | `Set<string>` | Selected row IDs |
| `expandedRows` | `Set<string>` | Expanded row IDs |
| `columnVisibility` | `Record<string, boolean>` | Column visibility state |
| `columnOrder` | `string[]` | Column display order |
| `rowWindow` | `{ startIndex: number; endIndex: number }` | Virtual scroll window |
| `sidebarOpen` | `boolean` | Sidebar visibility |

#### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setQuery` | `(query: string) => void` | Set filter query |
| `setAppliedFilter` | `(filter: string) => void` | Set applied filter |
| `setFilters` | `(filter: string) => void` | Set both custom and applied filter |
| `setTimeRange` | `(range: FlexibleTimeRange) => void` | Set time range |
| `setSort` | `(sorting: SortingState) => void` | Set sorting |
| `setGroupBy` | `(groupBy: string[]) => void` | Set group by columns |
| `setSelectedColumns` | `(columns: string[]) => void` | Set selected columns |
| `setSelectedTimeColumn` | `(column: string) => void` | Set time column |
| `markClean` | `() => void` | Mark query as clean |
| `markDirty` | `() => void` | Mark query as dirty |
| `resetQuery` | `() => void` | Reset query to defaults |
| `setSelectedRows` | `(rows: Set<string> \| (prev: Set<string>) => Set<string>) => void` | Set selected rows |
| `toggleRowSelected` | `(rowId: string) => void` | Toggle row selection |
| `clearSelectedRows` | `() => void` | Clear all selections |
| `toggleRowExpanded` | `(rowId: string) => void` | Toggle row expansion |
| `expandRow` | `(rowId: string) => void` | Expand row |
| `collapseRow` | `(rowId: string) => void` | Collapse row |
| `collapseAllRows` | `() => void` | Collapse all rows |
| `setColumnVisibility` | `(visibility: Record<string, boolean> \| (prev: Record<string, boolean>) => Record<string, boolean>) => void` | Set column visibility |
| `toggleColumnVisibility` | `(columnName: string) => void` | Toggle column visibility |
| `setColumnVisible` | `(columnName: string, visible: boolean) => void` | Set column visibility |
| `setColumnOrder` | `(order: string[]) => void` | Set column order |
| `moveColumn` | `(columnName: string, newIndex: number) => void` | Move column |
| `setRowWindow` | `(window: { startIndex: number; endIndex: number }) => void` | Set row window |
| `toggleSidebar` | `() => void` | Toggle sidebar |
| `setSidebarOpen` | `(open: boolean) => void` | Set sidebar state |
| `reset` | `() => void` | Reset UI state |

### SQL Store

#### State

| Property | Type | Description |
|----------|------|-------------|
| `tabs` | `SqlTab[]` | Open tabs |
| `activeTabId` | `string \| null` | Active tab ID |
| `history` | `SqlHistoryEntry[]` | Query history |
| `selectedDatabase` | `string` | Selected database |
| `databases` | `string[]` | Available databases |
| `tables` | `Array<{ name: string; engine: string }>` | Available tables |

#### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `addTab` | `(tab?: Partial<SqlQueryTab>) => string` | Add new tab |
| `updateTab` | `(id: string, updates: Partial<SqlTab>) => void` | Update tab |
| `removeTab` | `(id: string) => void` | Remove tab |
| `setActiveTab` | `(id: string) => void` | Set active tab |
| `getActiveQueryTab` | `() => SqlQueryTab \| null` | Get active query tab |
| `addToHistory` | `(entry: Omit<SqlHistoryEntry, "id" \| "timestamp">) => void` | Add to history |
| `clearHistory` | `() => void` | Clear history |
| `setSelectedDatabase` | `(db: string) => void` | Set database |
| `setDatabases` | `(dbs: string[]) => void` | Set databases |
| `setTables` | `(tables: Array<{ name: string; engine: string }>) => void` | Set tables |
| `getColumnsForTable` | `(database: string, table: string) => string[]` | Get columns |

## Troubleshooting

### Issue: State not updating

**Symptom**: Component doesn't re-render when state changes.

**Solution**: Ensure you're using the hook correctly:

```typescript
// Correct: Destructure from hook
const { customFilter, setCustomFilter } = useDiscoverStore();

// Incorrect: Using store directly without hook
const state = useQueryStore.getState(); // Won't trigger re-renders
```

### Issue: Type errors

**Symptom**: TypeScript errors about incompatible types.

**Solution**: Check that you're importing the correct types:

```typescript
import type { FlexibleTimeRange } from "@/lib/types/discover";
import type { SortingState } from "@tanstack/react-table";
```

### Issue: Performance degradation

**Symptom**: Component renders too often.

**Solution**: Use specific selectors:

```typescript
// Before: Re-renders on any state change
const state = useDiscoverStore();

// After: Re-renders only when customFilter changes
const customFilter = useQueryStore((state) => state.customFilter);
```

### Issue: Migration tracker not updating

**Symptom**: Migration progress shows 0%.

**Solution**: Register components with the tracker:

```typescript
import { migrationTracker } from "@/lib/state/migration";

migrationTracker.register("MyComponent", {
  strategy: "zustand",
  componentName: "MyComponent",
  storeName: "discover-query",
  migratedAt: new Date(),
  syncErrors: 0,
  lastSyncAt: null,
});
```

## Best Practices

1. **Migrate incrementally**: One component at a time
2. **Test thoroughly**: Verify functionality after each migration
3. **Use selectors**: Optimize performance with specific selectors
4. **Keep old hooks**: Don't remove until all components are migrated
5. **Document progress**: Update migration tracker as you go

## Migration Checklist

- [ ] Identify all components using state hooks
- [ ] Update imports to use adapter hooks
- [ ] Test each component after migration
- [ ] Optimize selectors for performance
- [ ] Update migration tracker
- [ ] Remove old hooks (after full migration)
- [ ] Update documentation

## Support

For questions or issues during migration:

1. Check this guide for solutions
2. Review the test files for examples
3. Consult the Zustand documentation
4. Ask the team for help
