import { mock } from "bun:test";

export const mockClickHouseClient = {
  query: mock(async () => ({
    json: async () => [],
    stream: async () => ({
      on: (event, callback) => {},
    }),
  })),
  insert: mock(async () => {}),
  close: mock(async () => {}),
};

export const createClient = mock(() => mockClickHouseClient);
