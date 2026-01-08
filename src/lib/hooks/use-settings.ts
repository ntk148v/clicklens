import { useState, useEffect, useCallback } from "react";

export interface ClickHouseSetting {
  name: string;
  value: string;
  changed: number; // 0 or 1
  description: string;
  type: string;
  min?: string | null;
  max?: string | null;
  readonly: number; // 0 or 1
}

interface UseSettingsResponse {
  settings: ClickHouseSetting[];
  isLoading: boolean;
  error: any;
  updateSetting: (name: string, value: string | number) => Promise<void>;
  mutate: () => Promise<void>;
}

export function useSettings(search: string = ""): UseSettingsResponse {
  const [settings, setSettings] = useState<ClickHouseSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/clickhouse/settings?search=${encodeURIComponent(search)}`
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
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSetting = async (name: string, value: string | number) => {
    try {
      const response = await fetch("/api/clickhouse/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
