/**
 * TTL-based permission cache for authZ checks.
 *
 * Uses cache when available, falls back to in-memory Map for development.
 * Caches permission check results with a 5-minute TTL to reduce
 * redundant Warden calls across GraphQL requests.
 */

import { cacheClient } from "lib/cache";

const KEY_PREFIX = "perm:";

/** Default TTL: 5 minutes */
const DEFAULT_TTL_SECONDS = 300;

// In-memory fallback for when cache is unavailable
const memoryCache = new Map<string, { allowed: boolean; expiresAt: number }>();

/**
 * Build a cache key for a permission check.
 */
export function buildPermissionCacheKey(
  userId: string,
  resourceType: string,
  resourceId: string,
  permission: string,
): string {
  return `${userId}:${resourceType}:${resourceId}:${permission}`;
}

/**
 * Get a cached permission result.
 * Returns null if not cached or expired.
 */
export async function getCachedPermission(
  key: string,
): Promise<boolean | null> {
  if (cacheClient) {
    const raw = await cacheClient.get(`${KEY_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { allowed: boolean };
    return entry.allowed;
  }

  // In-memory fallback
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.allowed;
}

/**
 * Cache a permission result with TTL.
 */
export async function setCachedPermission(
  key: string,
  allowed: boolean,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  if (cacheClient) {
    await cacheClient.set(
      `${KEY_PREFIX}${key}`,
      JSON.stringify({ allowed }),
      { EX: ttlSeconds },
    );
    return;
  }

  // In-memory fallback
  memoryCache.set(key, {
    allowed,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate cached permissions matching a pattern.
 * Used when membership changes to clear stale permissions.
 *
 * Pattern examples:
 * - `user123:organization:` - All organization permissions for user
 * - `user123:` - All permissions for user
 * - `:organization:org456:` - All permissions for organization
 */
export async function invalidatePermissionCache(
  pattern: string,
): Promise<void> {
  if (cacheClient) {
    const scanPattern = `${KEY_PREFIX}*${pattern}*`;
    let cursor = 0;
    do {
      const result = await cacheClient.scan(cursor, {
        MATCH: scanPattern,
        COUNT: 100,
      });
      cursor = result.cursor;
      const keys = result.keys;
      if (keys.length > 0) {
        await cacheClient.del(keys);
      }
    } while (cursor !== 0);
    return;
  }

  // In-memory fallback
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cached permissions.
 * Useful for testing or emergency cache flush.
 */
export async function clearPermissionCache(): Promise<void> {
  if (cacheClient) {
    let cursor = 0;
    do {
      const result = await cacheClient.scan(cursor, {
        MATCH: `${KEY_PREFIX}*`,
        COUNT: 100,
      });
      cursor = result.cursor;
      const keys = result.keys;
      if (keys.length > 0) {
        await cacheClient.del(keys);
      }
    } while (cursor !== 0);
    return;
  }

  // In-memory fallback
  memoryCache.clear();
}
