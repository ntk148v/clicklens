import {
  TAILWIND_ROW_HEIGHTS,
  ROW_HEIGHT_SOURCES,
  calculateAverageRowHeight,
  validateFixedRowHeight,
  getRecommendedRowHeight,
  getRowHeightConfig,
} from "@/lib/virtual/row-height";
import { DEFAULT_ROW_HEIGHT } from "@/lib/virtual/virtual.config";

describe("row-height", () => {
  describe("TAILWIND_ROW_HEIGHTS", () => {
    it("should have correct h-8 value", () => {
      expect(TAILWIND_ROW_HEIGHTS.H8).toBe(32);
    });

    it("should have correct h-9 value", () => {
      expect(TAILWIND_ROW_HEIGHTS.H9).toBe(36);
    });

    it("should have correct h-10 value", () => {
      expect(TAILWIND_ROW_HEIGHTS.H10).toBe(40);
    });
  });

  describe("ROW_HEIGHT_SOURCES", () => {
    it("should have ch-ui baseline at 34px", () => {
      expect(ROW_HEIGHT_SOURCES.CH_UI).toBe(34);
    });

    it("should match default config value", () => {
      expect(ROW_HEIGHT_SOURCES.DEFAULT).toBe(DEFAULT_ROW_HEIGHT);
    });

    it("should have ResultGrid and DiscoverGrid at 34px", () => {
      expect(ROW_HEIGHT_SOURCES.RESULT_GRID).toBe(34);
      expect(ROW_HEIGHT_SOURCES.DISCOVER_GRID).toBe(34);
    });
  });

  describe("calculateAverageRowHeight", () => {
    it("should return default when empty array", () => {
      expect(calculateAverageRowHeight([])).toBe(DEFAULT_ROW_HEIGHT);
    });

    it("should calculate average correctly", () => {
      expect(calculateAverageRowHeight([34, 34, 34])).toBe(34);
      expect(calculateAverageRowHeight([32, 34, 36])).toBe(34);
      expect(calculateAverageRowHeight([30, 40])).toBe(35);
    });

    it("should round result", () => {
      expect(calculateAverageRowHeight([33, 34])).toBe(34);
      expect(calculateAverageRowHeight([33, 35])).toBe(34);
    });
  });

  describe("validateFixedRowHeight", () => {
    it("should return false for empty array", () => {
      expect(validateFixedRowHeight([], 34)).toBe(false);
    });

    it("should return true when all heights match target", () => {
      expect(validateFixedRowHeight([34, 34, 34], 34)).toBe(true);
    });

    it("should respect tolerance", () => {
      expect(validateFixedRowHeight([33, 35], 34, 1)).toBe(true);
      expect(validateFixedRowHeight([32, 36], 34, 1)).toBe(false);
    });

    it("should use default tolerance of 2", () => {
      expect(validateFixedRowHeight([32, 36], 34)).toBe(true);
      expect(validateFixedRowHeight([31, 37], 34)).toBe(false);
    });
  });

  describe("getRecommendedRowHeight", () => {
    it("should return 34px as optimal", () => {
      expect(getRecommendedRowHeight()).toBe(34);
    });

    it("should match DEFAULT_ROW_HEIGHT", () => {
      expect(getRecommendedRowHeight()).toBe(DEFAULT_ROW_HEIGHT);
    });
  });

  describe("getRowHeightConfig", () => {
    it("should return correct config structure", () => {
      const config = getRowHeightConfig();
      expect(config.height).toBe(34);
      expect(config.variableHeight).toBe(false);
      expect(config.source).toBe("config");
    });

    it("should always use fixed height", () => {
      const config = getRowHeightConfig();
      expect(config.variableHeight).toBe(false);
    });
  });
});
