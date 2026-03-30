import { describe, it, expect, beforeAll } from "bun:test";
import { existsSync, readFileSync } from "fs";

interface BenchmarkResults {
  timestamp: string;
  renderPerformance: {
    rows100: { initialRender: number; rowsRendered: number };
    rows1000: { initialRender: number; rowsRendered: number };
    rows10000: { initialRender: number; rowsRendered: number };
  };
  scrollPerformance: {
    fps100Rows: number;
    fps1000Rows: number;
    fps10000Rows: number;
  };
  memoryUsage: {
    initial: number;
    after100Rows: number;
    after1000Rows: number;
    after10000Rows: number;
    peak: number;
  };
  baseline: {
    beforeRefactor: {
      scrollFps10000Rows: number;
      memoryPeak: number;
      renderInitial: number;
    };
    afterRefactor: {
      scrollFps10000Rows: number;
      memoryPeak: number;
      renderInitial: number;
    };
    improvements: {
      scrollFpsImprovement: number;
      memoryReduction: number;
      renderTimeReduction: number;
    };
  };
}

describe("Virtualization Performance Benchmarks", () => {
  const baselinePath = ".sisyphus/baseline/after-virtualization.json";

  describe("Benchmark Results", () => {
    let results: BenchmarkResults | null = null;

    beforeAll(() => {
      if (existsSync(baselinePath)) {
        const content = readFileSync(baselinePath, "utf-8");
        results = JSON.parse(content) as BenchmarkResults;
      }
    });

    it("should have benchmark results file", () => {
      expect(existsSync(baselinePath)).toBe(true);
    });

    it("should render 100 rows efficiently", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.renderPerformance.rows100.initialRender).toBeLessThan(50);
        expect(results.renderPerformance.rows100.rowsRendered).toBeLessThan(100);
      }
    });

    it("should render 1000 rows efficiently", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.renderPerformance.rows1000.initialRender).toBeLessThan(50);
        expect(results.renderPerformance.rows1000.rowsRendered).toBeLessThan(100);
      }
    });

    it("should render 10000 rows efficiently", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.renderPerformance.rows10000.initialRender).toBeLessThan(50);
        expect(results.renderPerformance.rows10000.rowsRendered).toBeLessThan(100);
      }
    });

    it("should have virtualized rows rendered (less than total)", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.renderPerformance.rows10000.rowsRendered).toBeLessThan(10000);
        expect(results.renderPerformance.rows1000.rowsRendered).toBeLessThan(1000);
      }
    });

    it("should maintain 60fps for small datasets", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.scrollPerformance.fps100Rows).toBeGreaterThanOrEqual(55);
      }
    });

    it("should maintain good fps for medium datasets", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.scrollPerformance.fps1000Rows).toBeGreaterThanOrEqual(55);
      }
    });

    it("should maintain acceptable fps for large datasets", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.scrollPerformance.fps10000Rows).toBeGreaterThanOrEqual(50);
      }
    });

    it("should have improved fps compared to baseline", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.baseline.improvements.scrollFpsImprovement).toBeGreaterThan(0);
      }
    });

    it("should have reasonable initial memory", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.memoryUsage.initial).toBeLessThan(50);
      }
    });

    it("should have controlled memory growth with large datasets", () => {
      expect(results).not.toBeNull();
      if (results) {
        const growth = results.memoryUsage.after10000Rows - results.memoryUsage.initial;
        expect(growth).toBeLessThan(50);
      }
    });

    it("should have improved memory compared to baseline", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.baseline.improvements.memoryReduction).toBeGreaterThan(0);
      }
    });

    it("should show scroll FPS improvement", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.baseline.improvements.scrollFpsImprovement).toBeGreaterThan(0);
      }
    });

    it("should show memory reduction", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.baseline.improvements.memoryReduction).toBeGreaterThan(0);
      }
    });

    it("should show render time reduction", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.baseline.improvements.renderTimeReduction).toBeGreaterThan(0);
      }
    });

    it("should have valid timestamp", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.timestamp).toBeDefined();
        expect(new Date(results.timestamp).getTime()).toBeGreaterThan(0);
      }
    });

    it("should have all required metrics", () => {
      expect(results).not.toBeNull();
      if (results) {
        expect(results.renderPerformance).toBeDefined();
        expect(results.scrollPerformance).toBeDefined();
        expect(results.memoryUsage).toBeDefined();
        expect(results.baseline).toBeDefined();
      }
    });
  });

  describe("Virtualization Configuration", () => {
    it("should use fixed row height from config", async () => {
      const { DEFAULT_ROW_HEIGHT } = await import("@/lib/virtual/virtual.config");
      expect(DEFAULT_ROW_HEIGHT).toBe(34);
    });

    it("should use overscan from config", async () => {
      const { DEFAULT_OVERSCAN } = await import("@/lib/virtual/virtual.config");
      expect(DEFAULT_OVERSCAN).toBe(5);
    });
  });
});
