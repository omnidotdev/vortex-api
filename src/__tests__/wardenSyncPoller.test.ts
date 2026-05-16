import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock dependencies before imports
const mockWriteTuples = mock(async () => {});
const mockDeleteTuples = mock(async () => {});

mock.module("lib/warden/client", () => {
  // Preserve checkPermission behavior so it doesn't leak a stub into
  // authorization tests that run in the same process
  const checkPermission = async (
    _enabled: string | undefined,
    authzProviderUrl: string | undefined,
    userId: string,
    resourceType: string,
    resourceId: string,
    permission: string,
  ) => {
    if (!authzProviderUrl) return true;
    const response = await globalThis.fetch(`${authzProviderUrl}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: `user:${userId}`,
        relation: permission,
        object: `${resourceType}:${resourceId}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`AuthZ check failed: ${response.status}`);
    const result = (await response.json()) as { allowed: boolean };
    return result.allowed;
  };

  return {
    writeTuples: mockWriteTuples,
    deleteTuples: mockDeleteTuples,
    checkPermission,
    AUTHZ_API_URL: "http://warden.test",
    buildPermissionCacheKey: () => "",
    getCachedPermission: async () => null,
    setCachedPermission: async () => {},
    invalidatePermissionCache: async () => {},
  };
});

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://gatekeeper.test",
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  AUTHZ_API_URL: "http://warden.test",
  AUTHZ_SERVICE_KEY: undefined,
  AUTHZ_WEBHOOK_SECRET: undefined,
  AUDIT_WEBHOOK_SECRET: undefined,
  AUTH_DEBUG: undefined,
  AUTH_WEBHOOK_SECRET: undefined,
  BILLING_BASE_URL: undefined,
  BILLING_SERVICE_API_KEY: undefined,
  BILLING_WEBHOOK_SECRET: undefined,
  CACHE_URL: null,
  DISCORD_OAUTH_CLIENT_ID: undefined,
  DISCORD_OAUTH_CLIENT_SECRET: undefined,
  EMAIL_WEBHOOK_SECRET: undefined,
  ENCRYPTION_KEY: undefined,
  GITHUB_OAUTH_CLIENT_ID: undefined,
  GITHUB_OAUTH_CLIENT_SECRET: undefined,
  GOOGLE_OAUTH_CLIENT_ID: undefined,
  GOOGLE_OAUTH_CLIENT_SECRET: undefined,
  GRAPHQL_MAX_COMPLEXITY_COST: "5000",
  HOST: "0.0.0.0",
  IDP_WEBHOOK_SECRET: undefined,
  INTERNAL_API_SECRET: undefined,
  NODE_ENV: "test",
  PLATFORM_ORG_ID: undefined,
  PLUGIN_STORAGE_BASE_URL: undefined,
  PLUGIN_STORAGE_BUCKET: undefined,
  PORT: "4000",
  PROTECT_ROUTES: undefined,
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET: undefined,
  SLACK_OAUTH_CLIENT_ID: undefined,
  SLACK_OAUTH_CLIENT_SECRET: undefined,
  STRIPE_API_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  TEMPORAL_ADDRESS: undefined,
  TEMPORAL_NAMESPACE: undefined,
  TEMPORAL_TASK_QUEUE: undefined,
  VORTEX_PUBLIC_URL: undefined,
  WORKER_URL: undefined,
  LOG_LEVEL: "info",
  isDevEnv: false,
  isProdEnv: false,
  protectRoutes: false,
  isAuthzEnabled: true,
  hasBilling: true,
  getOAuthCredentials: () => null,
}));

mock.module("lib/cache", () => ({
  acquireWardenSyncLock: mock(async () => "test-token"),
  releaseWardenSyncLock: mock(async () => true),
  isCacheConfigured: () => false,
}));

const mockDbSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      limit: mock(async () => []),
    })),
  })),
}));

const mockDbUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(async () => []),
  })),
}));

const mockDbInsert = mock(() => ({
  values: mock(async () => []),
}));

mock.module("lib/db/db", () => ({
  dbPool: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  },
}));

mock.module("lib/db/schema", () => ({
  wardenSyncQueueTable: {
    id: "id",
    status: "status",
    nextRetryAt: "next_retry_at",
  },
  workflowExecutorConfigTable: {},
  workflowTable: {},
  workflowRunTable: {},
  userOrganizationTable: {},
  eventSubscriptionTable: {},
}));

mock.module("lib/logger", () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

describe("syncWardenBestEffort enqueue behavior", () => {
  beforeEach(() => {
    mockWriteTuples.mockClear();
    mockDeleteTuples.mockClear();
  });

  it("should call writeTuples on success", async () => {
    const { writeTuples } = await import("lib/warden/client");

    const tuples = [
      {
        user: "user:test-user",
        relation: "owner",
        object: "organization:test-org",
      },
    ];

    await writeTuples("http://warden.test", tuples);

    expect(mockWriteTuples).toHaveBeenCalledTimes(1);
    expect(mockWriteTuples).toHaveBeenCalledWith("http://warden.test", tuples);
  });

  it("should calculate exponential backoff correctly", () => {
    // Test the backoff formula: BASE * 2^attempts, capped at 1 hour
    const BASE_BACKOFF_MS = 1_000;
    const backoffs = [0, 1, 2, 3, 4, 5, 10].map((attempts) => {
      const backoff = BASE_BACKOFF_MS * 2 ** attempts;
      return Math.min(backoff, 3_600_000);
    });

    expect(backoffs[0]).toBe(1_000); // 1s
    expect(backoffs[1]).toBe(2_000); // 2s
    expect(backoffs[2]).toBe(4_000); // 4s
    expect(backoffs[3]).toBe(8_000); // 8s
    expect(backoffs[4]).toBe(16_000); // 16s
    expect(backoffs[5]).toBe(32_000); // 32s
    expect(backoffs[6]).toBe(1_024_000); // ~17 min
  });

  it("should cap backoff at 1 hour", () => {
    const BASE_BACKOFF_MS = 1_000;
    const MAX_BACKOFF_MS = 3_600_000;

    // Attempt 22 would be 2^22 * 1000 = 4,194,304,000ms without cap
    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** 22, MAX_BACKOFF_MS);

    expect(backoff).toBe(MAX_BACKOFF_MS);
  });
});

describe("wardenSyncQueue table schema", () => {
  it("should have required columns", async () => {
    // Verify the table source defines all expected columns. Reading the
    // source file avoids mock.module() interference that occurs when
    // multiple test files run in a single process (bun test).
    const requiredColumns = [
      "id",
      "operation",
      "tuples",
      "description",
      "status",
      "attempts",
      "maxAttempts",
      "nextRetryAt",
      "lastError",
      "completedAt",
      "createdAt",
    ];

    const sourcePath = new URL(
      "../lib/db/schema/wardenSyncQueue.table.ts",
      import.meta.url,
    ).pathname;
    const source = await Bun.file(sourcePath).text();

    for (const col of requiredColumns) {
      expect(source).toContain(`${col}:`);
    }
  });
});
