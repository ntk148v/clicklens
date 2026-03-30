import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createStateSynchronizer,
  createMigrationTracker,
  migrationTracker,
  createActionMapper,
  createStateMapper,
  isUsingZustand,
  getMigrationStatus,
} from "@/lib/state/migration";
import type { MigrationStatus } from "@/lib/state/migration";

describe("State Migration Utilities", () => {
  describe("createStateSynchronizer", () => {
    it("should create a synchronizer with default config", () => {
      const synchronizer = createStateSynchronizer();
      expect(synchronizer).toHaveProperty("sync");
      expect(synchronizer).toHaveProperty("cleanup");
    });

    it("should sync when states differ", () => {
      const synchronizer = createStateSynchronizer<{ count: number }>();
      let syncedState: { count: number } | null = null;

      synchronizer.sync(
        { count: 1 },
        { count: 2 },
        (state) => {
          syncedState = state;
        },
      );

      expect(syncedState).toEqual({ count: 1 });
    });

    it("should not sync when states are equal", () => {
      const synchronizer = createStateSynchronizer<{ count: number }>();
      let syncedState: { count: number } | null = null;

      synchronizer.sync(
        { count: 1 },
        { count: 1 },
        (state) => {
          syncedState = state;
        },
      );

      expect(syncedState).toBeNull();
    });

    it("should use custom equality function", () => {
      const synchronizer = createStateSynchronizer<{ count: number }>({
        equalityFn: (a, b) => a.count === b.count,
      });
      let syncedState: { count: number } | null = null;

      synchronizer.sync(
        { count: 1 },
        { count: 1 },
        (state) => {
          syncedState = state;
        },
      );

      expect(syncedState).toBeNull();
    });

    it("should cleanup properly", () => {
      const synchronizer = createStateSynchronizer<{ count: number }>();
      let syncedState: { count: number } | null = null;

      synchronizer.cleanup();

      synchronizer.sync(
        { count: 1 },
        { count: 2 },
        (state) => {
          syncedState = state;
        },
      );

      expect(syncedState).toBeNull();
    });

    it("should debounce sync when configured", async () => {
      const synchronizer = createStateSynchronizer<{ count: number }>({
        debounceMs: 50,
      });
      let syncCount = 0;

      synchronizer.sync(
        { count: 1 },
        { count: 2 },
        () => {
          syncCount++;
        },
      );

      synchronizer.sync(
        { count: 3 },
        { count: 2 },
        () => {
          syncCount++;
        },
      );

      expect(syncCount).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(syncCount).toBe(1);
    });
  });

  describe("createMigrationTracker", () => {
    let tracker: ReturnType<typeof createMigrationTracker>;

    beforeEach(() => {
      tracker = createMigrationTracker();
    });

    it("should create a tracker with correct interface", () => {
      expect(tracker).toHaveProperty("register");
      expect(tracker).toHaveProperty("unregister");
      expect(tracker).toHaveProperty("getProgress");
      expect(tracker).toHaveProperty("getStatus");
    });

    it("should register components", () => {
      const status: MigrationStatus = {
        strategy: "zustand",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      };

      tracker.register("TestComponent", status);

      expect(tracker.getStatus("TestComponent")).toEqual(status);
    });

    it("should unregister components", () => {
      const status: MigrationStatus = {
        strategy: "zustand",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      };

      tracker.register("TestComponent", status);
      tracker.unregister("TestComponent");

      expect(tracker.getStatus("TestComponent")).toBeUndefined();
    });

    it("should calculate progress correctly", () => {
      tracker.register("Component1", {
        strategy: "zustand",
        componentName: "Component1",
        storeName: "store1",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      });

      tracker.register("Component2", {
        strategy: "hooks",
        componentName: "Component2",
        storeName: "store2",
        migratedAt: null,
        syncErrors: 0,
        lastSyncAt: null,
      });

      tracker.register("Component3", {
        strategy: "adapter",
        componentName: "Component3",
        storeName: "store3",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      });

      const progress = tracker.getProgress();

      expect(progress.totalComponents).toBe(3);
      expect(progress.migratedComponents).toBe(1);
      expect(progress.pendingComponents).toBe(2);
      expect(progress.percentage).toBe(33);
    });

    it("should return 0% when no components", () => {
      const progress = tracker.getProgress();

      expect(progress.totalComponents).toBe(0);
      expect(progress.migratedComponents).toBe(0);
      expect(progress.pendingComponents).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it("should return 100% when all components migrated", () => {
      tracker.register("Component1", {
        strategy: "zustand",
        componentName: "Component1",
        storeName: "store1",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      });

      tracker.register("Component2", {
        strategy: "zustand",
        componentName: "Component2",
        storeName: "store2",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      });

      const progress = tracker.getProgress();

      expect(progress.totalComponents).toBe(2);
      expect(progress.migratedComponents).toBe(2);
      expect(progress.pendingComponents).toBe(0);
      expect(progress.percentage).toBe(100);
    });
  });

  describe("global migrationTracker", () => {
    afterEach(() => {
      migrationTracker.unregister("TestComponent");
    });

    it("should be a singleton", () => {
      expect(migrationTracker).toBeDefined();
      expect(typeof migrationTracker.register).toBe("function");
      expect(typeof migrationTracker.unregister).toBe("function");
    });

    it("should track component status", () => {
      const status: MigrationStatus = {
        strategy: "zustand",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      };

      migrationTracker.register("TestComponent", status);

      expect(migrationTracker.getStatus("TestComponent")).toEqual(status);
    });
  });

  describe("createActionMapper", () => {
    it("should create a mapper function", () => {
      const mapper = createActionMapper<
        { setCount: (count: number) => void },
        { setCount: (count: number) => void }
      >((storeActions) => ({
        setCount: storeActions.setCount,
      }));

      expect(typeof mapper).toBe("function");
    });

    it("should map actions correctly", () => {
      const mapper = createActionMapper<
        { setCount: (count: number) => void },
        { setCount: (count: number) => void }
      >((storeActions) => ({
        setCount: storeActions.setCount,
      }));

      const storeActions = {
        setCount: (count: number) => count,
      };

      const hookActions = mapper(storeActions);

      expect(hookActions.setCount).toBe(storeActions.setCount);
    });
  });

  describe("createStateMapper", () => {
    it("should create a mapper function", () => {
      const mapper = createStateMapper<
        { count: number },
        { count: number; extra: string }
      >((storeState) => ({
        count: storeState.count,
      }));

      expect(typeof mapper).toBe("function");
    });

    it("should map state correctly", () => {
      const mapper = createStateMapper<
        { count: number },
        { count: number; extra: string }
      >((storeState) => ({
        count: storeState.count,
      }));

      const storeState = {
        count: 42,
        extra: "ignored",
      };

      const hookState = mapper(storeState);

      expect(hookState).toEqual({ count: 42 });
    });
  });

  describe("isUsingZustand", () => {
    afterEach(() => {
      migrationTracker.unregister("TestComponent");
    });

    it("should return true for zustand strategy", () => {
      migrationTracker.register("TestComponent", {
        strategy: "zustand",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      });

      expect(isUsingZustand("TestComponent")).toBe(true);
    });

    it("should return true for adapter strategy", () => {
      migrationTracker.register("TestComponent", {
        strategy: "adapter",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      });

      expect(isUsingZustand("TestComponent")).toBe(true);
    });

    it("should return false for hooks strategy", () => {
      migrationTracker.register("TestComponent", {
        strategy: "hooks",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: null,
        syncErrors: 0,
        lastSyncAt: null,
      });

      expect(isUsingZustand("TestComponent")).toBe(false);
    });

    it("should return false for unknown component", () => {
      expect(isUsingZustand("UnknownComponent")).toBe(false);
    });
  });

  describe("getMigrationStatus", () => {
    afterEach(() => {
      migrationTracker.unregister("TestComponent");
    });

    it("should return status for registered component", () => {
      const status: MigrationStatus = {
        strategy: "zustand",
        componentName: "TestComponent",
        storeName: "test-store",
        migratedAt: new Date(),
        syncErrors: 0,
        lastSyncAt: null,
      };

      migrationTracker.register("TestComponent", status);

      expect(getMigrationStatus("TestComponent")).toEqual(status);
    });

    it("should return undefined for unregistered component", () => {
      expect(getMigrationStatus("UnknownComponent")).toBeUndefined();
    });
  });
});
