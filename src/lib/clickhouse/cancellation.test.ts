import { describe, it, expect, beforeEach } from "bun:test";
import { QueryCancellationManager } from "./cancellation";

describe("QueryCancellationManager", () => {
  let manager: QueryCancellationManager;

  beforeEach(() => {
    manager = new QueryCancellationManager();
  });

  describe("createController", () => {
    it("creates a new AbortController for a query ID", () => {
      const controller = manager.createController("query-1");
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });

    it("replaces existing controller for same query ID", () => {
      const controller1 = manager.createController("query-1");
      const controller2 = manager.createController("query-1");

      expect(controller1).not.toBe(controller2);
      expect(controller1.signal.aborted).toBe(true); // Old one should be aborted
      expect(controller2.signal.aborted).toBe(false);
    });

    it("tracks active controllers", () => {
      manager.createController("query-1");
      manager.createController("query-2");

      expect(manager.isActive("query-1")).toBe(true);
      expect(manager.isActive("query-2")).toBe(true);
      expect(manager.isActive("query-3")).toBe(false);
    });
  });

  describe("cancel", () => {
    it("aborts the controller for a specific query ID", () => {
      const controller = manager.createController("query-1");
      manager.cancel("query-1");

      expect(controller.signal.aborted).toBe(true);
      expect(manager.isActive("query-1")).toBe(false);
    });

    it("does nothing if query ID does not exist", () => {
      expect(() => manager.cancel("non-existent")).not.toThrow();
    });

    it("removes the controller from tracking after cancellation", () => {
      manager.createController("query-1");
      manager.cancel("query-1");

      expect(manager.isActive("query-1")).toBe(false);
    });
  });

  describe("cancelAll", () => {
    it("aborts all active controllers", () => {
      const controller1 = manager.createController("query-1");
      const controller2 = manager.createController("query-2");
      const controller3 = manager.createController("query-3");

      manager.cancelAll();

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
      expect(controller3.signal.aborted).toBe(true);
    });

    it("clears all controllers from tracking", () => {
      manager.createController("query-1");
      manager.createController("query-2");

      manager.cancelAll();

      expect(manager.isActive("query-1")).toBe(false);
      expect(manager.isActive("query-2")).toBe(false);
    });

    it("does nothing when no controllers exist", () => {
      expect(() => manager.cancelAll()).not.toThrow();
    });
  });

  describe("isActive", () => {
    it("returns true for active queries", () => {
      manager.createController("query-1");
      expect(manager.isActive("query-1")).toBe(true);
    });

    it("returns false for cancelled queries", () => {
      manager.createController("query-1");
      manager.cancel("query-1");
      expect(manager.isActive("query-1")).toBe(false);
    });

    it("returns false for non-existent queries", () => {
      expect(manager.isActive("non-existent")).toBe(false);
    });

    it("returns false for replaced controllers", () => {
      manager.createController("query-1");
      manager.createController("query-1"); // Replaces the first one
      expect(manager.isActive("query-1")).toBe(true); // New one is active
    });
  });

  describe("memory leak prevention", () => {
    it("cleans up controllers after cancellation", () => {
      manager.createController("query-1");
      manager.cancel("query-1");

      // Creating a new controller with same ID should work
      const newController = manager.createController("query-1");
      expect(newController.signal.aborted).toBe(false);
    });

    it("handles rapid create/cancel cycles", () => {
      for (let i = 0; i < 100; i++) {
        manager.createController(`query-${i}`);
        manager.cancel(`query-${i}`);
      }

      // All should be cleaned up
      expect(manager.isActive("query-0")).toBe(false);
      expect(manager.isActive("query-99")).toBe(false);
    });
  });
});