import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi } from "@/lib/api/client";
import { useAuth } from "@/components/auth";

export interface ClickHouseSetting {
  name: string;
  value: string;
  changed: number; // 0 or 1
  description: string;
  type: string;
  min?: string | null;
  max?: string | null;
  readonly?: number; // 0 or 1 (session-only)
  default?: string; // (server-only)
  is_hot_reloadable?: number; // 0 or 1 (server-only)
}

interface UseSettingsResponse {
  settings: ClickHouseSetting[];
  isLoading: boolean;
  error: string | null;
  updateSetting: (name: string, value: string | number) => Promise<void>;
  mutate: () => Promise<void>;
}

export type SettingsScope = "session" | "server";

const SEARCH_DEBOUNCE_MS = 350;

export function useSettings(
  search: string = "",
  scope: SettingsScope = "session"
): UseSettingsResponse {
  const { csrfToken } = useAuth();
  const [settings, setSettings] = useState<ClickHouseSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchApi(
        `/api/clickhouse/settings?search=${encodeURIComponent(
          debouncedSearch
        )}&scope=${scope}`
      );
      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
      } else {
        setError(data.error || "Failed to fetch settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch settings");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSetting = async (name: string, value: string | number) => {
    try {
      const response = await fetchApi("/api/clickhouse/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
        body: JSON.stringify({ name, value }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update setting");
      }

      await fetchData();
    } catch (err) {
      throw err;
    }
  };

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    mutate: fetchData,
  };
}
