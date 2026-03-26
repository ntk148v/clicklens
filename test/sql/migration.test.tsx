import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE_PATH = join(
  process.cwd(),
  "src/app/(app)/sql/page.tsx"
);

const HOOK_PATH = join(
  process.cwd(),
  "src/lib/hooks/use-sql-page.ts"
);

function getPageSource(): string {
  return readFileSync(PAGE_PATH, "utf-8");
}

function getHookSource(): string {
  return readFileSync(HOOK_PATH, "utf-8");
}

describe("SQL Console Page Migration", () => {
  describe("Zustand Store Integration", () => {
    test("hook imports useSqlQueryStore from query-store", () => {
      const source = getHookSource();
      expect(source).toContain('import { useSqlQueryStore }');
      expect(source).toContain('from "@/stores/sql/query-store"');
    });

    test("hook imports createSqlDataStore from data-store", () => {
      const source = getHookSource();
      expect(source).toContain('import { createSqlDataStore }');
      expect(source).toContain('from "@/stores/sql/data-store"');
    });

    test("hook imports useSqlUIStore from ui-store", () => {
      const source = getHookSource();
      expect(source).toContain('import { useSqlUIStore }');
      expect(source).toContain('from "@/stores/sql/ui-store"');
    });

    test("page does NOT import useTabsStore directly", () => {
      const source = getPageSource();
      expect(source).not.toContain('import { useTabsStore }');
    });

    test("page does NOT import useSqlBrowserStore directly", () => {
      const source = getPageSource();
      expect(source).not.toContain('import { useSqlBrowserStore }');
    });
  });

  describe("VirtualizedResultGrid Integration", () => {
    test("page imports VirtualizedResultGrid", () => {
      const source = getPageSource();
      expect(source).toContain('VirtualizedResultGrid');
      expect(source).toContain('from "@/components/sql"');
    });

    test("page does NOT import ResultGrid", () => {
      const source = getPageSource();
      expect(source).not.toContain('import { ResultGrid }');
      expect(source).not.toContain('from "@/components/sql/ResultGrid"');
    });

    test("page uses VirtualizedResultGrid component", () => {
      const source = getPageSource();
      expect(source).toContain('<VirtualizedResultGrid');
    });

    test("page does NOT use ResultGrid component", () => {
      const source = getPageSource();
      expect(source).not.toContain('<ResultGrid');
    });
  });

  describe("Store Usage in Component", () => {
    test("page uses useSqlPage hook", () => {
      const source = getPageSource();
      expect(source).toContain('useSqlPage()');
    });

    test("page imports useSqlPage from hooks", () => {
      const source = getPageSource();
      expect(source).toContain('import { useSqlPage }');
      expect(source).toContain('from "@/lib/hooks/use-sql-page"');
    });

    test("hook uses useSqlQueryStore", () => {
      const source = getHookSource();
      expect(source).toContain('useSqlQueryStore()');
    });

    test("hook uses createSqlDataStore", () => {
      const source = getHookSource();
      expect(source).toContain('createSqlDataStore()');
    });

    test("hook uses useSqlUIStore", () => {
      const source = getHookSource();
      expect(source).toContain('useSqlUIStore()');
    });
  });

  describe("Functionality Preservation", () => {
    test("page still has query execution functionality", () => {
      const source = getPageSource();
      expect(source).toContain('handleExecute');
    });

    test("page still has tab management functionality", () => {
      const source = getPageSource();
      expect(source).toContain('QueryTabs');
    });

    test("page still has history functionality", () => {
      const source = getPageSource();
      expect(source).toContain('QueryHistory');
      expect(source).toContain('handleHistorySelect');
    });

    test("page still has save query functionality", () => {
      const source = getPageSource();
      expect(source).toContain('SaveQueryDialog');
      expect(source).toContain('SavedQueries');
    });

    test("page still has EXPLAIN functionality", () => {
      const source = getPageSource();
      expect(source).toContain('ExplainButton');
      expect(source).toContain('ExplainVisualizer');
      expect(source).toContain('handleExplain');
    });

    test("page still has table preview functionality", () => {
      const source = getPageSource();
      expect(source).toContain('TablePreview');
    });

    test("page still has time range selector", () => {
      const source = getPageSource();
      expect(source).toContain('TimeRangeSelector');
      expect(source).toContain('handleApplyTimeRange');
    });

    test("page still has database selector", () => {
      const source = getPageSource();
      expect(source).toContain('DatabaseSelector');
    });

    test("page still has table sidebar", () => {
      const source = getPageSource();
      expect(source).toContain('TableSidebar');
    });

    test("page still has cancel query functionality", () => {
      const source = getPageSource();
      expect(source).toContain('handleCancel');
    });

    test("page still has keyboard shortcuts", () => {
      const source = getPageSource();
      expect(source).toContain('Ctrl+Enter');
      expect(source).toContain('Shift+Enter');
    });

    test("page still has access denied check", () => {
      const source = getPageSource();
      expect(source).toContain('Access Denied');
      expect(source).toContain('canExecuteQueries');
    });

    test("page still has error display", () => {
      const source = getPageSource();
      expect(source).toContain('SqlResultSkeleton');
    });

    test("page still has loading state", () => {
      const source = getPageSource();
      expect(source).toContain('isLoading');
    });
  });

  describe("VirtualizedResultGrid Props", () => {
    test("VirtualizedResultGrid receives data prop", () => {
      const source = getPageSource();
      expect(source).toContain('data={activeQueryTab.result.data}');
    });

    test("VirtualizedResultGrid receives meta prop", () => {
      const source = getPageSource();
      expect(source).toContain('meta={activeQueryTab.result.meta}');
    });

    test("VirtualizedResultGrid receives statistics prop", () => {
      const source = getPageSource();
      expect(source).toContain('statistics={activeQueryTab.result.statistics}');
    });

    test("VirtualizedResultGrid receives page prop", () => {
      const source = getPageSource();
      expect(source).toContain('page={tabPagination[activeTabId || ""]?.page || 0}');
    });

    test("VirtualizedResultGrid receives pageSize prop", () => {
      const source = getPageSource();
      expect(source).toContain('pageSize={');
    });

    test("VirtualizedResultGrid receives onPageChange prop", () => {
      const source = getPageSource();
      expect(source).toContain('onPageChange={handlePageChange}');
    });

    test("VirtualizedResultGrid receives onPageSizeChange prop", () => {
      const source = getPageSource();
      expect(source).toContain('onPageSizeChange={handlePageSizeChange}');
    });

    test("VirtualizedResultGrid receives isLoading prop", () => {
      const source = getPageSource();
      expect(source).toContain('isLoading={activeQueryTab.isRunning}');
    });

    test("VirtualizedResultGrid receives className prop", () => {
      const source = getPageSource();
      expect(source).toContain('className="h-full"');
    });
  });

  describe("Hook API Compatibility", () => {
    test("hook exports SqlPageState interface", () => {
      const source = getHookSource();
      expect(source).toContain('export interface SqlPageState');
    });

    test("hook exports SqlPageActions interface", () => {
      const source = getHookSource();
      expect(source).toContain('export interface SqlPageActions');
    });

    test("hook exports useSqlPage function", () => {
      const source = getHookSource();
      expect(source).toContain('export function useSqlPage()');
    });

    test("hook returns state and actions", () => {
      const source = getHookSource();
      expect(source).toContain('return {');
    });

    test("hook provides tabs state", () => {
      const source = getHookSource();
      expect(source).toContain('tabs,');
    });

    test("hook provides activeTabId state", () => {
      const source = getHookSource();
      expect(source).toContain('activeTabId,');
    });

    test("hook provides activeQueryTab state", () => {
      const source = getHookSource();
      expect(source).toContain('activeQueryTab,');
    });

    test("hook provides handleExecute action", () => {
      const source = getHookSource();
      expect(source).toContain('handleExecute,');
    });

    test("hook provides handleCancel action", () => {
      const source = getHookSource();
      expect(source).toContain('handleCancel,');
    });

    test("hook provides handleExplain action", () => {
      const source = getHookSource();
      expect(source).toContain('handleExplain,');
    });
  });
});
