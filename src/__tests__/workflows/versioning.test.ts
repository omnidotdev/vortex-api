import { describe, expect, it, mock } from "bun:test";

// Mock env config to avoid required-env-var validation at import time
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
  BILLING_BASE_URL: "http://localhost:4500",
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
  VORTEX_PUBLIC_URL: "http://localhost:4222",
  WORKER_URL: undefined,
  LOG_LEVEL: "info",
  isDevEnv: false,
  isProdEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: true,
  getOAuthCredentials: () => null,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// Track inserts for assertions
const insertedRows: unknown[] = [];
let findFirstResult: { version: number } | undefined;

const mockReturning = mock(() => {
  const row = insertedRows.shift();
  return Promise.resolve(row ? [row] : []);
});

const mockValues = mock((_values: unknown) => ({ returning: mockReturning }));
const mockInsert = mock(() => ({ values: mockValues }));

const mockFindFirst = mock(() => Promise.resolve(findFirstResult));

mock.module("lib/db/db", () => ({
  dbPool: {
    insert: mockInsert,
    query: {
      workflowVersionTable: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

// Import after mocks
const { default: saveWorkflowVersion } = await import(
  "../../lib/workflows/versioning"
);

describe("saveWorkflowVersion", () => {
  it("should start at version 1 when no versions exist", async () => {
    findFirstResult = undefined;

    const expectedRow = {
      id: "v1",
      workflowId: "wf-1",
      version: 1,
      definition: { nodes: [] },
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      changeNote: null,
    };
    insertedRows.push(expectedRow);

    const result = await saveWorkflowVersion({
      workflowId: "wf-1",
      definition: { nodes: [] },
      createdBy: "user-1",
    });

    expect(result).toEqual(expectedRow);

    // Verify insert was called with version 1
    const lastCall = mockValues.mock.calls.at(-1);
    const valuesArg = lastCall?.[0] as Record<string, unknown>;
    expect(valuesArg.version).toBe(1);
    expect(valuesArg.workflowId).toBe("wf-1");
    expect(valuesArg.definition).toEqual({ nodes: [] });
  });

  it("should increment version from existing max", async () => {
    findFirstResult = { version: 3 };

    const expectedRow = {
      id: "v4",
      workflowId: "wf-2",
      version: 4,
      definition: { nodes: ["a"] },
      createdBy: null,
      createdAt: "2026-01-01T00:00:00Z",
      changeNote: "Updated triggers",
    };
    insertedRows.push(expectedRow);

    const result = await saveWorkflowVersion({
      workflowId: "wf-2",
      definition: { nodes: ["a"] },
      changeNote: "Updated triggers",
    });

    expect(result).toEqual(expectedRow);

    const lastCall = mockValues.mock.calls.at(-1);
    const valuesArg = lastCall?.[0] as Record<string, unknown>;
    expect(valuesArg.version).toBe(4);
    expect(valuesArg.workflowId).toBe("wf-2");
    expect(valuesArg.changeNote).toBe("Updated triggers");
  });

  it("should pass createdBy when provided", async () => {
    findFirstResult = undefined;

    const expectedRow = {
      id: "v5",
      workflowId: "wf-3",
      version: 1,
      definition: {},
      createdBy: "user-42",
      createdAt: "2026-01-01T00:00:00Z",
      changeNote: null,
    };
    insertedRows.push(expectedRow);

    await saveWorkflowVersion({
      workflowId: "wf-3",
      definition: {},
      createdBy: "user-42",
    });

    const lastCall = mockValues.mock.calls.at(-1);
    const valuesArg = lastCall?.[0] as Record<string, unknown>;
    expect(valuesArg.createdBy).toBe("user-42");
  });
});
