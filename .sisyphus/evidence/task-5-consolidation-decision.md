# Task 5: SQL Console State Management Consolidation

## Decision Summary

**DECISION: Keep `useTabsStore` as the single source of truth for tabs + history**

### Rationale

1. **Persistence Already Working**: `useTabsStore` has Zustand persist middleware configured and working
2. **No Data Migration Needed**: Users won't lose existing tabs or history
3. **Lower Risk**: Removing new stores is safer than migrating to them
4. **Feature Complete**: `useTabsStore` already handles all required functionality:
   - Tab creation, switching, closing
   - Query history tracking
   - Persistence across reloads
   - Table tabs support

### Changes Made

#### 1. Removed New Store Imports (src/lib/hooks/use-sql-page.ts)

**Before:**
```typescript
import { useTabsStore, initializeTabs } from "@/lib/store/tabs";
import { useSqlQueryStore } from "@/stores/sql/query-store";
import { createSqlDataStore } from "@/stores/sql/data-store";
import { useSqlUIStore } from "@/stores/sql/ui-store";
```

**After:**
```typescript
import { useTabsStore, initializeTabs } from "@/lib/store/tabs";
```

#### 2. Removed Dual History Tracking

**Before:**
```typescript
// History added to BOTH stores (duplication!)
addToHistory({ sql, duration, ... });
queryStore.addToHistory({ sql, duration, ... });
```

**After:**
```typescript
// History added to single store only
addToHistory({ sql, duration, ... });
```

#### 3. Updated SqlPageState Interface

**Before:**
```typescript
queryHistory: ReturnType<typeof useSqlQueryStore.getState>["queryHistory"];
```

**After:**
```typescript
queryHistory: ReturnType<typeof useTabsStore.getState>["history"];
```

#### 4. Removed Unused Store Instances

**Before:**
```typescript
const dataStore = createSqlDataStore();
const queryStore = useSqlQueryStore();
const uiStore = useSqlUIStore();
```

**After:**
```typescript
// No unused store instances
```

### Test Coverage

Created comprehensive integration tests in `src/lib/hooks/use-sql-page.test.ts`:

- **Tab Creation**: 4 tests
- **Tab Switching**: 4 tests
- **Tab Closing**: 3 tests
- **Tab Updates**: 4 tests
- **Query History**: 5 tests
- **History Persistence**: 1 test
- **Table Tabs**: 3 tests
- **Initialization**: 2 tests
- **State Consolidation Verification**: 2 tests

**Total: 28 tests, all passing**

### Files Modified

1. `src/lib/hooks/use-sql-page.ts` - Removed new store imports and consolidated to useTabsStore
2. `src/test-setup.ts` - Added localStorage mock for test environment
3. `src/lib/hooks/use-sql-page.test.ts` - Created integration tests (new file)

### Verification

- All 28 new tests pass
- No existing functionality broken
- History persistence verified
- Tab management works correctly
- No dual-store duplication

### Future Considerations

The new stores (`data-store.ts`, `query-store.ts`, `ui-store.ts`) still exist in the codebase but are no longer used by `use-sql-page.ts`. They can be:
1. Removed in a future cleanup PR
2. Kept for potential future use if needed

No action required now as they don't affect functionality.
