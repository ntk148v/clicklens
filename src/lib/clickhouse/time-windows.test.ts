import { describe, test, expect } from "bun:test";
import {
  generateTimeWindowsDescending,
  shouldUseWindowing,
} from "./time-windows";

describe("Time Windows", () => {
  test("shouldUseWindowing returns false for small time ranges", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-01T12:00:00Z"); // 12 hours

    expect(shouldUseWindowing(startDate, endDate)).toBe(false);
  });

  test("shouldUseWindowing returns true for large time ranges", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-02T00:00:00Z"); // 24 hours

    expect(shouldUseWindowing(startDate, endDate)).toBe(true);
  });

  test("generateTimeWindowsDescending generates windows in descending order", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-02T00:00:00Z"); // 24 hours

    const windows = generateTimeWindowsDescending(startDate, endDate);

    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].direction).toBe("DESC");
    expect(windows[0].endTime.getTime()).toBe(endDate.getTime());
    expect(windows[windows.length - 1].startTime.getTime()).toBe(startDate.getTime());
  });

  test("generateTimeWindowsDescending uses default window sizes", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-03T00:00:00Z"); // 48 hours

    const windows = generateTimeWindowsDescending(startDate, endDate);

    expect(windows.length).toBeGreaterThan(1);
    windows.forEach((window, index) => {
      expect(window.windowIndex).toBe(index);
      expect(window.direction).toBe("DESC");
    });
  });

  test("generateTimeWindowsDescending handles custom window sizes", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-01T03:00:00Z"); // 3 hours

    const customWindows = [3600, 3600, 3600]; // 3 x 1 hour windows
    const windows = generateTimeWindowsDescending(startDate, endDate, customWindows);

    expect(windows.length).toBe(3);
  });

  test("generateTimeWindowsDescending handles exact time range", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-01T06:00:00Z"); // 6 hours

    const windows = generateTimeWindowsDescending(startDate, endDate);

    expect(windows.length).toBe(1);
    expect(windows[0].startTime.getTime()).toBe(startDate.getTime());
    expect(windows[0].endTime.getTime()).toBe(endDate.getTime());
  });

  test("generateTimeWindowsDescending handles very large time ranges", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-02-01T00:00:00Z"); // 31 days

    const windows = generateTimeWindowsDescending(startDate, endDate);

    expect(windows.length).toBeGreaterThan(4);
    windows.forEach((window) => {
      expect(window.startTime.getTime()).toBeLessThanOrEqual(window.endTime.getTime());
    });
  });

  test("generateTimeWindowsDescending windows are contiguous", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-02T00:00:00Z");

    const windows = generateTimeWindowsDescending(startDate, endDate);

    for (let i = 0; i < windows.length - 1; i++) {
      expect(windows[i].startTime.getTime()).toBe(windows[i + 1].endTime.getTime());
    }
  });
});