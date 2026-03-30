import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE_PATH = join(
  process.cwd(),
  "src/app/(app)/discover/page.tsx"
);

function getPageSource(): string {
  return readFileSync(PAGE_PATH, "utf-8");
}

describe("Discover Page Migration", () => {
  describe("Zustand Store Integration", () => {
    test("page imports useQueryStore from query-store", () => {
      const source = getPageSource();
      expect(source).toContain('import { useQueryStore }');
      expect(source).toContain('from "@/stores/discover/query-store"');
    });

    test("page imports createDiscoverDataStore from data-store", () => {
      const source = getPageSource();
      expect(source).toContain('import { createDiscoverDataStore }');
      expect(source).toContain('from "@/stores/discover/data-store"');
    });

    test("page imports useDiscoverUIStore from ui-store", () => {
      const source = getPageSource();
      expect(source).toContain('import { useDiscoverUIStore }');
      expect(source).toContain('from "@/stores/discover/ui-store"');
    });

    test("page does NOT import useDiscoverState", () => {
      const source = getPageSource();
      expect(source).not.toContain('useDiscoverState');
    });
  });

  describe("VirtualizedDiscoverGrid Integration", () => {
    test("page imports VirtualizedDiscoverGrid", () => {
      const source = getPageSource();
      expect(source).toContain('import { VirtualizedDiscoverGrid }');
      expect(source).toContain('from "@/components/discover/VirtualizedDiscoverGrid"');
    });

    test("page does NOT import DiscoverGrid", () => {
      const source = getPageSource();
      expect(source).not.toContain('import { DiscoverGrid }');
      expect(source).not.toContain('from "@/components/discover/DiscoverGrid"');
    });

    test("page uses VirtualizedDiscoverGrid component", () => {
      const source = getPageSource();
      expect(source).toContain('<VirtualizedDiscoverGrid');
    });

    test("page does NOT use DiscoverGrid component", () => {
      const source = getPageSource();
      expect(source).not.toContain('<DiscoverGrid');
    });
  });

  describe("Store Usage in Component", () => {
    test("page uses useDiscoverPage hook", () => {
      const source = getPageSource();
      expect(source).toContain('useDiscoverPage()');
    });

    test("page imports useDiscoverPage from hooks", () => {
      const source = getPageSource();
      expect(source).toContain('import { useDiscoverPage }');
      expect(source).toContain('from "@/lib/hooks/use-discover-page"');
    });
  });

  describe("Functionality Preservation", () => {
    test("page still has search functionality", () => {
      const source = getPageSource();
      expect(source).toContain('handleSearch');
    });

    test("page still has filter functionality", () => {
      const source = getPageSource();
      expect(source).toContain('filterForValue');
      expect(source).toContain('filterOutValue');
    });

    test("page still has sort functionality", () => {
      const source = getPageSource();
      expect(source).toContain('sorting');
      expect(source).toContain('setSorting');
    });

    test("page still has cancel query functionality", () => {
      const source = getPageSource();
      expect(source).toContain('cancelQuery');
    });

    test("page still has histogram functionality", () => {
      const source = getPageSource();
      expect(source).toContain('DiscoverHistogram');
      expect(source).toContain('histogramData');
    });

    test("page still has cache indicator", () => {
      const source = getPageSource();
      expect(source).toContain('CacheIndicator');
      expect(source).toContain('cacheMetadata');
    });

    test("page still has fields sidebar", () => {
      const source = getPageSource();
      expect(source).toContain('FieldsSidebar');
    });

    test("page still has query bar", () => {
      const source = getPageSource();
      expect(source).toContain('QueryBar');
    });

    test("page still has error display", () => {
      const source = getPageSource();
      expect(source).toContain('ErrorDisplay');
    });

    test("page still has time selector", () => {
      const source = getPageSource();
      expect(source).toContain('TimeSelector');
    });

    test("page still has refresh control", () => {
      const source = getPageSource();
      expect(source).toContain('RefreshControl');
    });

    test("page still has database selector", () => {
      const source = getPageSource();
      expect(source).toContain('selectedDatabase');
      expect(source).toContain('setSelectedDatabase');
    });

    test("page still has table selector", () => {
      const source = getPageSource();
      expect(source).toContain('selectedTable');
      expect(source).toContain('handleTableChange');
    });

    test("page still has pagination", () => {
      const source = getPageSource();
      expect(source).toContain('page');
      expect(source).toContain('pageSize');
      expect(source).toContain('setPage');
      expect(source).toContain('setPageSize');
    });

    test("page still has keyboard shortcuts", () => {
      const source = getPageSource();
      expect(source).toContain('onKeyDown');
      expect(source).toContain('Escape');
    });

    test("page still has access denied check", () => {
      const source = getPageSource();
      expect(source).toContain('AccessDenied');
      expect(source).toContain('canDiscover');
    });
  });

  describe("VirtualizedDiscoverGrid Props", () => {
    test("VirtualizedDiscoverGrid receives rows prop", () => {
      const source = getPageSource();
      expect(source).toContain('rows={rows}');
    });

    test("VirtualizedDiscoverGrid receives columns prop", () => {
      const source = getPageSource();
      expect(source).toContain('columns={schema.columns}');
    });

    test("VirtualizedDiscoverGrid receives selectedColumns prop", () => {
      const source = getPageSource();
      expect(source).toContain('selectedColumns={selectedColumns}');
    });

    test("VirtualizedDiscoverGrid receives isLoading prop", () => {
      const source = getPageSource();
      expect(source).toContain('isLoading={isLoading');
    });

    test("VirtualizedDiscoverGrid receives page prop", () => {
      const source = getPageSource();
      expect(source).toContain('page={page}');
    });

    test("VirtualizedDiscoverGrid receives pageSize prop", () => {
      const source = getPageSource();
      expect(source).toContain('pageSize={pageSize}');
    });

    test("VirtualizedDiscoverGrid receives totalHits prop", () => {
      const source = getPageSource();
      expect(source).toContain('totalHits={totalHits}');
    });

    test("VirtualizedDiscoverGrid receives onPageChange prop", () => {
      const source = getPageSource();
      expect(source).toContain('onPageChange={setPage}');
    });

    test("VirtualizedDiscoverGrid receives onPageSizeChange prop", () => {
      const source = getPageSource();
      expect(source).toContain('onPageSizeChange={setPageSize}');
    });

    test("VirtualizedDiscoverGrid receives sorting prop", () => {
      const source = getPageSource();
      expect(source).toContain('sorting={sorting}');
    });

    test("VirtualizedDiscoverGrid receives onSortingChange prop", () => {
      const source = getPageSource();
      expect(source).toContain('onSortingChange={setSorting}');
    });

    test("VirtualizedDiscoverGrid receives onFilterForValue prop", () => {
      const source = getPageSource();
      expect(source).toContain('onFilterForValue={filterForValue}');
    });

    test("VirtualizedDiscoverGrid receives onFilterOutValue prop", () => {
      const source = getPageSource();
      expect(source).toContain('onFilterOutValue={filterOutValue}');
    });
  });
});
