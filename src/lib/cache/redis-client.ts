/**
 * Redis Client Wrapper
 *
 * Provides a singleton Redis client with graceful degradation.
 */

import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionError: Error | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  if (isConnecting) {
    throw new Error("Redis client is connecting");
  }

  if (connectionError) {
    throw connectionError;
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    isConnecting = true;
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error("Too many reconnect attempts");
          }
          return retries * 100;
        },
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis client error:", err);
      connectionError = err;
    });

    redisClient.on("connect", () => {
      console.log("Redis client connected");
      connectionError = null;
    });

    await redisClient.connect();
    isConnecting = false;
    return redisClient;
  } catch (error) {
    isConnecting = false;
    connectionError = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to connect to Redis:", connectionError);
    throw connectionError;
  }
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    connectionError = null;
  }
}

export function isRedisAvailable(): boolean {
  return redisClient !== null && connectionError === null;
}