import { describe, expect, test, mock, beforeEach } from "bun:test";
import { createClient } from "./client";
import { ClickHouseClientImpl } from "./clients/client";
import type { ClickHouseConfig } from "./config";

// Mock dependencies
const mockGetLensConfig = mock();

mock.module("./config", () => ({
  getLensConfig: mockGetLensConfig,
}));

describe("createClient", () => {
  beforeEach(() => {
    mockGetLensConfig.mockReset();
  });

  test("should create client with explicit config", () => {
    const config: ClickHouseConfig = {
      host: "localhost",
      port: 8123,
      secure: false,
      verifySsl: false,
      username: "default",
      password: "",
      database: "default",
    };
    const client = createClient(config);
    expect(client).toBeInstanceOf(ClickHouseClientImpl);
  });

  test("should create client with env config if no config provided", () => {
    mockGetLensConfig.mockReturnValue({
      host: "localhost",
      port: 8123,
      secure: false,
      verifySsl: false,
      username: "default",
      password: "",
      database: "default",
    });
    const client = createClient();
    expect(client).toBeInstanceOf(ClickHouseClientImpl);
  });

  test("should throw error if no config available", () => {
    mockGetLensConfig.mockReturnValue(null);
    expect(() => createClient()).toThrow("ClickHouse configuration not provided");
  });
});
