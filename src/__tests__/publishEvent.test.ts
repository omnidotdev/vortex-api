/**
 * Unit tests for publishEvent error handling.
 *
 * Tests the error classification logic in `executePublishEvent` to verify
 * that specific failure modes produce the correct GraphQLError codes rather
 * than opaque INTERNAL_SERVER_ERROR responses.
 */

import { describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

// -- Module mocks (must precede any import of the plugin) --

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://localhost:3000",
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

mock.module("iovalkey", () => ({
  default: class MockValkey {},
}));

mock.module("lib/cache/client", () => ({
  cacheClient: null,
}));

mock.module("lib/db/db", () => ({
  dbPool: {},
  dbClient: {},
  pgClient: { end: async () => {} },
  pgPool: { end: async () => {} },
}));

mock.module("lib/hatchet/client", () => ({
  pushEvent: async () => {},
  isConfigured: () => false,
}));

mock.module("@temporalio/client", () => ({
  Connection: { connect: async () => ({}) },
  Client: class MockClient {},
}));

mock.module("server", () => ({
  eventsClient: null,
}));

// Import after all mocks are established
const { executePublishEvent, matchGlobPattern } = await import(
  "../lib/graphql/plugins/publishEvent.plugin"
);

import { and, desc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

// -- Helpers --

const fakeObserver = {
  id: randomUUID(),
  email: "test@omni.dev",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseInput = {
  organizationId: randomUUID(),
  type: "user.created",
  subject: null,
  data: { userId: "u-1" },
  idempotencyKey: null,
  correlationId: null,
};

/** Build a mock db pool with configurable query results */
const createMockDb = (overrides?: {
  membershipResult?: unknown;
  routingRulesResult?: unknown[] | Error;
  workflowResult?: unknown;
}) => {
  const defaults = {
    membershipResult: {
      userId: fakeObserver.id,
      organizationId: baseInput.organizationId,
    },
    routingRulesResult: [] as unknown[],
    workflowResult: null as unknown,
  };
  const opts = { ...defaults, ...overrides };

  return {
    query: {
      userOrganizationTable: {
        findFirst: mock(async () => opts.membershipResult),
      },
      eventRoutingRuleTable: {
        findMany: mock(async () => {
          if (opts.routingRulesResult instanceof Error) {
            throw opts.routingRulesResult;
          }
          return opts.routingRulesResult;
        }),
      },
      workflowTable: {
        findFirst: mock(async () => opts.workflowResult),
        findMany: mock(async () =>
          opts.workflowResult ? [opts.workflowResult] : [],
        ),
      },
    },
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(async () => [{ id: randomUUID() }]),
      })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(async () => {}),
      })),
    })),
  };
};

// Stub tables (only used as drizzle references, not queried directly)
const stubEventTable = {
  organizationId: "organizationId",
  enabled: "enabled",
  priority: "priority",
};

const stubWfTable = {
  id: "id",
  isActive: "isActive",
};

const stubWfRunTable = {
  id: "id",
};

// -- Tests --

describe("executePublishEvent error handling", () => {
  describe("EVENT_PUBLISHING_UNAVAILABLE", () => {
    it("throws with code EVENT_PUBLISHING_UNAVAILABLE when no backend is configured", async () => {
      const db = createMockDb();

      try {
        await executePublishEvent(
          baseInput,
          fakeObserver as never,
          db as never,
          false, // hatchetConfigured = false
          mock(async () => {}) as never,
          randomUUID,
          matchGlobPattern,
          and,
          eq,
          desc,
          stubEventTable as never,
          stubWfTable as never,
          stubWfRunTable as never,
        );
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.extensions?.code).toBe("EVENT_PUBLISHING_UNAVAILABLE");
        expect(gqlErr.message).toContain("not available");
      }
    });
  });

  describe("EVENT_ROUTING_ERROR", () => {
    it("throws with code EVENT_ROUTING_ERROR when routing rule query fails", async () => {
      const db = createMockDb({
        routingRulesResult: new Error("connection refused"),
      });

      try {
        await executePublishEvent(
          baseInput,
          fakeObserver as never,
          db as never,
          true, // hatchetConfigured = true
          mock(async () => {}) as never,
          randomUUID,
          matchGlobPattern,
          and,
          eq,
          desc,
          stubEventTable as never,
          stubWfTable as never,
          stubWfRunTable as never,
        );
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.extensions?.code).toBe("EVENT_ROUTING_ERROR");
        expect(gqlErr.message).toContain("routing rules");
      }
    });
  });

  describe("EVENT_DISPATCH_FAILED", () => {
    it("throws with code EVENT_DISPATCH_FAILED when all dispatches fail", async () => {
      const workflowId = randomUUID();

      const db = createMockDb({
        routingRulesResult: [
          {
            id: randomUUID(),
            organizationId: baseInput.organizationId,
            typePattern: "user.*",
            workflowId,
            enabled: true,
            priority: 1,
          },
        ],
        workflowResult: {
          id: workflowId,
          name: "test-wf",
          isActive: true,
          definition: { nodes: [], edges: [] },
        },
      });

      // Hatchet push fails
      const failingPush = mock(async () => {
        throw new Error("Hatchet unavailable");
      });

      try {
        await executePublishEvent(
          baseInput,
          fakeObserver as never,
          db as never,
          true, // hatchetConfigured = true (but push will throw)
          failingPush as never,
          randomUUID,
          matchGlobPattern,
          and,
          eq,
          desc,
          stubEventTable as never,
          stubWfTable as never,
          stubWfRunTable as never,
        );
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.extensions?.code).toBe("EVENT_DISPATCH_FAILED");
        expect(gqlErr.extensions?.eventId).toBeString();
        expect(gqlErr.message).toContain("failed to dispatch");
      }
    });
  });

  describe("successful publish (no errors)", () => {
    it("returns eventId and empty workflowsTriggered when no rules match", async () => {
      const db = createMockDb({
        routingRulesResult: [],
      });

      const result = await executePublishEvent(
        baseInput,
        fakeObserver as never,
        db as never,
        true,
        mock(async () => {}) as never,
        randomUUID,
        matchGlobPattern,
        and,
        eq,
        desc,
        stubEventTable as never,
        stubWfTable as never,
        stubWfRunTable as never,
      );

      expect(result.eventId).toBeString();
      expect(result.workflowsTriggered).toEqual([]);
    });
  });
});

describe("matchGlobPattern", () => {
  it("matches wildcard '*' against any value", () => {
    expect(matchGlobPattern("*", "anything")).toBe(true);
    expect(matchGlobPattern("*", "")).toBe(true);
  });

  it("matches prefix glob 'user.*'", () => {
    expect(matchGlobPattern("user.*", "user.created")).toBe(true);
    expect(matchGlobPattern("user.*", "user.deleted")).toBe(true);
    expect(matchGlobPattern("user.*", "org.created")).toBe(false);
  });

  it("matches exact strings", () => {
    expect(matchGlobPattern("user.created", "user.created")).toBe(true);
    expect(matchGlobPattern("user.created", "user.deleted")).toBe(false);
  });
});
