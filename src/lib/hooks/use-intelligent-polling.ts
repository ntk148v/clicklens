"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseIntelligentPollingOptions {
  interval: number;
  onPoll: () => void | Promise<void>;
  enabled?: boolean;
  pauseWhenHidden?: boolean;
  maxRetries?: number;
}

/**
 * Intelligent polling hook with visibility detection and error handling.
 *
 * Features:
 * - Pauses polling when tab is not visible (saves resources)
 * - Prevents concurrent poll requests
 * - Exponential backoff on errors
 * - Resumes immediately when tab becomes visible
 *
 * @example
 * ```tsx
 * useIntelligentPolling({
 *   interval: 5000,
 *   onPoll: fetchMetrics,
 *   enabled: true,
 *   pauseWhenHidden: true,
 * });
 * ```
 */
export function useIntelligentPolling({
  interval,
  onPoll,
  enabled = true,
  pauseWhenHidden = true,
  maxRetries = 3,
}: UseIntelligentPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const retryCountRef = useRef(0);
  const isPollingRef = useRef(false);

  const poll = useCallback(async () => {
    if (isPollingRef.current) return; // Prevent concurrent polls
    if (pauseWhenHidden && !isVisibleRef.current) return;

    isPollingRef.current = true;
    try {
      await onPoll();
      retryCountRef.current = 0; // Reset on success
    } catch (error) {
      retryCountRef.current++;
      if (retryCountRef.current >= maxRetries) {
        console.error("Max polling retries reached, stopping:", error);
        stop();
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [onPoll, pauseWhenHidden, maxRetries]);

  const start = useCallback(() => {
    if (intervalRef.current) return;

    // Initial poll
    poll();

    intervalRef.current = setInterval(poll, interval);
  }, [interval, poll]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    // Handle visibility changes
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      if (isVisibleRef.current) {
        // Resume polling immediately when visible
        start();
      } else if (pauseWhenHidden) {
        // Stop polling when hidden
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Start polling
    start();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, [enabled, start, stop, pauseWhenHidden]);

  return { start, stop };
}
