/**
 * Manages AbortController instances for query cancellation.
 * Provides centralized control over query lifecycle and prevents memory leaks.
 */
export class QueryCancellationManager {
  private controllers: Map<string, AbortController>;

  constructor() {
    this.controllers = new Map();
  }

  /**
   * Creates a new AbortController for the given query ID.
   * If a controller already exists for this ID, it will be aborted and replaced.
   *
   * @param queryId - Unique identifier for the query
   * @returns The new AbortController
   */
  createController(queryId: string): AbortController {
    const existing = this.controllers.get(queryId);
    if (existing) {
      existing.abort();
    }

    const controller = new AbortController();
    this.controllers.set(queryId, controller);
    return controller;
  }

  /**
   * Cancels the query with the given ID by aborting its controller.
   * The controller is removed from tracking after cancellation.
   *
   * @param queryId - Unique identifier for the query to cancel
   */
  cancel(queryId: string): void {
    const controller = this.controllers.get(queryId);
    if (controller) {
      controller.abort();
      this.controllers.delete(queryId);
    }
  }

  /**
   * Cancels all active queries by aborting all controllers.
   * All controllers are removed from tracking after cancellation.
   */
  cancelAll(): void {
    for (const [queryId, controller] of this.controllers.entries()) {
      controller.abort();
      this.controllers.delete(queryId);
    }
  }

  /**
   * Checks if a query with the given ID is currently active.
   * A query is active if it has a controller that has not been aborted.
   *
   * @param queryId - Unique identifier for the query
   * @returns true if the query is active, false otherwise
   */
  isActive(queryId: string): boolean {
    const controller = this.controllers.get(queryId);
    return controller !== undefined && !controller.signal.aborted;
  }
}