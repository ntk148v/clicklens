export interface MockRedisOptions {
  delay?: number;
  shouldFail?: boolean;
}

export class MockRedis {
  private store: Map<string, string> = new Map();
  private options: MockRedisOptions;

  constructor(options: MockRedisOptions = {}) {
    this.options = options;
  }

  async get(key: string): Promise<string | null> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    if (this.options.delay) await this.delay(this.options.delay);
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    if (this.options.delay) await this.delay(this.options.delay);
    this.store.set(key, value);
    return "OK";
  }

  async setex(key: string, seconds: number, value: string): Promise<"OK"> {
    return this.set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) count++;
    }
    return count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    return this.store.has(key) ? -1 : -2;
  }

  async flushdb(): Promise<"OK"> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    this.store.clear();
    return "OK";
  }

  async ping(): Promise<string> {
    if (this.options.shouldFail) throw new Error("Redis connection failed");
    return "PONG";
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createMockRedis(options?: MockRedisOptions): MockRedis {
  return new MockRedis(options);
}