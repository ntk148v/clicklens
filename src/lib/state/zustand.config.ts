import { devtools, persist } from "zustand/middleware";

export { devtools, persist };

export interface ZustandConfigOptions {
  devtools?: boolean;
  persist?: boolean;
  name?: string;
}

const DEFAULT_OPTIONS: Required<ZustandConfigOptions> = {
  devtools: true,
  persist: false,
  name: "clicklens-store",
};

export function getMiddlewareConfig(options: ZustandConfigOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  return {
    devtools: config.devtools ? {
      name: config.name,
      enabled: process.env.NODE_ENV !== "production",
    } : false,
    persist: config.persist ? {
      name: config.name,
    } : false,
  };
}
