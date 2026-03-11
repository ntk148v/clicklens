/**
 * Progressive Time Windowing
 *
 * Breaks large time ranges into manageable chunks for better performance.
 */

export interface TimeWindow {
  startTime: Date;
  endTime: Date;
  windowIndex: number;
  direction: "ASC" | "DESC";
}

const DEFAULT_TIME_WINDOWS_SECONDS = [
  6 * 60 * 60, // 6 hours
  6 * 60 * 60, // 6 hours
  12 * 60 * 60, // 12 hours
  24 * 60 * 60, // 24 hours
];

export function generateTimeWindowsDescending(
  startDate: Date,
  endDate: Date,
  windowDurationsSeconds: number[] = DEFAULT_TIME_WINDOWS_SECONDS,
): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let currentEnd = new Date(endDate);
  let windowIndex = 0;

  while (currentEnd > startDate) {
    // Use the window size at the current index, or the last one if we've run out
    const windowSizeSeconds =
      windowDurationsSeconds[Math.min(windowIndex, windowDurationsSeconds.length - 1)];
    const windowSizeMs = windowSizeSeconds * 1000;
    const windowStart = new Date(
      Math.max(currentEnd.getTime() - windowSizeMs, startDate.getTime()),
    );

    windows.push({
      startTime: windowStart,
      endTime: currentEnd,
      windowIndex,
      direction: "DESC",
    });

    currentEnd = windowStart;
    windowIndex++;
  }

  return windows;
}

export function shouldUseWindowing(
  startDate: Date,
  endDate: Date,
  thresholdMs: number = 24 * 60 * 60 * 1000, // 24 hours
): boolean {
  const duration = endDate.getTime() - startDate.getTime();
  return duration >= thresholdMs;
}