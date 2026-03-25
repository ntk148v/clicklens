export interface BaseStoreState {
  _name: string;
}

export interface StoreConfig {
  name: string;
  devtools: boolean;
  persist: boolean;
}

export type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean,
) => void;

export type GetState<T> = () => T;

/**
 * Store middleware type
 */
export type StoreMiddleware<T> = (
  config: StoreMiddlewareConfig<T>
) => (set: SetState<T>, get: GetState<T>) => SetState<T>;

/**
 * Store middleware configuration
 */
export interface StoreMiddlewareConfig<T> {
  name: string;
  set: SetState<T>;
  get: GetState<T>;
}

/**
 * Zustand store creator options
 */
export interface StoreCreatorOptions<T extends BaseStoreState> {
  name: string;
  initialState: T;
  middleware?: StoreMiddleware<T>[];
  devtools?: boolean;
  persist?: PersistConfig<T>;
}

/**
 * Persist configuration for state persistence
 */
export interface PersistConfig<T> {
  name: string;
  storage?: Storage;
  partialize?: (state: T) => Partial<T>;
  onRehydrateStorage?: (state: T | undefined) => void;
  merge?: (persistedState: unknown, currentState: T) => T;
}

/**
 * Store action definition
 */
export interface StoreAction<T> {
  type: string;
  payload?: unknown;
}

/**
 * Store selector function
 */
export type StoreSelector<T, R> = (state: T) => R;

/**
 * Store subscriber function
 */
export type StoreSubscriber<T> = (state: T) => void;

/**
 * Equality function for selectors
 */
export type StoreEqualityFn<T> = (a: T, b: T) => boolean;

/**
 * Computed store value
 */
export interface StoreComputed<T, R> {
  get: StoreSelector<T, R>;
  eq?: StoreEqualityFn<R>;
}

/**
 * Store subscription handle
 */
export interface StoreSubscription {
  unsubscribe: () => void;
}

/**
 * Zustand store interface
 */
export interface Store<T extends BaseStoreState> {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: StoreSubscriber<T>) => StoreSubscription;
  destroy: () => void;
}
