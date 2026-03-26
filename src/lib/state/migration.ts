import { useRef, useEffect, useState } from "react";
import type { StoreApi, UseBoundStore } from "zustand";

export type MigrationStrategy = "zustand" | "hooks" | "adapter";

export interface MigrationConfig {
  strategy: MigrationStrategy;
  componentName: string;
  storeName?: string;
  debug?: boolean;
}

export interface AdapterHookResult<TState, TActions> {
  state: TState;
  actions: TActions;
  isUsingZustand: boolean;
  migrationStatus: MigrationStatus;
}

export interface MigrationStatus {
  strategy: MigrationStrategy;
  componentName: string;
  storeName: string;
  migratedAt: Date | null;
  syncErrors: number;
  lastSyncAt: Date | null;
}

export interface SyncConfig<T> {
  equalityFn?: (a: T, b: T) => boolean;
  debounceMs?: number;
  syncOnMount?: boolean;
  syncOnUnmount?: boolean;
}

function defaultEqualityFn<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      (a as Record<string, unknown>)[key] !==
        (b as Record<string, unknown>)[key]
    ) {
      return false;
    }
  }

  return true;
}

function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

export function createStateSynchronizer<T>(
  config: SyncConfig<T> = {},
): {
  sync: (hookState: T, storeState: T, onSync: (state: T) => void) => void;
  cleanup: () => void;
} {
  const { equalityFn = defaultEqualityFn, debounceMs = 0 } = config;

  let isDestroyed = false;

  const performSync = (
    hookState: T,
    storeState: T,
    onSync: (state: T) => void,
  ) => {
    if (isDestroyed) return;
    if (!equalityFn(hookState, storeState)) {
      onSync(hookState);
    }
  };

  const syncFn = debounceMs > 0 ? debounce(performSync, debounceMs) : performSync;

  return {
    sync: (hookState: T, storeState: T, onSync: (state: T) => void) => {
      if (isDestroyed) return;
      syncFn(hookState, storeState, onSync);
    },
    cleanup: () => {
      isDestroyed = true;
      if ("cancel" in syncFn && typeof syncFn.cancel === "function") {
        syncFn.cancel();
      }
    },
  };
}

export function createAdapterHook<
  TStore extends UseBoundStore<StoreApi<TState>>,
  TState,
  TActions,
>(
  store: TStore,
  stateSelector: (state: TState) => Partial<TState>,
  actionsSelector: (state: TState) => TActions,
  config: MigrationConfig,
): () => AdapterHookResult<Partial<TState>, TActions> {
  const { componentName, storeName, debug = false } = config;

  return function useAdapter(): AdapterHookResult<Partial<TState>, TActions> {
    const migrationStatusRef = useRef<MigrationStatus>({
      strategy: "adapter",
      componentName,
      storeName: storeName || "unknown",
      migratedAt: new Date(),
      syncErrors: 0,
      lastSyncAt: null,
    });

    const state = store(stateSelector);
    const actions = store(actionsSelector);

    useEffect(() => {
      migrationStatusRef.current.lastSyncAt = new Date();

      if (debug) {
        console.log(
          `[Migration] ${componentName} synced with ${storeName}`,
          state,
        );
      }
    }, [state, debug, componentName, storeName]);

    return {
      state,
      actions,
      isUsingZustand: true,
      migrationStatus: migrationStatusRef.current,
    };
  };
}

export interface MigrationProgress {
  totalComponents: number;
  migratedComponents: number;
  pendingComponents: number;
  percentage: number;
  components: Array<{
    name: string;
    status: MigrationStatus;
  }>;
}

export function createMigrationTracker(): {
  register: (name: string, status: MigrationStatus) => void;
  unregister: (name: string) => void;
  getProgress: () => MigrationProgress;
  getStatus: (name: string) => MigrationStatus | undefined;
} {
  const components = new Map<string, MigrationStatus>();

  return {
    register: (name: string, status: MigrationStatus) => {
      components.set(name, status);
    },

    unregister: (name: string) => {
      components.delete(name);
    },

    getProgress: () => {
      const totalComponents = components.size;
      const migratedComponents = Array.from(components.values()).filter(
        (s) => s.strategy === "zustand",
      ).length;

      return {
        totalComponents,
        migratedComponents,
        pendingComponents: totalComponents - migratedComponents,
        percentage:
          totalComponents > 0
            ? Math.round((migratedComponents / totalComponents) * 100)
            : 0,
        components: Array.from(components.entries()).map(([name, status]) => ({
          name,
          status,
        })),
      };
    },

    getStatus: (name: string) => {
      return components.get(name);
    },
  };
}

export const migrationTracker = createMigrationTracker();

export function useMigrationProgress(): MigrationProgress {
  const [progress, setProgress] = useState<MigrationProgress>(
    migrationTracker.getProgress(),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(migrationTracker.getProgress());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return progress;
}

export function createActionMapper<THookActions, TStoreActions>(
  mapper: (storeActions: TStoreActions) => THookActions,
): (storeActions: TStoreActions) => THookActions {
  return mapper;
}

export function createStateMapper<THookState, TStoreState>(
  mapper: (storeState: TStoreState) => THookState,
): (storeState: TStoreState) => THookState {
  return mapper;
}

export function isUsingZustand(componentName: string): boolean {
  const status = migrationTracker.getStatus(componentName);
  return status?.strategy === "zustand" || status?.strategy === "adapter";
}

export function getMigrationStatus(
  componentName: string,
): MigrationStatus | undefined {
  return migrationTracker.getStatus(componentName);
}
