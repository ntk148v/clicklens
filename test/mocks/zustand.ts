export interface ZustandStoreMock<T> {
  getState(): T;
  setState(partial: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prevState: T) => void): () => void;
  destroy(): void;
}

export function createZustandStoreMock<T>(initialState?: T): ZustandStoreMock<T> {
  let state = initialState ?? ({} as T);
  const listeners = new Set<(state: T, prevState: T) => void>();

  return {
    getState() {
      return state;
    },
    setState(partial) {
      const nextState = typeof partial === "function" ? partial(state) : partial;
      const prevState = state;
      state = { ...state, ...nextState };
      listeners.forEach((listener) => listener(state, prevState));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      listeners.clear();
    },
  };
}

export function createMockZustandHook<T>(
  initialState: T
): {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
} {
  return createZustandStoreMock(initialState);
}