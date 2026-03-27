"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { MetadataCache } from "@/lib/clickhouse/metadata-cache";
import type {
  TableSchema,
  ColumnMetadata,
  TimeColumnCandidate,
} from "@/lib/types/discover";

const COLUMN_PREFS_PREFIX = "clicklens_discover_columns_";
const DEFAULT_COLUMN_COUNT = 10;

export interface ColumnPreferences {
  columns: string[];
  timeColumn: string;
}

export interface UseDiscoverSchemaOptions {
  selectedDatabase: string;
  selectedTable: string;
  onSchemaLoaded?: (schema: TableSchema) => void;
}

export interface UseDiscoverSchemaReturn {
  schema: TableSchema | null;
  schemaLoading: boolean;
  loadColumnPreferences: (db: string, table: string) => ColumnPreferences | null;
  saveColumnPreferences: (db: string, table: string, columns: string[], timeColumn: string) => void;
  applyDefaultColumns: (schema: TableSchema) => string[];
  selectDefaultTimeColumn: (schema: TableSchema) => string;
  invalidateCache: () => void;
}

/**
 * Load column preferences from localStorage
 */
export function loadColumnPrefs(
  db: string,
  table: string,
): ColumnPreferences | null {
  try {
    const raw = localStorage.getItem(`${COLUMN_PREFS_PREFIX}${db}.${table}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save column preferences to localStorage
 */
export function saveColumnPrefs(
  db: string,
  table: string,
  columns: string[],
  timeColumn: string,
): void {
  try {
    localStorage.setItem(
      `${COLUMN_PREFS_PREFIX}${db}.${table}`,
      JSON.stringify({ columns, timeColumn }),
    );
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Remove column preferences from localStorage
 */
export function removeColumnPrefs(db: string, table: string): void {
  try {
    localStorage.removeItem(`${COLUMN_PREFS_PREFIX}${db}.${table}`);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Hook for managing table schema loading and column preferences
 * Handles schema fetching with caching and column preference management
 */
export function useDiscoverSchema(options: UseDiscoverSchemaOptions): UseDiscoverSchemaReturn {
  const { selectedDatabase, selectedTable, onSchemaLoaded } = options;

  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const schemaCache = useMemo(() => new MetadataCache(), []);

  // Invalidate cache when database/table changes
  useEffect(() => {
    if (selectedDatabase && selectedTable) {
      const cacheKey = `${selectedDatabase}.${selectedTable}`;
      schemaCache.invalidate(cacheKey);
    }
  }, [selectedDatabase, selectedTable, schemaCache]);

  // Load schema when database/table changes
  useEffect(() => {
    if (!selectedDatabase || !selectedTable) {
      setSchema(null);
      return;
    }

    const cacheKey = `${selectedDatabase}.${selectedTable}`;

    const loadSchema = async () => {
      setSchemaLoading(true);
      try {
        const fetchSchema = async () => {
          const res = await fetch(
            `/api/clickhouse/schema/table-columns?database=${encodeURIComponent(selectedDatabase)}&table=${encodeURIComponent(selectedTable)}`,
          );
          const data = await res.json();
          if (data.success && data.data) {
            return data.data;
          } else if (data.error) {
            throw new Error(data.error.userMessage || data.error);
          }
          throw new Error("Failed to load schema");
        };

        const tableSchema = await schemaCache.getOrFetch(cacheKey, fetchSchema);
        setSchema(tableSchema);
        onSchemaLoaded?.(tableSchema);
      } catch (err) {
        console.error("Failed to load schema:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to load table schema",
        });
        setSchema(null);
      } finally {
        setSchemaLoading(false);
      }
    };

    loadSchema();
  }, [selectedDatabase, selectedTable, schemaCache, onSchemaLoaded]);

  const loadColumnPreferences = useCallback((db: string, table: string) => {
    return loadColumnPrefs(db, table);
  }, []);

  const saveColumnPreferences = useCallback((db: string, table: string, columns: string[], timeColumn: string) => {
    saveColumnPrefs(db, table, columns, timeColumn);
  }, []);

  const applyDefaultColumns = useCallback((schema: TableSchema): string[] => {
    return schema.columns
      .slice(0, DEFAULT_COLUMN_COUNT)
      .map((c: ColumnMetadata) => c.name);
  }, []);

  const selectDefaultTimeColumn = useCallback((schema: TableSchema): string => {
    const primaryDateTime = schema.timeColumns.find(
      (tc: TimeColumnCandidate) =>
        tc.isPrimary &&
        (tc.type.startsWith("DateTime") || tc.type.startsWith("DateTime64")),
    );
    if (primaryDateTime) {
      return primaryDateTime.name;
    }

    const primary = schema.timeColumns.find(
      (tc: TimeColumnCandidate) => tc.isPrimary,
    );
    if (primary) {
      return primary.name;
    }

    const anyDateTime = schema.timeColumns.find(
      (tc: TimeColumnCandidate) =>
        tc.type.startsWith("DateTime") || tc.type.startsWith("DateTime64"),
    );
    if (anyDateTime) {
      return anyDateTime.name;
    }

    if (schema.timeColumns.length > 0) {
      return schema.timeColumns[0].name;
    }

    return "";
  }, []);

  const invalidateCache = useCallback(() => {
    if (selectedDatabase && selectedTable) {
      const cacheKey = `${selectedDatabase}.${selectedTable}`;
      schemaCache.invalidate(cacheKey);
    }
  }, [selectedDatabase, selectedTable, schemaCache]);

  return {
    schema,
    schemaLoading,
    loadColumnPreferences,
    saveColumnPreferences,
    applyDefaultColumns,
    selectDefaultTimeColumn,
    invalidateCache,
  };
}
