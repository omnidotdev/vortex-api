/**
 * TTL-based cache for entitlements.
 *
 * Uses Redis when available, falls back to in-memory Map for development.
 * Invalidated via webhooks from the entitlements service.
 */

import { redisClient } from "lib/redis";

const KEY_PREFIX = "ent:";

/** Default TTL: 60 seconds */
const DEFAULT_TTL_SECONDS = 60;

// In-memory fallback
const memoryCache = new Map<
  string,
  { value: unknown; version: number; expiresAt: number }
>();

/**
 * Get a cached value if it exists and has not expired.
 * Optionally validate against a version number.
 * @knipignore
 */
export const getCached = async <T>(
  key: string,
  version?: number,
): Promise<T | null> => {
  if (redisClient) {
    const raw = await redisClient.get(`${KEY_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { value: T; version: number };
    // Check version if provided (stale if version mismatch)
    if (version !== undefined && entry.version !== version) {
      await redisClient.del(`${KEY_PREFIX}${key}`);
      return null;
    }
    return entry.value;
  }

  // In-memory fallback
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  if (version !== undefined && entry.version !== version) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
};

/**
 * Set a cached value with TTL and version.
 * @knipignore
 */
export const setCached = async <T>(
  key: string,
  value: T,
  version: number,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> => {
  if (redisClient) {
    await redisClient.set(
      `${KEY_PREFIX}${key}`,
      JSON.stringify({ value, version }),
      "EX",
      ttlSeconds,
    );
    return;
  }

  // In-memory fallback
  memoryCache.set(key, {
    value,
    version,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

/**
 * Invalidate cache entries matching a pattern.
 * Supports simple prefix matching with asterisk at end.
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  if (redisClient) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          "MATCH",
          `${KEY_PREFIX}${prefix}*`,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } else {
      await redisClient.del(`${KEY_PREFIX}${pattern}`);
    }
    return;
  }

  // In-memory fallback
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  } else {
    memoryCache.delete(pattern);
  }
};

/**
 * Clear entire cache.
 * @knipignore
 */
export const clearCache = async (): Promise<void> => {
  if (redisClient) {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        `${KEY_PREFIX}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== "0");
    return;
  }

  // In-memory fallback
  memoryCache.clear();
};
